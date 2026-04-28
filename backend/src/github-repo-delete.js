/**
 * Удаление репозитория GitHub Pages по URL игры (для автора с сохранённым OAuth-токеном).
 */
import { decryptGithubToken } from './github-token-crypto.js';
import { githubClientSecret } from './github-oauth.js';
import { isMissingColumnError } from './db-errors.js';

function ghHeaders(token) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'user-agent': 'SmolGame-Worker',
  };
}

/** https://owner.github.io/repoName/... → { owner, repo } */
export function parseGithubPagesRepo(urlStr) {
  try {
    const u = new URL(String(urlStr || '').trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = u.hostname.toLowerCase();
    const m = /^([a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38})\.github\.io$/i.exec(host);
    if (!m) return null;
    const owner = m[1];
    let path = u.pathname.replace(/^\/+|\/+$/g, '');
    if (!path) return null;
    const seg = path.split('/').filter(Boolean)[0];
    if (!seg || !/^[a-zA-Z0-9._-]+$/.test(seg)) return null;
    return { owner, repo: seg };
  } catch {
    return null;
  }
}

/**
 * Удаляет репо на GitHub, если URL — github.io, владелец репо = github_login пользователя, есть токен.
 * @returns {{ ok: true } | { ok: false, error: string, status?: number }}
 */
export async function tryDeleteGithubRepoForAuthor(env, authorId, gameUrl) {
  const parsed = parseGithubPagesRepo(gameUrl);
  if (!parsed) {
    return { ok: false, error: 'not_github_pages' };
  }

  let row;
  try {
    row = await env.DB.prepare(
      `SELECT github_login AS login, github_access_token_enc AS enc
         FROM users WHERE id = ?`
    )
      .bind(authorId)
      .first();
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;
    row = await env.DB.prepare(`SELECT github_login AS login FROM users WHERE id = ?`)
      .bind(authorId)
      .first();
    if (row) row.enc = null;
  }

  const login = String(row?.login || '').trim().toLowerCase();
  if (!login) {
    return { ok: false, error: 'github_not_linked' };
  }
  if (login !== String(parsed.owner).toLowerCase()) {
    return { ok: false, error: 'repo_not_owned' };
  }
  if (!row?.enc) {
    return { ok: false, error: 'no_token' };
  }

  const secret = githubClientSecret(env);
  const token = await decryptGithubToken(String(row.enc), secret);
  if (!token) {
    return { ok: false, error: 'token_invalid' };
  }

  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`;
  const r = await fetch(apiUrl, { method: 'DELETE', headers: ghHeaders(token) });
  if (r.status === 204 || r.status === 404) {
    return { ok: true };
  }
  let detail = '';
  try {
    const j = await r.json();
    detail = String(j?.message || j?.errors?.[0]?.message || '').slice(0, 200);
  } catch {
    detail = await r.text().catch(() => '');
  }
  return {
    ok: false,
    error: detail || `github ${r.status}`,
    status: r.status,
  };
}
