import http from 'http';
import api from './index.js';
import { D1DatabaseMock } from './sqlite-d1.js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Подгружаем .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PORT = 3001;

// Инициализируем локальную SQLite БД
const dbPath = path.join(__dirname, '..', 'smolgame.db');
const db = new D1DatabaseMock(dbPath);

// Собираем env для совместимости с Cloudflare Workers
const env = {
  DB: db,
  JWT_SECRET: process.env.JWT_SECRET,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'https://smolgame.ru',
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  // Добавь сюда любые другие переменные, которые нужны из .env
};

// Запускаем HTTP сервер
const server = http.createServer(async (req, res) => {
  try {
    // Оборачиваем базовый Node.js req в объект Request (Web API)
    const host = req.headers.host || 'localhost:3001';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const url = new URL(req.url, `${protocol}://${host}`);
    
    // Считываем тело запроса (если есть)
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const bodyBuffer = Buffer.concat(chunks);
    const body = bodyBuffer.length > 0 ? bodyBuffer : undefined;

    // Конвертируем заголовки в Web API Headers
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v));
      } else if (value !== undefined) {
        headers.set(key, value);
      }
    }

    const webReq = new Request(url.href, {
      method: req.method,
      headers: headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
    });

    // Вызываем Cloudflare Worker fetch функцию
    const response = await api.fetch(webReq, env, {});

    // Отправляем ответ обратно
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (response.body) {
      // ReadableStream (Web) -> Readable (Node.js)
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.end();
    }
  } catch (e) {
    console.error('HTTP Server Error:', e);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server starting on port ${PORT} (IPv4)`);
});
