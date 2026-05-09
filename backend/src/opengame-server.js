import http from 'http';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const sessions = new Map();

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse JSON body helper
  const readJson = () => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
    });
  });

  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1. GENERATE OPEN GAME ROUTE
  if (url.pathname === '/api/opengame/generate' && req.method === 'POST') {
    try {
      const body = await readJson();
      const { prompt, keys, providers } = body;

      if (!prompt || !keys || !providers || providers.length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing prompt, keys, or providers' }));
        return;
      }

      const sessionId = crypto.randomUUID();
      sessions.set(sessionId, { keys, providers, createdAt: Date.now() });

      const openGameDir = path.resolve('/root/smolgame-frontend/agent/OpenGame');
      const tempGameDir = path.join(os.tmpdir(), `opengame-${sessionId}`);
      
      await fs.mkdir(tempGameDir, { recursive: true });

      const envVars = {
        ...process.env,
        OPENGAME_REASONING_PROVIDER: 'openai-compat',
        OPENGAME_REASONING_API_KEY: sessionId,
        OPENGAME_REASONING_BASE_URL: 'http://127.0.0.1:3001/api/llm-proxy', 
        OPENGAME_REASONING_MODEL: 'dynamic-model'
      };

      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked'
      });

      const fullPrompt = `${prompt}\n\n(IMPORTANT: You must write the ENTIRE game in a single index.html file including all CSS and JS, do not create separate files.)`;
      
      const child = spawn('npm', ['run', 'start', '--', '--prompt', fullPrompt, '--yolo'], {
        cwd: tempGameDir,
        env: { ...envVars, PATH: process.env.PATH + ':' + path.join(openGameDir, 'node_modules', '.bin') }
      });

      child.stdout.on('data', (data) => {
        res.write(data);
      });

      child.stderr.on('data', (data) => {
        console.error(`[OpenGame Error]: ${data}`);
      });

      child.on('close', async (code) => {
        sessions.delete(sessionId);
        try {
          const indexPath = path.join(tempGameDir, 'index.html');
          const finalCode = await fs.readFile(indexPath, 'utf-8');
          res.write(`\n\n===OPEN_GAME_RESULT===\n${finalCode}`);
        } catch (e) {
          res.write(`\n\n===OPEN_GAME_RESULT_ERROR===\nCould not read index.html: ${e.message}`);
        }
        res.end();
      });

    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'invalid json' }));
    }
    return;
  }

  // 2. LLM PROXY ROUTE (Called by OpenGame)
  if (url.pathname === '/api/llm-proxy/chat/completions' && req.method === 'POST') {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'No authorization header' }));
      return;
    }

    const sessionId = authHeader.replace('Bearer ', '').trim();
    const session = sessions.get(sessionId);

    if (!session) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Session expired or invalid' }));
      return;
    }

    try {
      const body = await readJson();
      let lastError = "";

      for (const provider of session.providers) {
        const apiKey = session.keys[provider];
        if (!apiKey) continue;

        let providerUrl = "";
        let headers = { "Content-Type": "application/json" };
        let finalBody = { ...body };

        if (provider === "groq") {
          providerUrl = "https://api.groq.com/openai/v1/chat/completions";
          headers["Authorization"] = `Bearer ${apiKey}`;
          finalBody.model = "llama-3.3-70b-versatile"; 
        } else if (provider === "gemini") {
          providerUrl = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${apiKey}`;
          finalBody.model = "gemini-2.0-flash";
        } else if (provider === "openrouter") {
          providerUrl = "https://openrouter.ai/api/v1/chat/completions";
          headers["Authorization"] = `Bearer ${apiKey}`;
          headers["HTTP-Referer"] = "https://smolgame.ru";
          headers["X-Title"] = "SmolGame OpenGame Proxy";
          finalBody.model = "google/gemini-2.0-flash-001";
        } else if (provider === "together") {
          providerUrl = "https://api.together.xyz/v1/chat/completions";
          headers["Authorization"] = `Bearer ${apiKey}`;
          finalBody.model = "meta-llama/Llama-3.3-70B-Instruct-Turbo";
        }

        if (!providerUrl) continue;

        console.log(`[Proxy] Trying ${provider} for OpenGame session ${sessionId}`);

        try {
          const fetchRes = await fetch(providerUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(finalBody)
          });

          if (fetchRes.ok) {
            console.log(`[Proxy] Success using ${provider}!`);
            res.writeHead(fetchRes.status, { 'Content-Type': 'application/json' });
            const data = await fetchRes.arrayBuffer();
            res.end(Buffer.from(data));
            return;
          } else {
            const errText = await fetchRes.text();
            lastError = `[${provider}] HTTP ${fetchRes.status}: ${errText}`;
            console.warn(`[Proxy] Failed ${provider}:`, lastError);
          }
        } catch (e) {
          lastError = `[${provider}] Fetch error: ${e.message}`;
          console.error(`[Proxy] Error with ${provider}:`, e);
        }
      }

      res.writeHead(502);
      res.end(JSON.stringify({ error: `All providers failed. Last error: ${lastError}` }));
    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'invalid json' }));
    }
    return;
  }

  // Fallback
  res.writeHead(404);
  res.end('Not found');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 OpenGame Node.js Server running on port ${PORT}`);
});
