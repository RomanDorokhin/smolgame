import fs from 'node:fs/promises';
import path from 'node:path';
import { json, error, newId } from './http.js';
import { authenticate, upsertUser } from './auth.js';

const GAMES_DIR = '/var/www/smolgame/games';
const BASE_URL = 'https://smolgame.ru/g/';

/**
 * Ранее POST /api/github/publish-game (теперь сохраняет на сервер локально)
 */
export async function publishGameToGithub(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);
  await upsertUser(env.DB, user);

  let body;
  try { body = await req.json(); } catch (e) { return error('invalid json'); }

  const rawTitle = body.gameTitle != null ? String(body.gameTitle).replace(/[\x00-\x1F\x7F]/g, '').trim() : '';
  const rawDesc = body.gameDescription != null ? String(body.gameDescription).replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  if (!rawTitle) return error('Укажи название игры перед сохранением.');

  const files = Array.isArray(body.files) ? body.files : [];
  if (files.length === 0) return error('Добавь хотя бы один файл (например index.html)');

  // Если передали repo, это ID игры для обновления. Иначе создаем новую.
  const isUpdate = !!body.repo;
  const gameId = isUpdate ? body.repo.split('/').filter(Boolean).pop() : newId();
  
  const gameDir = path.join(GAMES_DIR, gameId);
  
  try {
    await fs.mkdir(gameDir, { recursive: true });
  } catch (e) {
    console.error('Cannot create dir', e);
    return error('Не могу создать папку игры на сервере', 500);
  }

  for (const f of files) {
    const fpath = String(f.path).trim().replace(/^\/+/, '');
    if (!fpath || fpath.includes('..')) return error('Некорректный путь файла: ' + fpath);
    const content = String(f.content);
    const enc = String(f.contentEncoding || 'utf8').toLowerCase();
    
    const fullPath = path.join(gameDir, fpath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    if (enc === 'base64') {
      const b64clean = content.replace(/\s/g, '');
      await fs.writeFile(fullPath, Buffer.from(b64clean, 'base64'));
    } else {
      await fs.writeFile(fullPath, content, 'utf8');
    }
  }

  const pagesUrl = BASE_URL + gameId + '/';

  if (!isUpdate) {
    try {
      await env.DB.prepare(
        `INSERT INTO games (id, title, description, genre, genre_emoji, url, author_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'published')`
      ).bind(gameId, rawTitle, rawDesc, body.genre || 'AI Prototype', body.genreEmoji || '✨', pagesUrl, user.id).run();
    } catch (dbErr) {
      console.error('[publish] DB insert failed:', dbErr);
    }
  } else {
    // Обновляем метаданные
    try {
      await env.DB.prepare(
        `UPDATE games SET title = ?, description = ? WHERE id = ? AND author_id = ?`
      ).bind(rawTitle, rawDesc, gameId, user.id).run();
    } catch (e) {
      console.error('Update metadata failed', e);
    }
  }

  return json({
    ok: true,
    id: gameId,
    repo: gameId,
    pagesUrl,
    pagesReady: true,
    hint: 'Игра сохранена на сервере!',
  });
}

/**
 * Ранее GET /api/github/get-file
 */
export async function getGameFileFromGithub(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  const url = new URL(req.url);
  const repo = url.searchParams.get('repo');
  const fpath = url.searchParams.get('path') || 'index.html';

  if (!repo) return error('repo (gameId) query param is required');
  
  const gameId = repo.split('/').filter(Boolean).pop();
  if (!gameId || gameId.includes('..') || fpath.includes('..')) {
    return error('invalid path', 400);
  }

  const fullPath = path.join(GAMES_DIR, gameId, fpath);
  
  try {
    const content = await fs.readFile(fullPath, 'utf8');
    return json({
      path: fpath,
      sha: 'local',
      content: content
    });
  } catch (e) {
    return error('file not found on server', 404);
  }
}

/**
 * Ранее POST /api/github/update-file
 */
export async function updateGameFileOnGithub(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  let body;
  try { body = await req.json(); } catch (e) { return error('invalid json'); }

  const { repo, path: fpath, content } = body;
  if (!repo || !fpath || content == null) return error('repo, path, content are required');

  const gameId = repo.split('/').filter(Boolean).pop();
  if (!gameId || gameId.includes('..') || fpath.includes('..')) {
    return error('invalid path', 400);
  }

  const fullPath = path.join(GAMES_DIR, gameId, fpath);

  try {
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, String(content), 'utf8');
    return json({ ok: true, sha: 'local' });
  } catch (e) {
    console.error('File write error:', e);
    return error('file write failed on server', 500);
  }
}
