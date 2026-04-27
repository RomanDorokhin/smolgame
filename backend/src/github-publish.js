import { json, error, newId } from './http.js';
import { authenticate, upsertUser } from './auth.js';
import { decryptGithubToken } from './github-token-crypto.js';
import { githubClientSecret } from './github-oauth.js';
import { isMissingColumnError } from './db-errors.js';

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function ghHeaders(token) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'user-agent': 'SmolGame-Worker',
  };
}

async function ghJson(url, opts, token) {
  const r = await fetch(url, {
    ...opts,
    headers: { ...ghHeaders(token), ...opts.headers },
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = { message: text };
  }
  return { ok: r.ok, status: r.status, data };
}

/**
 * POST /api/github/publish-game
 * body: { files: [{ path: "index.html", content: "<!DOCTYPE..." }, ...] }
 * Creates public repo under user, pushes files, enables Pages, returns pages URL.
 */
export async function publishGameToGithub(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  await upsertUser(env.DB, user);

  let row;
  try {
    row = await env.DB.prepare(
      `SELECT github_login AS login, github_access_token_enc AS enc
         FROM users WHERE id = ?`
    ).bind(user.id).first();
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;
    row = await env.DB.prepare(`SELECT github_login AS login FROM users WHERE id = ?`).bind(user.id).first();
    if (row) row.enc = null;
  }

  if (!row?.login) {
    return error('Сначала привяжи GitHub (кнопка «Войти через GitHub»).', 403);
  }
  if (!row.enc) {
    return error(
      'На сервере не хранится токен GitHub (нужна миграция D1: колонка github_access_token_enc). Выполни в консоли D1 SQL из backend/migrations/0003_github_access_token.sql и снова войди через GitHub.',
      503
    );
  }

  const secret = githubClientSecret(env);
  const token = await decryptGithubToken(String(row.enc), secret);
  if (!token) {
    return error('Сессия GitHub устарела. Отвяжи и снова войди через GitHub.', 401);
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return error('invalid json');
  }

  const files = Array.isArray(body.files) ? body.files : [];
  if (files.length === 0) return error('Добавь хотя бы один файл (например index.html)');
  if (files.length > 20) return error('Не больше 20 файлов за раз');

  let total = 0;
  for (const f of files) {
    const path = String(f?.path || '').trim().replace(/^\/+/, '');
    const enc = String(f?.contentEncoding || 'utf8').toLowerCase() === 'base64' ? 'base64' : 'utf8';
    const content = f?.content != null ? String(f.content) : '';
    if (!path || path.includes('..')) return error('Некорректный путь файла: ' + path);
    if (!/^[a-zA-Z0-9._/-]+$/.test(path)) return error('Путь только латиница, цифры, /, ., _ : ' + path);
    if (enc === 'base64') {
      const pad = content.length % 4 === 0 ? 0 : 4 - (content.length % 4);
      const b64clean = content.replace(/\s/g, '') + '='.repeat(pad);
      try {
        const bin = atob(b64clean);
        total += bin.length;
      } catch (e) {
        return error('Некорректный base64 для файла: ' + path);
      }
    } else {
      total += new TextEncoder().encode(content).length;
    }
  }
  if (total > 2_500_000) return error('Суммарный размер файлов слишком большой (макс ~2.5 MB)');

  const owner = String(row.login);

  let repoName = '';
  let cr = { ok: false, status: 0, data: null };
  for (let attempt = 0; attempt < 6; attempt++) {
    const slug = newId()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 14);
    const repo = `smolgame-${slug || 'game'}-${attempt}`;
    cr = await ghJson(
      'https://api.github.com/user/repos',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: repo,
          description: 'Game published via SmolGame',
          private: false,
          auto_init: false,
        }),
      },
      token
    );
    if (cr.ok) {
      repoName = cr.data?.name || repo;
      break;
    }
    const msg = String(cr.data?.message || cr.data?.errors?.[0]?.message || '');
    const dup = cr.status === 422 && /already exists|name already/i.test(msg);
    if (dup && attempt < 5) continue;
    return error(msg.slice(0, 200) || 'create repo failed', cr.status >= 400 ? cr.status : 502);
  }
  const fullName = cr.data?.full_name || `${owner}/${repoName}`;

  for (const f of files) {
    const path = String(f.path).trim().replace(/^\/+/, '');
    const enc = String(f?.contentEncoding || 'utf8').toLowerCase() === 'base64' ? 'base64' : 'utf8';
    const content = String(f.content);
    let b64;
    if (enc === 'base64') {
      const pad = content.length % 4 === 0 ? 0 : 4 - (content.length % 4);
      b64 = content.replace(/\s/g, '') + '='.repeat(pad);
    } else {
      b64 = utf8ToBase64(content);
    }
    const put = await ghJson(
      `https://api.github.com/repos/${fullName}/contents/${encodeURIComponent(path)}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: `Add ${path}`,
          content: b64,
          branch: 'main',
        }),
      },
      token
    );
    if (!put.ok) {
      const msg = put.data?.message || 'upload failed';
      return error(`${path}: ${String(msg).slice(0, 180)}`, put.status >= 400 ? put.status : 502);
    }
  }

  const pages = await ghJson(
    `https://api.github.com/repos/${fullName}/pages`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        source: { branch: 'main', path: '/' },
      }),
    },
    token
  );

  if (!pages.ok && pages.status !== 409) {
    const msg = pages.data?.message || 'pages failed';
    return error(
      `Репозиторий создан, но GitHub Pages не включились: ${String(msg).slice(0, 160)}. Включи Pages вручную: Settings → Pages → main / root.`,
      502
    );
  }

  const pagesUrl = `https://${owner}.github.io/${repoName}/`;

  let probeOk = false;
  try {
    const head = await fetch(pagesUrl, { method: 'HEAD', redirect: 'follow' });
    probeOk = head.ok;
  } catch (e) {
    probeOk = false;
  }

  return json({
    ok: true,
    repo: fullName,
    pagesUrl,
    pagesReady: probeOk,
    hint: probeOk
      ? 'Страница открывается.'
      : 'Репозиторий и файлы на месте. Pages могут открыться через 1–3 минуты — обнови ссылку.',
  });
}
