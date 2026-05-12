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
 */
export async function publishGameToGithub(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  await upsertUser(env.DB, user);

  let token = env.COMMITS_GITHUB_TOKEN;
  let owner = 'dorokhin731-commits';

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

    if (!row?.login || !row.enc) {
      return error('GitHub не привязан. Настрой COMMITS_GITHUB_TOKEN на сервере или войди через GitHub в профиле.', 403);
    }

    const secret = githubClientSecret(env);
    token = await decryptGithubToken(String(row.enc), secret);
    if (!token) {
      return error('Сессия GitHub устарела. Перепривяжи аккаунт.', 401);
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

  let repoDescription = rawDesc
    ? `${rawTitle} — ${rawDesc}`
    : `SmolGame: ${rawTitle}`;
  if (repoDescription.length > 350) {
    repoDescription = repoDescription.slice(0, 347) + '…';
  }

  const files = Array.isArray(body.files) ? body.files : [];
  if (files.length === 0) return error('Добавь хотя бы один файл.');

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
    if (cr.status === 422 && /already exists/i.test(msg) && attempt < 5) continue;
    return error(msg.slice(0, 200) || 'create repo failed', cr.status >= 400 ? cr.status : 502);
  }
  const fullName = cr.data?.full_name || `${owner}/${repoName}`;

  // 1. Create a Tree with all files
  const treeItems = files.map(f => ({
    path: String(f.path).trim().replace(/^\/+/, ''),
    mode: '100644',
    type: 'blob',
    content: String(f.content)
  }));

  const treeRes = await ghJson(
    `https://api.github.com/repos/${fullName}/git/trees`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tree: treeItems }),
    },
    token
  );

  if (!treeRes.ok) {
    return error(`Failed to create tree: ${treeRes.data?.message}`, 502);
  }

  // 2. Create a Commit
  const commitRes = await ghJson(
    `https://api.github.com/repos/${fullName}/git/commits`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: `Initial commit: ${rawTitle}`,
        tree: treeRes.data.sha,
      }),
    },
    token
  );

  if (!commitRes.ok) {
    return error(`Failed to create commit: ${commitRes.data?.message}`, 502);
  }

  // 3. Create/Update Ref (main)
  const refRes = await ghJson(
    `https://api.github.com/repos/${fullName}/git/refs/heads/main`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ref: 'refs/heads/main',
        sha: commitRes.data.sha,
      }),
    },
    token
  );

  if (!refRes.ok) {
    const patchRes = await ghJson(
      `https://api.github.com/repos/${fullName}/git/refs/heads/main`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sha: commitRes.data.sha, force: true }),
      },
      token
    );
    if (!patchRes.ok) {
      return error(`Failed to update ref: ${patchRes.data?.message}`, 502);
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
    return error('GitHub Pages не включились', 502);
  }

  let pagesUrl = `https://${owner.toLowerCase()}.github.io/${repoName.toLowerCase()}/`;
  const gameId = newId();
  
  try {
    await env.DB.prepare(
      `INSERT INTO games (id, title, description, genre, genre_emoji, url, author_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'published')`
    ).bind(gameId, rawTitle, rawDesc, body.genre || 'AI Prototype', body.genreEmoji || '✨', pagesUrl, user.id).run();
  } catch (dbErr) {
    console.error('[publish] DB insert failed:', dbErr);
  }

  return json({
    ok: true,
    id: gameId,
    repo: fullName,
    pagesUrl,
    pagesReady: false,
    hint: 'Репозиторий создан. Pages заработают через 1-2 минуты.',
  });
}

export async function getGameFileFromGithub(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  const url = new URL(req.url);
  const repo = url.searchParams.get('repo');
  const path = url.searchParams.get('path') || 'index.html';
  if (!repo) return error('repo required');

  let token = env.COMMITS_GITHUB_TOKEN;
  if (!token) {
    const row = await env.DB.prepare(`SELECT github_access_token_enc AS enc FROM users WHERE id = ?`).bind(user.id).first();
    if (row?.enc) {
      token = await decryptGithubToken(String(row.enc), githubClientSecret(env));
    }
  }
  if (!token) return error('token not found', 403);

  const res = await ghJson(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`, { method: 'GET' }, token);
  if (!res.ok) return error(res.data?.message || 'not found', res.status);

  const content = res.data.content ? atob(res.data.content.replace(/\s/g, '')) : '';
  return json({ path: res.data.path, sha: res.data.sha, content: decodeURIComponent(escape(content)) });
}

export async function updateGameFileOnGithub(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  const body = await req.json();
  const { repo, path, content, sha } = body;
  if (!repo || !path || !content) return error('missing fields');

  let token = env.COMMITS_GITHUB_TOKEN;
  if (!token) {
    const row = await env.DB.prepare(`SELECT github_access_token_enc AS enc FROM users WHERE id = ?`).bind(user.id).first();
    if (row?.enc) {
      token = await decryptGithubToken(String(row.enc), githubClientSecret(env));
    }
  }
  if (!token) return error('token not found', 403);

  const put = await ghJson(
    `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: `Update ${path}`, content: utf8ToBase64(content), sha, branch: 'main' }),
    },
    token
  );

  return put.ok ? json({ ok: true, sha: put.data?.content?.sha }) : error(put.data?.message || 'update failed', put.status);
}
