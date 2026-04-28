import { authenticate, upsertUser } from './auth.js';
import { json, error } from './http.js';
import { encryptGithubToken } from './github-token-crypto.js';
import { isMissingColumnError } from './db-errors.js';

const OAUTH_TTL_SEC = 600;

async function hmacSha256Base64Url(secret, message) {
  const enc = new TextEncoder();
  const keyRaw = await crypto.subtle.digest('SHA-256', enc.encode(String(secret || '')));
  const key = await crypto.subtle.importKey('raw', keyRaw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function utf8ToBase64Url(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(b64) {
  const pad = b64.length % 4 === 0 ? 0 : 4 - (b64.length % 4);
  const s = b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** state = base64url(JSON).sig — не зависит от D1 oauth_states (устраняет «Сессия истекла» без записи в БД). */
async function buildSignedGithubState(env, telegramUserId) {
  const secret = githubClientSecret(env);
  const now = Math.floor(Date.now() / 1000);
  const inner = JSON.stringify({ u: String(telegramUserId), exp: now + OAUTH_TTL_SEC });
  const payload = utf8ToBase64Url(inner);
  const sig = await hmacSha256Base64Url(secret, payload);
  return `${payload}.${sig}`;
}

async function verifySignedGithubState(env, state) {
  const secret = githubClientSecret(env);
  if (!secret || !state || typeof state !== 'string') return null;
  const dot = state.indexOf('.');
  if (dot < 1) return null;
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = await hmacSha256Base64Url(secret, payload);
  if (sig !== expected) return null;
  let obj;
  try {
    obj = JSON.parse(base64UrlToUtf8(payload));
  } catch (e) {
    return null;
  }
  const uid = obj?.u != null ? String(obj.u).trim() : '';
  const exp = Number(obj?.exp);
  if (!uid || !exp || Math.floor(Date.now() / 1000) > exp) return null;
  return uid;
}

function workerOrigin(req, env) {
  const base = String(env.GITHUB_OAUTH_REDIRECT_BASE || '').trim().replace(/\/$/, '');
  if (base) return base;
  return new URL(req.url).origin;
}

function redirect(url) {
  return Response.redirect(url, 302);
}

function countRunMeta(r) {
  if (!r || typeof r !== 'object') return 0;
  const m = r.meta;
  if (!m || typeof m !== 'object') return 0;
  const c = m.changes;
  if (typeof c === 'number' && c >= 0) return c;
  const w = m.rows_written;
  if (typeof w === 'number' && w >= 0) return w;
  return 0;
}

async function clearGithubBindingForUser(db, telegramUserId) {
  try {
    await db
      .prepare(
        `UPDATE users SET github_user_id = NULL, github_login = NULL, github_access_token_enc = NULL WHERE id = ?`
      )
      .bind(telegramUserId)
      .run();
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;
    try {
      await db
        .prepare(`UPDATE users SET github_user_id = NULL, github_login = NULL WHERE id = ?`)
        .bind(telegramUserId)
        .run();
    } catch (e2) {
      if (!isMissingColumnError(e2)) throw e2;
    }
  }
}

/**
 * GET /api/auth/github/start — JSON { url } для открытия в браузере (избегаем fetch-follow на GitHub).
 */
export function githubClientId(env) {
  const a = String(env.GITHUB_CLIENT_ID ?? '').trim();
  if (a) return a;
  return String(env.GITHUB_OAUTH_CLIENT_ID ?? '').trim();
}

export function githubClientSecret(env) {
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

  // Каждый запуск OAuth — заново: сбрасываем привязку для этого Telegram id (даже если тот же GitHub потом выберешь).
  await clearGithubBindingForUser(env.DB, user.id);

  const cs = githubClientSecret(env);
  if (!cs) {
    return error(
      'На Worker не задан секрет GITHUB_CLIENT_SECRET (GitHub OAuth App → Client secrets → скопировать в Cloudflare: wrangler secret put GITHUB_CLIENT_SECRET)',
      503
    );
  }

  const state = await buildSignedGithubState(env, user.id);

  const origin = workerOrigin(req, env);
  const redirectUri = `${origin}/auth/github/callback`;
  const u = new URL('https://github.com/login/oauth/authorize');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', state);
  u.searchParams.set('scope', 'read:user repo');

  return json({
    url: u.toString(),
    githubCallbackUrl: redirectUri,
  });
}

/**
 * GET /auth/github/callback — GitHub редиректит сюда; затем редирект в мини-апп.
 */
export async function githubOAuthCallback(req, env) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error');
  /** После OAuth редирект на страницу Worker — там рабочая ссылка t.me (GitHub Pages даёт «мёртвый» URL на десктопе). */
  const doneBase = `${workerOrigin(req, env)}/auth/github/done`;
  const back = qs => redirect(`${doneBase}${qs}`);

  if (err) return back(`?github=error&message=${encodeURIComponent(err)}`);

  if (!code || !state) {
    return back(`?github=error&message=${encodeURIComponent('Нет code или state')}`);
  }

  let tgUid = await verifySignedGithubState(env, state);

  if (!tgUid) {
    try {
      const rawState = await env.DB.prepare(
        `SELECT user_id FROM oauth_states WHERE id = ? AND expires_at > ?`
      ).bind(state, Math.floor(Date.now() / 1000)).first();
      const fromDb =
        rawState?.user_id ??
        rawState?.userId ??
        null;
      if (fromDb != null) tgUid = String(fromDb).trim();
    } catch (e) {
      /* oauth_states может отсутствовать */
    }
  }

  if (!tgUid) {
    console.error('githubOAuthCallback: invalid state', { stateLen: state?.length });
    return back(`?github=error&message=${encodeURIComponent('Сессия истекла — открой вход через GitHub снова из мини-аппа')}`);
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

  const enc = await encryptGithubToken(accessToken, githubClientSecret(env));
  if (!enc) {
    console.warn('githubOAuthCallback: encryptGithubToken returned empty (check GITHUB_CLIENT_SECRET on Worker)');
  }

  let wrote = 0;
  try {
    if (enc) {
      const r = await env.DB.prepare(
        `UPDATE users SET github_user_id = ?, github_login = ?, github_access_token_enc = ? WHERE id = ?`
      ).bind(ghId, ghLogin, enc, tgUid).run();
      wrote = countRunMeta(r);
    } else {
      const r = await env.DB.prepare(
        `UPDATE users SET github_user_id = ?, github_login = ? WHERE id = ?`
      ).bind(ghId, ghLogin, tgUid).run();
      wrote = countRunMeta(r);
    }
  } catch (e) {
    if (isMissingColumnError(e)) {
      const r = await env.DB.prepare(
        `UPDATE users SET github_user_id = ?, github_login = ? WHERE id = ?`
      ).bind(ghId, ghLogin, tgUid).run();
      wrote = countRunMeta(r);
    } else {
      throw e;
    }
  }

  if (!wrote) {
    try {
      await env.DB.prepare(`INSERT OR IGNORE INTO users (id) VALUES (?)`).bind(tgUid).run();
      const r2 = await env.DB.prepare(
        enc
          ? `UPDATE users SET github_user_id = ?, github_login = ?, github_access_token_enc = ? WHERE id = ?`
          : `UPDATE users SET github_user_id = ?, github_login = ? WHERE id = ?`
      )
        .bind(...(enc ? [ghId, ghLogin, enc, tgUid] : [ghId, ghLogin, tgUid]))
        .run();
      wrote = countRunMeta(r2);
    } catch (e2) {
      console.error('githubOAuthCallback retry upsert', e2);
    }
  }

  let verify = null;
  try {
    verify = await env.DB.prepare(`SELECT github_user_id AS g FROM users WHERE id = ?`)
      .bind(tgUid)
      .first();
  } catch (e) {
    /* ignore */
  }
  const verifyId = verify?.g ?? verify?.github_user_id ?? null;
  const linked = verifyId != null && String(verifyId) === String(ghId);

  if (!wrote && linked) {
    wrote = 1;
  }

  if (!wrote && !linked) {
    console.error('githubOAuthCallback: no row updated', { tgUid, ghId });
    const base = workerOrigin(req, env);
    return back(
      `?github=error&message=${encodeURIComponent(
        'GitHub вернулся, но запись в базу не прошла. В GitHub OAuth App укажи Callback: ' +
          base +
          '/auth/github/callback и снова «Войти через GitHub».'
      )}`
    );
  }

  try {
    await env.DB.prepare(`DELETE FROM oauth_states WHERE id = ?`).bind(state).run();
  } catch (e) {
    /* legacy table optional */
  }

  return back('?github=connected');
}

