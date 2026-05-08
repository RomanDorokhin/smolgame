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
 * body: {
 *   files: [{ path: "index.html", content: "<!DOCTYPE..." }, ...],
 *   gameTitle?: string,
 *   gameDescription?: string,
 * }
 * Creates public repo under user, pushes files, enables Pages, returns pages URL.
 */
export async function publishGameToGithub(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  await upsertUser(env.DB, user);

  let token = env.COMMITS_GITHUB_TOKEN;
  let owner = 'orokhin731-commits';

  if (!token) {
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
      return error('Сначала привяжи GitHub (кнопка «Войти через GitHub») или настрой COMMITS_GITHUB_TOKEN на сервере.', 403);
    }
    if (!row.enc) {
      return error(
        'На сервере не хранится токен GitHub (нужна миграция D1: колонка github_access_token_enc). Выполни в консоли D1 SQL из backend/migrations/0003_github_access_token.sql и снова войди через GitHub.',
        503
      );
    }

    const secret = githubClientSecret(env);
    token = await decryptGithubToken(String(row.enc), secret);
    if (!token) {
      return error('Сессия GitHub устарела. Отвяжи и снова войди через GitHub.', 401);
    }
    owner = String(row.login);
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return error('invalid json');
  }

  const rawTitle = body.gameTitle != null ? String(body.gameTitle).replace(/[\x00-\x1F\x7F]/g, '').trim() : '';
  const rawDesc = body.gameDescription != null ? String(body.gameDescription).replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  if (!rawTitle) return error('Укажи название игры перед созданием репозитория.');
  if (rawTitle.length > 120) return error('Название игры слишком длинное (макс 120 символов).');

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
    let fileSize = 0;
    if (enc === 'base64') {
      const pad = content.length % 4 === 0 ? 0 : 4 - (content.length % 4);
      const b64clean = content.replace(/\s/g, '') + '='.repeat(pad);
      try {
        const bin = atob(b64clean);
        fileSize = bin.length;
      } catch (e) {
        return error('Некорректный base64 для файла: ' + path);
      }
    } else {
      fileSize = new TextEncoder().encode(content).length;
    }

    if (fileSize > 1_500_000) {
      return error(`Файл ${path} слишком большой (макс. 1.5 МБ для одного файла)`);
    }
    total += fileSize;
  }
  if (total > 5_000_000) return error('Суммарный размер файлов слишком большой (макс 5 MB)');

  // owner is already set either to 'orokhin731-commits' or user's login.

  let repoDescription = rawDesc
    ? `${rawTitle} — ${rawDesc}`
    : `SmolGame: ${rawTitle}`;
  if (repoDescription.length > 350) {
    repoDescription = repoDescription.slice(0, 347) + '…';
  }

  let repoName = '';
  let cr = { ok: false, status: 0, data: null };
  for (let attempt = 0; attempt < 10; attempt++) {
    const slug = (Date.now().toString(36) + newId().toLowerCase().replace(/[^a-z0-9]/g, ''))
      .slice(0, 16);
    const repo = `smolgame-${slug || 'game'}`;
    cr = await ghJson(
      'https://api.github.com/user/repos',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: repo,
          description: repoDescription,
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
    const msg = String(cr.data?.message || '');
    const errors = Array.isArray(cr.data?.errors) ? cr.data.errors.map(e => e.message).join(', ') : '';
    const fullMsg = errors ? `${msg}: ${errors}` : msg;
    const dup = cr.status === 422 && /already exists|name already/i.test(fullMsg);
    if (dup && attempt < 5) continue;
    return error(fullMsg.slice(0, 200) || 'create repo failed', cr.status >= 400 ? cr.status : 502);
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
      `https://api.github.com/repos/${fullName}/contents/${path.split('/').map(encodeURIComponent).join('/')}`,
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

  /** Канонический URL из API GitHub (учёт регистра и формата), иначе собираем сами. */
  let pagesUrl = '';
  const pagesMeta = await ghJson(`https://api.github.com/repos/${fullName}/pages`, { method: 'GET' }, token);
  if (pagesMeta.ok && pagesMeta.data?.html_url) {
    try {
      const u = new URL(String(pagesMeta.data.html_url));
      u.protocol = 'https:';
      let path = u.pathname || '/';
      if (!path.endsWith('/')) path += '/';
      pagesUrl = `${u.origin}${path}`;
    } catch (e) {
      pagesUrl = '';
    }
  }
  if (!pagesUrl) {
    const own = String(owner).toLowerCase();
    const rn = String(repoName).toLowerCase();
    pagesUrl = `https://${own}.github.io/${rn}/`;
  }

  let probeOk = false;
  try {
    const head = await fetch(pagesUrl, { method: 'HEAD', redirect: 'follow' });
    probeOk = head.ok;
  } catch (e) {
    probeOk = false;
  }

  const gameId = newId();
  try {
    // Record the game in our database so it's linked to the user
    await env.DB.prepare(
      `INSERT INTO games (id, title, description, genre, genre_emoji, url, author_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'published')`
    ).bind(
      gameId, 
      rawTitle, 
      rawDesc, 
      body.genre || 'AI Prototype', 
      body.genreEmoji || '✨', 
      pagesUrl, 
      user.id
    ).run();
  } catch (dbErr) {
    console.error('[publish] DB insert failed:', dbErr);
    // We don't return error here because the repo was already created successfully
  }

  return json({
    ok: true,
    id: gameId,
    repo: fullName,
    pagesUrl,
    pagesReady: probeOk,
    hint: probeOk
      ? 'Страница открывается.'
      : 'Репозиторий и файлы на месте. Pages могут открыться через 1–3 минуты — обнови ссылку.',
  });
}

/**
 * GET /api/github/get-file?repo=...&path=index.html
 * Fetches content of a file from a repository.
 */
export async function getGameFileFromGithub(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  const url = new URL(req.url);
  const repo = url.searchParams.get('repo'); // e.g. "owner/repo"
  const path = url.searchParams.get('path') || 'index.html';

  if (!repo) return error('repo query param is required');

  // Use global token if available, else user's token
  let token = env.COMMITS_GITHUB_TOKEN;
  if (!token) {
    const row = await env.DB.prepare(`SELECT github_access_token_enc AS enc FROM users WHERE id = ?`).bind(user.id).first();
    if (row?.enc) {
      const secret = githubClientSecret(env);
      token = await decryptGithubToken(String(row.enc), secret);
    }
  }

  if (!token) return error('GitHub token not found', 403);

  const res = await ghJson(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`, { method: 'GET' }, token);
  if (!res.ok) return error(res.data?.message || 'file not found', res.status);

  // GitHub returns base64
  const content = res.data.content ? atob(res.data.content.replace(/\s/g, '')) : '';
  const utf8Content = decodeURIComponent(escape(content)); // Correctly handle UTF-8

  return json({
    path: res.data.path,
    sha: res.data.sha,
    content: utf8Content
  });
}

/**
 * POST /api/github/update-file
 * body: { repo, path, content, sha, message }
 * Updates a file in an existing repository.
 */
export async function updateGameFileOnGithub(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  let body;
  try { body = await req.json(); } catch (e) { return error('invalid json'); }

  const { repo, path, content, sha, message } = body;
  if (!repo || !path || !content) return error('repo, path, content are required');

  let token = env.COMMITS_GITHUB_TOKEN;
  if (!token) {
    const row = await env.DB.prepare(`SELECT github_access_token_enc AS enc FROM users WHERE id = ?`).bind(user.id).first();
    if (row?.enc) {
      const secret = githubClientSecret(env);
      token = await decryptGithubToken(String(row.enc), secret);
    }
  }

  if (!token) return error('GitHub token not found', 403);

  const b64 = utf8ToBase64(content);
  const put = await ghJson(
    `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: message || `Update ${path}`,
        content: b64,
        sha: sha, // Required for updates
        branch: 'main',
      }),
    },
    token
  );

  if (!put.ok) {
    return error(put.data?.message || 'update failed', put.status);
  }

  return json({ ok: true, sha: put.data?.content?.sha });
}
