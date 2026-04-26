// Клиент API. Шлёт Telegram initData в заголовке x-telegram-init-data,
// сервер сам проверяет подпись и определяет юзера.
//
// Меняй API_BASE на свой Worker URL (после первого деплоя).

const PROD_API_BASE = 'https://smolgame.dorokhin731.workers.dev';
const API_BASE = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://127.0.0.1:8787'
  : PROD_API_BASE;

function _initData() {
  try { return Telegram.WebApp.initData || ''; } catch (e) { return ''; }
}

async function apiFetch(path, { method = 'GET', body } = {}) {
  const headers = { 'x-telegram-init-data': _initData() };
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData) headers['content-type'] = 'application/json';

  const resp = await fetch(API_BASE + path, {
    method,
    headers,
    body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
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

  feed:         (params = {}) => {
    const q = new URLSearchParams();
    if (params.offset != null) q.set('offset', String(params.offset));
    if (params.limit != null) q.set('limit', String(params.limit));
    const qs = q.toString();
    return apiFetch('/api/feed' + (qs ? '?' + qs : ''));
  },
  me:           ()         => apiFetch('/api/me'),
  register:     (payload)  => apiFetch('/api/register', { method: 'POST', body: payload }),
  checkRegistered: ()      => apiFetch('/api/me/registered'),
  submit:       (payload)  => apiFetch('/api/submit', { method: 'POST', body: payload }),
  uploadImage:  (formData) => apiFetch('/api/upload-image', { method: 'POST', body: formData }),
  delete:       (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}`, { method: 'DELETE' }),

  like:         (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}/like`,   { method: 'POST' }),
  unlike:       (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}/like`,   { method: 'DELETE' }),
  bookmark:     (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}/bookmark`, { method: 'POST' }),
  unbookmark:   (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}/bookmark`, { method: 'DELETE' }),

  follow:       (authorId) => apiFetch(`/api/users/${encodeURIComponent(authorId)}/follow`, { method: 'POST' }),
  unfollow:     (authorId) => apiFetch(`/api/users/${encodeURIComponent(authorId)}/follow`, { method: 'DELETE' }),
  userProfile:  (userId)   => apiFetch(`/api/users/${encodeURIComponent(userId)}`),
  userGames:    (userId)   => apiFetch(`/api/users/${encodeURIComponent(userId)}/games`),

  play:         (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}/play`, { method: 'POST' }),

  admin: {
    pending:    ()         => apiFetch('/api/admin/pending'),
    approve:    (gameId)   => apiFetch(`/api/admin/approve/${encodeURIComponent(gameId)}`, { method: 'POST' }),
    reject:     (gameId)   => apiFetch(`/api/admin/reject/${encodeURIComponent(gameId)}`,  { method: 'POST' }),
    delete:     (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}`, { method: 'DELETE' }),
  },
};
