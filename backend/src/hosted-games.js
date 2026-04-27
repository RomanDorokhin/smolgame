import { json, error, newId } from './http.js';
import { authenticate, upsertUser } from './auth.js';
import { isMissingColumnError } from './db-errors.js';
import { validateHostedGameFields } from './validators.js';

const MAX_HTML_BYTES = 1_800_000; // ~1.8 MB UTF-8
const R2_GAME_PREFIX = 'games-html';

function workerOrigin(req) {
  return new URL(req.url).origin;
}

/** GET /g/:gameId/ — отдать index.html игры из R2 (для iframe в ленте). */
export async function serveHostedGame(req, env, gameId) {
  if (!env.IMAGES) {
    return new Response('Game storage not configured', { status: 503 });
  }
  const id = String(gameId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!id) return new Response('Not found', { status: 404 });

  const key = `${R2_GAME_PREFIX}/${id}/index.html`;
  const obj = await env.IMAGES.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const html = await obj.text();
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=120',
    },
  });
}

function validateHtmlPayload(body) {
  const html = String(body?.html ?? '').trim();
  if (!html) return { error: 'Вставь HTML-код игры (целиком, с <!DOCTYPE html> или <html>)' };
  const lower = html.slice(0, 8000).toLowerCase();
  if (!lower.includes('<!doctype') && !lower.includes('<html')) {
    return { error: 'Похоже, это не HTML-страница. Нужен полный документ с <!DOCTYPE html> или <html>…' };
  }
  const enc = new TextEncoder();
  const bytes = enc.encode(html).length;
  if (bytes > MAX_HTML_BYTES) {
    return { error: `Слишком большой файл (${Math.round(bytes / 1024)} KB). Максимум ~${Math.round(MAX_HTML_BYTES / 1024)} KB.` };
  }

  const meta = validateHostedGameFields(body);
  if (meta.error) return { error: meta.error };

  return { ok: { ...meta.ok, html } };
}

/**
 * POST /api/submit-html-game — сохранить HTML в R2 и создать запись игры с url на этот Worker.
 */
export async function submitHtmlGame(req, env) {
  if (!env.IMAGES) {
    return error(
      'Файлы игр не настроены: в Cloudflare создай bucket R2, в Worker smolgame → Settings → Triggers → (или Bindings) подключи R2 с именем binding **IMAGES**, потом снова Deploy. Подробнее в README репозитория (раздел R2).',
      501
    );
  }

  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);
  if (!user.isPremium) {
    return error(
      'Загрузка HTML на SmolGame (хостинг в R2) доступна только премиум-аккаунтам. Остальным: вкладка «Ссылка» (свой GitHub Pages) или оформи премиум. Список PREMIUM_TG_IDS в настройках Worker.',
      403
    );
  }

  try {
    await upsertUser(env.DB, user);
  } catch (e) {
    console.error('submitHtmlGame upsertUser', e);
    return error('Не удалось обновить профиль в базе. Открой мини-апп из бота заново.', 500);
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return error('invalid json');
  }

  const parsed = validateHtmlPayload(body);
  if (parsed.error) return error(parsed.error);

  const { html, title, description, genre, genreEmoji, imageUrl } = parsed.ok;
  const gameId = newId();
  const key = `${R2_GAME_PREFIX}/${gameId}/index.html`;

  try {
    await env.IMAGES.put(key, html, {
      httpMetadata: { contentType: 'text/html; charset=utf-8' },
    });
  } catch (e) {
    console.error('submitHtmlGame R2 put', e);
    return error('Не удалось сохранить файл игры. Проверь R2 и квоту.', 500);
  }

  const playUrl = `${workerOrigin(req)}/g/${gameId}/`;
  const desc = description ?? '';
  const emoji = genreEmoji ?? '🎮';
  const img = imageUrl == null ? null : imageUrl;

  try {
    await env.DB.prepare(
      `INSERT INTO games (id, title, description, genre, genre_emoji, url, image_url, author_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(gameId, title, desc, genre, emoji, playUrl, img, user.id).run();
  } catch (e) {
    console.error('submitHtmlGame insert', e);
    try {
      await env.IMAGES.delete(key);
    } catch (del) { /* ignore */ }

    if (isMissingColumnError(e)) {
      try {
        await env.DB.prepare(
          `INSERT INTO games (id, title, description, genre, url, author_id, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')`
        ).bind(gameId, title, desc, genre, playUrl, user.id).run();
      } catch (e2) {
        console.error('submitHtmlGame legacy insert', e2);
        return error('Не удалось сохранить игру в базе.', 500);
      }
    } else {
      return error('Не удалось сохранить игру в базе.', 500);
    }
  }

  return json({ ok: true, id: gameId, url: playUrl, status: 'pending' });
}
