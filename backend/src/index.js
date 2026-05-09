import { withCors, preflight, error } from './http.js';
import {
  getFeed, getMe, updateMe, deleteAccount, githubUnlink, getMyGames, getLikedGames, getPlayedGames, getMyGamesLibraryBatch, checkRegistered, register, submitGame, uploadImage, deleteGame,
  getGameById, updateGameListing, listGameReviews, postGameReview, updateGameReview, deleteGameReview,
  toggleLike, toggleFollow, toggleBookmark, getUserProfile, getUserGames, play,
  adminPending, adminApprove, adminReject,
  listUserPosts, createUserPost, deleteUserPost,
  getActivity, markActivityRead, logRepost
} from './routes.js';
import { githubOAuthStart, githubOAuthCallback } from './github-oauth.js';
import { githubOAuthDonePage } from './github-oauth-done.js';
import { submitHtmlGame, serveHostedGame } from './hosted-games.js';
import { publishGameToGithub, getGameFileFromGithub, updateGameFileOnGithub } from './github-publish.js';
import { telegramWebhook } from './telegram-webhook.js';
import { handleAiChat } from './ai-proxy.js';
import { generateOpenGame, proxyOpenGameLLM } from './opengame-proxy.js';

export default {
  async fetch(req, env, ctx) {
    const origin = resolveCorsOrigin(req, env);

    if (req.method === 'OPTIONS') return preflight(origin);

    // Добавляем ctx в объект запроса, чтобы он был доступен в маршрутах
    req.ctx = ctx;

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

function isAllowedMiniAppOrigin(originHeader) {
  const raw = String(originHeader || '').trim();
  if (!raw || !/^https:\/\//i.test(raw)) return false;
  try {
    const { hostname } = new URL(raw);
    const h = hostname.toLowerCase();
    if (h === 't.me' || h.endsWith('.t.me')) return true;
    if (h === 'telegram.org' || h.endsWith('.telegram.org')) return true;
    if (h === 'telegram.dog' || h.endsWith('.telegram.dog')) return true;
    if (h.endsWith('.github.io') || h.endsWith('.github.dev')) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * CORS для мини-аппа: Origin у Telegram/WebView разный (github.io, web.telegram.org, пустой, буквально "null").
 * Пустой / "null" → только `*` (echo FRONTEND_ORIGIN ломает preflight).
 * Неизвестный https-origin → `*` (аутентификация всё равно по x-telegram-init-data).
 */
function resolveCorsOrigin(req, env) {
  const requestOrigin = req.headers.get('origin') || '';
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin)) {
    return requestOrigin;
  }
  const configured = String(env.FRONTEND_ORIGIN || '').trim().replace(/\/$/, '');
  const raw = String(requestOrigin).trim();
  const reqNorm = raw.replace(/\/$/, '');
  if (!raw || raw.toLowerCase() === 'null') return '*';
  if (configured && reqNorm === configured) return requestOrigin || configured;
  if (isAllowedMiniAppOrigin(requestOrigin)) return requestOrigin;
  return '*';
}

async function route(req, env, pathname) {
  const m = req.method;

  // Health-check.
  if (pathname === '/' || pathname === '/api/health') {
    return new Response('ok', { status: 200 });
  }

  const hostedMatch = pathname.match(/^\/g\/([^/]+)\/?$/);
  if (hostedMatch && m === 'GET') {
    return serveHostedGame(req, env, hostedMatch[1]);
  }

  if (pathname === '/api/feed'   && m === 'GET')  return getFeed(req, env);
  if (pathname === '/api/me'     && m === 'GET')  return getMe(req, env);
  if (pathname === '/api/me'     && m === 'PATCH') return updateMe(req, env);
  if (pathname === '/api/me'     && m === 'DELETE') return deleteAccount(req, env);
  if (pathname === '/api/me/games' && m === 'GET') return getMyGames(req, env);
  if (pathname === '/api/me/liked-games' && m === 'GET') return getLikedGames(req, env);
  if (pathname === '/api/me/played-games' && m === 'GET') return getPlayedGames(req, env);
  if (pathname === '/api/me/games-library' && m === 'GET') return getMyGamesLibraryBatch(req, env);
  if (pathname === '/api/me/registered' && m === 'GET') return checkRegistered(req, env);
  if (pathname === '/api/me/activity' && m === 'GET') return getActivity(req, env);
  if (pathname === '/api/me/activity/read' && m === 'POST') return markActivityRead(req, env);
  if (pathname === '/api/telegram/webhook' && m === 'POST') return telegramWebhook(req, env);
  if (pathname === '/api/register' && m === 'POST') return register(req, env);
  if (pathname === '/api/submit' && m === 'POST') return submitGame(req, env);
  if (pathname === '/api/submit-html-game' && m === 'POST') return submitHtmlGame();
  if (pathname === '/api/github/publish-game' && m === 'POST') return publishGameToGithub(req, env);
  if (pathname === '/api/github/get-file' && m === 'GET') return getGameFileFromGithub(req, env);
  if (pathname === '/api/github/update-file' && m === 'POST') return updateGameFileOnGithub(req, env);
  if (pathname === '/api/upload-image' && m === 'POST') return uploadImage(req, env);
  if (pathname === '/api/auth/github/start' && m === 'GET') return githubOAuthStart(req, env);
  if (pathname === '/api/auth/github/unlink' && m === 'POST') return githubUnlink(req, env);
  if (pathname === '/auth/github/callback' && m === 'GET') return githubOAuthCallback(req, env);
  if (pathname === '/auth/github/done' && m === 'GET') return githubOAuthDonePage(req, env);
  if (pathname === '/api/ai/chat' && m === 'POST') return handleAiChat(req, env);
  if (pathname === '/api/opengame/generate' && m === 'POST') return generateOpenGame(req, env);
  if (pathname === '/api/llm-proxy/chat/completions' && m === 'POST') return proxyOpenGameLLM(req, env);

  let match;
  if ((match = pathname.match(/^\/api\/games\/([^/]+)$/))) {
    if (m === 'GET') return getGameById(req, env, match[1]);
    if (m === 'PATCH') return updateGameListing(req, env, match[1]);
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
  if ((match = pathname.match(/^\/api\/games\/([^/]+)\/repost$/))) {
    if (m === 'POST') return logRepost(req, env, match[1]);
  }
  if ((match = pathname.match(/^\/api\/games\/([^/]+)\/reviews$/))) {
    if (m === 'GET') return listGameReviews(req, env, match[1]);
    if (m === 'POST') return postGameReview(req, env, match[1]);
  }
  if ((match = pathname.match(/^\/api\/reviews\/([^/]+)$/))) {
    if (m === 'PATCH') return updateGameReview(req, env, match[1]);
    if (m === 'DELETE') return deleteGameReview(req, env, match[1]);
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

  if ((match = pathname.match(/^\/api\/users\/([^/]+)\/posts$/)) && m === 'GET') {
    return listUserPosts(req, env, match[1]);
  }
  if (pathname === '/api/posts' && m === 'POST') return createUserPost(req, env);
  if ((match = pathname.match(/^\/api\/posts\/([^/]+)$/)) && m === 'DELETE') {
    return deleteUserPost(req, env, match[1]);
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
