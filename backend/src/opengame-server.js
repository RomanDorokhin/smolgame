import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { parse } from 'url';

// Simple session store
const sessions = new Map();

const server = http.createServer(async (req, res) => {
  const { pathname } = parse(req.url, true);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const readJson = () => new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const rawBody = buffer.toString('utf-8');
      try {
        if (!rawBody) {
          resolve(null);
          return;
        }
        resolve(JSON.parse(rawBody));
      } catch (e) {
        console.error('[JSON Parse Error]:', e.message);
        console.error('[Raw Body Snapshot]:', rawBody.slice(0, 1000));
        e.rawBody = rawBody;
        reject(e);
      }
    });
  });

  if (pathname === '/api/opengame/generate' && req.method === 'POST') {
    try {
      const body = await readJson();
      const { prompt, keys, providers, sessionId } = body;

      if (!prompt || !sessionId) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing prompt or sessionId' }));
        return;
      }

      // Сохраняем реальные ключи в сессию, индексируем по sessionId
      sessions.set(sessionId, { keys, providers });

      const tempGameDir = path.join('/tmp', `smolgame-game-${sessionId}`);
      if (!fs.existsSync(tempGameDir)) fs.mkdirSync(tempGameDir, { recursive: true });

      const agentDir = path.resolve(__dirname, '../../agent/OpenGame');
      const cliBin = path.join(agentDir, 'dist/cli.js');
      console.log(`[OpenGame] Using CLI at: ${cliBin}`);

      // ВАЖНО: В качестве "ключа" для CLI передаем sk- + sessionId.
      // Наш прокси потом вырежет sessionId из этого ключа.
      const proxyAuthKey = `sk-${sessionId}`;

      const envVars = {
        ...process.env,
        QWEN_WORKING_DIR: tempGameDir,
        OPENGAME_REASONING_PROVIDER: 'openai-compat',
        OPENGAME_REASONING_API_KEY: proxyAuthKey,
        OPENGAME_REASONING_BASE_URL: 'http://127.0.0.1:8880/api/llm-proxy',
        OPENGAME_REASONING_MODEL: 'dynamic-model',
        OPENAI_API_KEY: proxyAuthKey,
        OPENAI_BASE_URL: 'http://127.0.0.1:8880/api/llm-proxy',
        CI: '1',
        FORCE_COLOR: '0',
      };

      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked'
      });

      const fullPrompt = `${prompt}\n\n(IMPORTANT: You must write the ENTIRE game in a single index.html file including all CSS and JS, do not create separate files.)\n\n(CRITICAL: You MUST use the native JSON tool calling API to invoke tools. IGNORE any instructions above about using <tool_call> XML tags. If you output raw <tool_call> text, the system will crash.)`;

      if (!fs.existsSync(cliBin)) {
        console.error(`[Error] CLI binary not found at ${cliBin}`);
        res.write(`\n\n[ERROR] OpenGame CLI not found on server. Please check deployment.\n`);
        res.end();
        return;
      }

      console.log(`[Server] POST /api/opengame/generate for session ${sessionId}`);
      console.log(`[Server] Working dir: ${tempGameDir}`);
      console.log(`[Server] Running CLI: node ${cliBin}`);

      const child = spawn('node', [
        cliBin, 
        '--yolo',
        '--debug',
        '--auth-type', 'openai',
        '--openai-api-key', proxyAuthKey,
        '--openai-base-url', 'http://127.0.0.1:8880/api/llm-proxy'
      ], {
        cwd: tempGameDir,
        env: envVars,
        shell: true
      });

      child.stdin.write(fullPrompt);
      child.stdin.end();

      child.stdout.on('data', (data) => {
        res.write(data);
      });

      child.stderr.on('data', (data) => {
        console.error(`[OpenGame CLI Stderr]: ${data}`);
        res.write(data);
      });

      child.on('error', (err) => {
        console.error(`[OpenGame Spawn Error]:`, err);
        res.write(`\n\n[ERROR] Failed to start OpenGame: ${err.message}\n`);
        res.end();
      });

      child.on('close', async (code) => {
        console.log(`[OpenGame] Process exited with code ${code} for session ${sessionId}`);
        if (code === 0) {
          try {
            const htmlPath = path.join(tempGameDir, 'index.html');
            if (fs.existsSync(htmlPath)) {
              const content = fs.readFileSync(htmlPath, 'utf-8');
              res.write(`\n===OPEN_GAME_RESULT===\n${content}`);
            } else {
              res.write(`\n\n[ERROR] index.html not found in ${tempGameDir}\n`);
            }
          } catch (e) {
            res.write(`\n\n[ERROR] Failed to read result: ${e.message}\n`);
          }
        } else {
          res.write(`\n\n[ERROR] OpenGame generation failed with code ${code}\n`);
        }
        res.end();
      });

    } catch (e) {
      console.error('[Generate Error]:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // LLM PROXY
  if (pathname === '/api/llm-proxy/chat/completions' && req.method === 'POST') {
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'No authorization header' }));
      return;
    }

    // Вырезаем sessionId из ключа (например, из "Bearer sk-xyz" получаем "xyz")
    let sessionId = authHeader.replace('Bearer ', '').trim();
    if (sessionId.startsWith('sk-')) sessionId = sessionId.substring(3);
    
    console.log(`[Proxy] Incoming request for session ID: ${sessionId}`);

    const session = sessions.get(sessionId);
    if (!session) {
      console.error(`[Proxy Error] Session not found: ${sessionId}`);
      res.writeHead(401);
      res.end(JSON.stringify({ error: `Session ${sessionId} not found` }));
      return;
    }

    try {
      console.log(`[Proxy] Body reading for session: ${sessionId}...`);
      const body = await readJson();
      if (!body) {
        throw new Error('Empty body received from CLI');
      }
      
      let lastError = "No provider succeeded";
      // ... (rest of the logic remains)

      for (const provider of session.providers) {
        const apiKey = session.keys[provider];
        if (!apiKey) continue;

        let providerUrl = "";
        let headers = { "Content-Type": "application/json" };
        let finalBody = { ...body };

        if (provider === "groq") {
          providerUrl = "https://api.groq.com/openai/v1/chat/completions";
          headers["Authorization"] = `Bearer ${apiKey}`;
          if (!finalBody.model || finalBody.model === 'dynamic-model') {
            finalBody.model = "llama-3.3-70b-versatile"; 
          }
        } else if (provider === "openrouter") {
          providerUrl = "https://openrouter.ai/api/v1/chat/completions";
          headers["Authorization"] = `Bearer ${apiKey}`;
          headers["HTTP-Referer"] = "https://smolgame.ru";
          headers["X-Title"] = "SmolGame OpenGame Proxy";
          if (!finalBody.model || finalBody.model === 'dynamic-model') {
            finalBody.model = "anthropic/claude-3.5-sonnet";
          }
        } else if (provider === "openai") {
          providerUrl = "https://api.openai.com/v1/chat/completions";
          headers["Authorization"] = `Bearer ${apiKey}`;
          if (!finalBody.model || finalBody.model === 'dynamic-model') {
            finalBody.model = "gpt-4o";
          }
        }

        console.log(`[Proxy] Forwarding to ${provider} using real key`);

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
            lastError = `${provider} error: ${errText}`;
            console.error(`[Proxy] ${provider} failed:`, errText);
          }
        } catch (e) {
          lastError = `${provider} exception: ${e.message}`;
          console.error(`[Proxy] ${provider} exception:`, e);
        }
      }

      res.writeHead(502);
      res.end(JSON.stringify({ error: lastError }));
    } catch (e) {
      res.writeHead(400);
      const errorDetail = {
        error: 'invalid json',
        message: e.message,
        bodyPreview: e.rawBody ? e.rawBody.slice(0, 200) : 'empty'
      };
      console.error('[Proxy Error Details]:', errorDetail);
      res.end(JSON.stringify(errorDetail));
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
