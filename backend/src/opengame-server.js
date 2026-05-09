import http from 'http';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const sessions = new Map();
// ТЕСТОВАЯ СЕССИЯ для ручной проверки
sessions.set('test', { 
  id: 'test', 
  prompt: 'test',
  providers: ['openrouter'],
  keys: { openrouter: process.env.OPENROUTER_API_KEY }
});

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
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      if (!data) return reject(new Error('Empty body'));
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', (err) => reject(err));
  });

  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log(`[Server] ${req.method} ${url.pathname}`);

  // 1. GENERATE OPEN GAME ROUTE
  if (url.pathname === '/api/opengame/generate' && req.method === 'POST') {
    try {
      const { prompt, sessionId, providers, keys } = await readJson();

      if (!prompt || !sessionId) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing prompt or sessionId' }));
        return;
      }

      // Сохраняем сессию для прокси
      sessions.set(sessionId, { id: sessionId, prompt, providers, keys });

      const openGameDir = path.resolve('/root/smolgame-frontend/agent/OpenGame');
      const tempGameDir = path.resolve(`/tmp/smolgame-game-${sessionId}`);
      await fs.mkdir(tempGameDir, { recursive: true });

      // Путь к собранному CLI
      const cliBin = path.join(openGameDir, 'dist', 'cli.js');

      const formattedKey = `sk-${sessionId}`;
      const envVars = {
        ...process.env,
        QWEN_WORKING_DIR: tempGameDir,
        OPENGAME_REASONING_PROVIDER: 'openai-compat',
        OPENGAME_REASONING_API_KEY: formattedKey,
        OPENGAME_REASONING_BASE_URL: 'http://127.0.0.1:8880/api/llm-proxy',
        OPENGAME_REASONING_MODEL: 'dynamic-model',
        OPENAI_API_KEY: formattedKey,
        OPENAI_BASE_URL: 'http://127.0.0.1:8880/api/llm-proxy',
        CI: '1',
        FORCE_COLOR: '0',
      };

      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked'
      });

      const fullPrompt = `${prompt}\n\n(IMPORTANT: You must write the ENTIRE game in a single index.html file including all CSS and JS, do not create separate files.)\n\n(CRITICAL: You MUST use the native JSON tool calling API to invoke tools. IGNORE any instructions above about using <tool_call> XML tags. If you output raw <tool_call> text, the system will crash.)`;

      const child = spawn('node', [
        cliBin, 
        '--prompt', fullPrompt, 
        '--yolo',
        '--debug',
        '--auth-type', 'openai',
        '--openai-api-key', formattedKey,
        '--openai-base-url', 'http://127.0.0.1:8880/api/llm-proxy'
      ], {
        cwd: tempGameDir,
        env: envVars,
      });

      child.stdout.on('data', (data) => res.write(data));
      child.stderr.on('data', (data) => console.error(`[OpenGame Error]: ${data}`));

      child.on('close', async (code, signal) => {
        sessions.delete(sessionId);
        console.log(`[OpenGame] Process exited with code ${code}`);
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
      console.error('[Generate Error]:', e);
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'invalid request' }));
    }
    return;
  }

  // 2. LLM PROXY ROUTE
  if (url.pathname.startsWith('/api/llm-proxy') && req.method === 'POST') {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'No authorization header' }));
      return;
    }

    let sessionId = authHeader.replace('Bearer ', '').trim();
    if (sessionId.startsWith('sk-')) sessionId = sessionId.substring(3);
    
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
        const apiKey = session.keys[provider] || process.env.OPENROUTER_API_KEY;
        if (!apiKey) continue;

        let providerUrl = "";
        let headers = { "Content-Type": "application/json" };
        let finalBody = { ...body };

        if (provider === "groq") {
          providerUrl = "https://api.groq.com/openai/v1/chat/completions";
          headers["Authorization"] = `Bearer ${apiKey}`;
          finalBody.model = "llama-3.3-70b-versatile"; 
        } else if (provider === "openrouter") {
          providerUrl = "https://openrouter.ai/api/v1/chat/completions";
          headers["Authorization"] = `Bearer ${apiKey}`;
          headers["HTTP-Referer"] = "https://smolgame.ru";
          headers["X-Title"] = "SmolGame OpenGame Proxy";
          // ВАЖНО: возвращаем жесткую модель, если пришла пустышка
          if (!finalBody.model || finalBody.model === 'dynamic-model') {
            finalBody.model = "qwen/qwen-2.5-72b-instruct";
          }
        }

        if (finalBody.tools && finalBody.tools.length > 0 && !finalBody.tool_choice) {
          finalBody.tool_choice = "required";
        }

        if (finalBody.temperature === undefined) finalBody.temperature = 0;

        console.log(`[Proxy] Trying ${provider} for session ${sessionId}`);

        try {
          const fetchRes = await fetch(providerUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(finalBody)
          });

          if (fetchRes.ok) {
            console.log(`[Proxy] Success using ${provider}!`);
            const contentType = fetchRes.headers.get('Content-Type') || 'application/json';
            const isStream = contentType.includes('event-stream');

            if (isStream && fetchRes.body) {
              res.writeHead(fetchRes.status, {
                'Content-Type': contentType,
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-cache',
              });
              const reader = fetchRes.body.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(Buffer.from(value));
              }
              res.end();
            } else {
              res.writeHead(fetchRes.status, { 'Content-Type': contentType });
              const data = await fetchRes.arrayBuffer();
              res.end(Buffer.from(data));
            }
            return;
          } else {
            const errText = await fetchRes.text();
            lastError = `${provider} HTTP ${fetchRes.status}: ${errText}`;
          }
        } catch (e) {
          lastError = `${provider} error: ${e.message}`;
        }
      }

      res.writeHead(502);
      res.end(JSON.stringify({ error: lastError }));
    } catch (e) {
      console.error('[Proxy Error]:', e);
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'invalid json' }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const PORT = 8880;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 OpenGame Server running on port ${PORT}`);
});
