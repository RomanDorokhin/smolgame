import { authenticate, upsertUser } from './auth.js';
import { json, error, newId } from './http.js';

const OAUTH_TTL_SEC = 600;

function workerOrigin(req, env) {
  const base = String(env.GITHUB_OAUTH_REDIRECT_BASE || '').trim().replace(/\/$/, '');
  if (base) return base;
  return new URL(req.url).origin;
}

function redirect(url) {
  return Response.redirect(url, 302);
}

/**
 * GET /api/auth/github/start — JSON { url } для открытия в браузере (избегаем fetch-follow на GitHub).
 */
function githubClientId(env) {
  const a = String(env.GITHUB_CLIENT_ID ?? '').trim();
  if (a) return a;
  return String(env.GITHUB_OAUTH_CLIENT_ID ?? '').trim();
}

function githubClientSecret(env) {
  const a = String(env.GITHUB_CLIENT_SECRET ?? '').trim();
  if (a) return a;
  return String(env.GITHUB_OAUTH_CLIENT_SECRET ?? '').trim();
}

export async function githubOAuthStart(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  const clientId = githubClientId(env);
  if (!clientId) {
    return error(
      'GitHub OAuth: на Worker не задан GITHUB_CLIENT_ID. Cloudflare → Workers → smolgame → Settings → Variables: добавь GITHUB_CLIENT_ID (публичный) и секрет GITHUB_CLIENT_SECRET. Callback в GitHub OAuth App: <WORKER_URL>/auth/github/callback',
      503
    );
  }

  await upsertUser(env.DB, user);

  const state = newId() + newId();
  const now = Math.floor(Date.now() / 1000);
  const expires = now + OAUTH_TTL_SEC;

  await env.DB.prepare(
    `INSERT INTO oauth_states (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
  ).bind(state, user.id, now, expires).run();

  const origin = workerOrigin(req, env);
  const redirectUri = `${origin}/auth/github/callback`;
  const u = new URL('https://github.com/login/oauth/authorize');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', state);
  u.searchParams.set('scope', 'read:user');

  return json({ url: u.toString() });
}

/**
 * GET /auth/github/callback — GitHub редиректит сюда; затем редирект в мини-апп.
 */
export async function githubOAuthCallback(req, env) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error');
  const originBase = String(env.FRONTEND_ORIGIN || '').replace(/\/$/, '');
  const appPath = String(env.GITHUB_APP_PATH || '/smolgame').replace(/\/$/, '');
  const pathPrefix = appPath.startsWith('/') ? appPath : `/${appPath}`;
  const appRoot = `${originBase}${pathPrefix}/`;

  const back = qs => redirect(`${appRoot.replace(/\/?$/, '/')}${qs}`);

  if (err) return back(`?github=error&message=${encodeURIComponent(err)}`);

  if (!code || !state) {
    return back(`?github=error&message=${encodeURIComponent('Нет code или state')}`);
  }

  const row = await env.DB.prepare(
    `SELECT user_id AS userId FROM oauth_states WHERE id = ? AND expires_at > ?`
  ).bind(state, Math.floor(Date.now() / 1000)).first();

  if (!row?.userId) {
    return back(`?github=error&message=${encodeURIComponent('Сессия истекла — попробуй снова')}`);
  }

  const clientId = githubClientId(env);
  const clientSecret = githubClientSecret(env);
  if (!clientId || !clientSecret) {
    return back(
      `?github=error&message=${encodeURIComponent('OAuth: нет GITHUB_CLIENT_ID или GITHUB_CLIENT_SECRET на Worker')}`
    );
  }

  const origin = workerOrigin(req, env);
  const redirectUri = `${origin}/auth/github/callback`;

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenJson = await tokenRes.json().catch(() => ({}));
  const accessToken = tokenJson.access_token;
  if (!accessToken) {
    return back(`?github=error&message=${encodeURIComponent(
      tokenJson.error_description || tokenJson.error || 'Нет токена'
    )}`);
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${accessToken}`,
      'user-agent': 'SmolGame-Worker',
    },
  });

  const gh = await userRes.json().catch(() => null);
  if (!gh?.id) {
    return back(`?github=error&message=${encodeURIComponent('Не удалось прочитать профиль GitHub')}`);
  }

  const ghId = String(gh.id);
  const ghLogin = String(gh.login || '').slice(0, 39) || null;

  const other = await env.DB.prepare(
    `SELECT id FROM users WHERE github_user_id = ? AND id <> ?`
  ).bind(ghId, row.userId).first();

  if (other) {
    return back(`?github=error&message=${encodeURIComponent('Этот GitHub уже привязан к другому аккаунту')}`);
  }

  await env.DB.prepare(
    `UPDATE users SET github_user_id = ?, github_login = ? WHERE id = ?`
  ).bind(ghId, ghLogin, row.userId).run();

  await env.DB.prepare(`DELETE FROM oauth_states WHERE id = ?`).bind(state).run();

  return back('?github=connected');
}

