import { withCors, preflight, error } from './http.js';
import {
  getFeed, getMe, updateMe, getMyGames, checkRegistered, register, submitGame, uploadImage, deleteGame,
  getGameById,
  toggleLike, toggleFollow, toggleBookmark, getUserProfile, getUserGames, play,
  adminPending, adminApprove, adminReject,
} from './routes.js';
import { githubOAuthStart, githubOAuthCallback } from './github-oauth.js';

export default {
  async fetch(req, env) {
    const origin = resolveCorsOrigin(req, env);

    if (req.method === 'OPTIONS') return preflight(origin);

    const url = new URL(req.url);
    const { pathname } = url;

    try {
      const resp = await route(req, env, pathname);
      return withCors(resp, origin);
    } catch (e) {
      console.error('unhandled', e);
      const msg = String(e?.message || e || 'internal').trim().slice(0, 240);
      return withCors(error(msg || 'internal', 500), origin);
    }
  },
};

function resolveCorsOrigin(req, env) {
  const requestOrigin = req.headers.get('origin') || '';
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin)) {
    return requestOrigin;
  }
  return env.FRONTEND_ORIGIN || '*';
}

async function route(req, env, pathname) {
  const m = req.method;

  // Health-check.
  if (pathname === '/' || pathname === '/api/health') {
    return new Response('ok', { status: 200 });
  }

  if (pathname === '/api/feed'   && m === 'GET')  return getFeed(req, env);
  if (pathname === '/api/me'     && m === 'GET')  return getMe(req, env);
  if (pathname === '/api/me'     && m === 'PATCH') return updateMe(req, env);
  if (pathname === '/api/me/games' && m === 'GET') return getMyGames(req, env);
  if (pathname === '/api/me/registered' && m === 'GET') return checkRegistered(req, env);
  if (pathname === '/api/register' && m === 'POST') return register(req, env);
  if (pathname === '/api/submit' && m === 'POST') return submitGame(req, env);
  if (pathname === '/api/upload-image' && m === 'POST') return uploadImage(req, env);
  if (pathname === '/api/auth/github/start' && m === 'GET') return githubOAuthStart(req, env);
  if (pathname === '/auth/github/callback' && m === 'GET') return githubOAuthCallback(req, env);

  let match;
  if ((match = pathname.match(/^\/api\/games\/([^/]+)$/))) {
    if (m === 'GET') return getGameById(req, env, match[1]);
    if (m === 'DELETE') return deleteGame(req, env, match[1]);
  }
  if ((match = pathname.match(/^\/api\/games\/([^/]+)\/like$/))) {
    if (m === 'POST' || m === 'DELETE') return toggleLike(req, env, match[1], m);
  }
  if ((match = pathname.match(/^\/api\/games\/([^/]+)\/bookmark$/))) {
    if (m === 'POST' || m === 'DELETE') return toggleBookmark(req, env, match[1], m);
  }
  if ((match = pathname.match(/^\/api\/games\/([^/]+)\/play$/))) {
    if (m === 'POST') return play(req, env, match[1]);
  }
  if ((match = pathname.match(/^\/api\/users\/([^/]+)$/))) {
    if (m === 'GET') return getUserProfile(req, env, match[1]);
  }
  if ((match = pathname.match(/^\/api\/users\/([^/]+)\/games$/))) {
    if (m === 'GET') return getUserGames(req, env, match[1]);
  }
  if ((match = pathname.match(/^\/api\/users\/([^/]+)\/follow$/))) {
    if (m === 'POST' || m === 'DELETE') return toggleFollow(req, env, match[1], m);
  }

  if (pathname === '/api/admin/pending' && m === 'GET') return adminPending(req, env);
  if ((match = pathname.match(/^\/api\/admin\/approve\/([^/]+)$/)) && m === 'POST') {
    return adminApprove(req, env, match[1]);
  }
  if ((match = pathname.match(/^\/api\/admin\/reject\/([^/]+)$/)) && m === 'POST') {
    return adminReject(req, env, match[1]);
  }

  return error('not found', 404);
}
