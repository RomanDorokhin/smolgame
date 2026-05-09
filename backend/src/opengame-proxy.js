import { error } from './http.js';
import { spawn } from 'child_process';
import path from 'path';

// Хранилище временных сессий для ключей
const sessions = new Map();

/**
 * Стартует OpenGame для конкретного пользователя.
 * Фронтенд шлет ключи, промпт и порядок провайдеров.
 */
export async function generateOpenGame(req, env) {
  let body;
  try { body = await req.json(); } catch (e) { return error('invalid json'); }

  const { prompt, keys, providers } = body;
  if (!prompt || !keys || !providers || providers.length === 0) {
    return error('Missing prompt, keys, or providers', 400);
  }

  // Создаем уникальную сессию для пользователя
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { keys, providers, createdAt: Date.now() });

  // Запускаем OpenGame как child process
  // Мы передаем sessionId как API-ключ, а наш прокси-URL как BASE_URL
  const openGameDir = path.resolve('/root/smolgame-frontend/agent/OpenGame');
  
  const envVars = {
    ...process.env,
    OPENGAME_REASONING_PROVIDER: 'openai-compat',
    OPENGAME_REASONING_API_KEY: sessionId, // <-- OpenGame пошлет его в заголовке Authorization
    OPENGAME_REASONING_BASE_URL: 'http://localhost:3001/api/llm-proxy', // <-- Стучится к нам!
    OPENGAME_REASONING_MODEL: 'dynamic-model'
  };

  return new Response(new ReadableStream({
    start(controller) {
      const child = spawn('npm', ['run', 'start', '--', '--prompt', prompt], {
        cwd: openGameDir,
        env: envVars
      });

      child.stdout.on('data', (data) => {
        controller.enqueue(data);
      });

      child.stderr.on('data', (data) => {
        console.error(`[OpenGame Error]: ${data}`);
      });

      child.on('close', (code) => {
        // Очищаем сессию
        sessions.delete(sessionId);
        controller.close();
      });
    }
  }), {
    headers: {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked'
    }
  });
}

/**
 * Прокси, который притворяется OpenAI для движка OpenGame.
 * Он перехватывает запросы от OpenGame, читает sessionId из Authorization,
 * достает реальные ключи пользователя и перенаправляет запрос к Groq/Gemini/итд.
 */
export async function proxyOpenGameLLM(req, env) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return error('No authorization header', 401);

  // Вытаскиваем sessionId
  const sessionId = authHeader.replace('Bearer ', '').trim();
  const session = sessions.get(sessionId);

  if (!session) {
    return error('Session expired or invalid', 401);
  }

  let body;
  try { body = await req.json(); } catch(e) { return error('invalid json'); }

  // ─────────────────────────────────────────────────────────────
  // РЕАЛИЗАЦИЯ ФОЛЛБЭКА (ПЕРЕБИРАЕМ ПРОВАЙДЕРОВ ПО ОЧЕРЕДИ)
  // ─────────────────────────────────────────────────────────────
  let lastError = "";

  for (const provider of session.providers) {
    const apiKey = session.keys[provider];
    if (!apiKey) continue;

    let url = "";
    let headers = { "Content-Type": "application/json" };
    let finalBody = { ...body };

    // Определяем URL и заголовки для конкретного провайдера
    if (provider === "groq") {
      url = "https://api.groq.com/openai/v1/chat/completions";
      headers["Authorization"] = `Bearer ${apiKey}`;
      finalBody.model = "llama-3.3-70b-versatile"; 
    } else if (provider === "gemini") {
      url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${apiKey}`;
      finalBody.model = "gemini-2.0-flash";
    } else if (provider === "openrouter") {
      url = "https://openrouter.ai/api/v1/chat/completions";
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["HTTP-Referer"] = "https://smolgame.ru";
      headers["X-Title"] = "SmolGame OpenGame Proxy";
      finalBody.model = "google/gemini-2.0-flash-001";
    } else if (provider === "together") {
      url = "https://api.together.xyz/v1/chat/completions";
      headers["Authorization"] = `Bearer ${apiKey}`;
      finalBody.model = "meta-llama/Llama-3.3-70B-Instruct-Turbo";
    }

    if (!url) continue;

    console.log(`[Proxy] Trying ${provider} for OpenGame session ${sessionId}`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(finalBody)
      });

      if (response.ok) {
        console.log(`[Proxy] Success using ${provider}!`);
        // Пробрасываем успешный ответ обратно в OpenGame
        return new Response(response.body, {
          status: response.status,
          headers: response.headers
        });
      } else {
        const errText = await response.text();
        lastError = `[${provider}] HTTP ${response.status}: ${errText}`;
        console.warn(`[Proxy] Failed ${provider}:`, lastError);
      }
    } catch (e) {
      lastError = `[${provider}] Fetch error: ${e.message}`;
      console.error(`[Proxy] Error with ${provider}:`, e);
    }
  }

  // Если все провайдеры отвалились
  return error(`All providers failed. Last error: ${lastError}`, 502);
}
