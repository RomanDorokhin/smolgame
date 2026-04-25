import { withCors, preflight, error } from './http.js';
import {
  getFeed, getMe, submitGame,
  toggleLike, toggleFollow, play,
  adminPending, adminApprove, adminReject,
} from './routes.js';

export default {
  async fetch(req, env) {
    const origin = env.FRONTEND_ORIGIN || '*';

    if (req.method === 'OPTIONS') return preflight(origin);

    const url = new URL(req.url);
    const { pathname } = url;

    try {
      const resp = await route(req, env, pathname);
      return withCors(resp, origin);
    } catch (e) {
      console.error('unhandled', e);
      return withCors(error('internal', 500), origin);
    }
  },
};

async function route(req, env, pathname) {
  const m = req.method;

  // Health-check.
  if (pathname === '/' || pathname === '/api/health') {
    return new Response('ok', { status: 200 });
  }

  if (pathname === '/api/feed'   && m === 'GET')  return getFeed(req, env);
  if (pathname === '/api/me'     && m === 'GET')  return getMe(req, env);
  if (pathname === '/api/submit' && m === 'POST') return submitGame(req, env);

  let match;
  if ((match = pathname.match(/^\/api\/games\/([^/]+)\/like$/))) {
    if (m === 'POST' || m === 'DELETE') return toggleLike(req, env, match[1], m);
  }
  if ((match = pathname.match(/^\/api\/games\/([^/]+)\/play$/))) {
    if (m === 'POST') return play(req, env, match[1]);
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
