// Клиент API. Шлёт Telegram initData в заголовке x-telegram-init-data,
// сервер сам проверяет подпись и определяет юзера.
//
// Меняй API_BASE на свой Worker URL (после первого деплоя).

const API_BASE = 'https://smolgame.dorokhin731.workers.dev';

function _initData() {
  try { return Telegram.WebApp.initData || ''; } catch (e) { return ''; }
}

async function apiFetch(path, { method = 'GET', body } = {}) {
  const headers = { 'x-telegram-init-data': _initData() };
  if (body !== undefined) headers['content-type'] = 'application/json';

  const resp = await fetch(API_BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await resp.json(); } catch (e) {}
  if (!resp.ok) {
    const msg = data?.error || resp.statusText || 'request failed';
    throw new Error(msg);
  }
  return data;
}

window.API = {
  base: API_BASE,

  feed:         ()         => apiFetch('/api/feed'),
  me:           ()         => apiFetch('/api/me'),
  submit:       (payload)  => apiFetch('/api/submit', { method: 'POST', body: payload }),

  like:         (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}/like`,   { method: 'POST' }),
  unlike:       (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}/like`,   { method: 'DELETE' }),

  follow:       (authorId) => apiFetch(`/api/users/${encodeURIComponent(authorId)}/follow`, { method: 'POST' }),
  unfollow:     (authorId) => apiFetch(`/api/users/${encodeURIComponent(authorId)}/follow`, { method: 'DELETE' }),

  play:         (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}/play`, { method: 'POST' }),

  admin: {
    pending:    ()         => apiFetch('/api/admin/pending'),
    approve:    (gameId)   => apiFetch(`/api/admin/approve/${encodeURIComponent(gameId)}`, { method: 'POST' }),
    reject:     (gameId)   => apiFetch(`/api/admin/reject/${encodeURIComponent(gameId)}`,  { method: 'POST' }),
  },
};
