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

  let resp;
  try {
    resp = await fetch(API_BASE + path, {
      method,
      headers,
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (e) {
    const net = String(e?.message || e || '');
    const low = net.toLowerCase();
    const webkitBroke =
      low.includes('load failed') ||
      low.includes('failed to fetch') ||
      low.includes('network') ||
      low.includes('network connection was lost') ||
      low.includes('internet connection appears to be offline') ||
      low.includes('cancelled') ||
      low.includes('canceled');
    throw new Error(
      webkitBroke
        ? 'Сеть/WebView: не удалось связаться с API. Подожди минуту, выключи VPN, обнови мини-апп (закрой полностью). Если с телефона работает — обнови Worker: backend → git pull && npx wrangler deploy.'
        : 'Запрос не выполнился: ' + (net || 'ошибка сети')
    );
  }

  let data = null;
  try {
    data = await resp.json();
  } catch (e) {
    data = null;
  }

  // POST /api/upload-image должен вернуть JSON с imageUrl; иначе фронт «молча» шлёт игру без обложки.
  if (resp.ok && path === '/api/upload-image') {
    const u = data?.imageUrl;
    if (typeof u !== 'string' || !u.trim()) {
      const errText = typeof data?.error === 'string' ? data.error.trim() : '';
      throw new Error(
        errText ||
          'Сервер не вернул ссылку на файл. В Cloudflare у Worker: binding IMAGES на R2 и переменная PUBLIC_IMAGE_BASE_URL (публичный https://pub-….r2.dev, не S3 API).'
      );
    }
  }

  if (!resp.ok) {
    const raw = data?.error;
    let msg = (typeof raw === 'string' && raw.trim()) || resp.statusText || 'request failed';

    if (resp.status === 401) {
      const serverMsg = typeof raw === 'string' && raw.trim();
      msg =
        serverMsg ||
        'Вход из Telegram не подтверждён. Открой только из бота. Если из бота — токен на Worker должен быть от ЭТОГО бота: npx wrangler secret put TELEGRAM_BOT_TOKEN';
    } else if (resp.status === 404) {
      const low = String(msg || '').toLowerCase();
      if (!raw || low === 'not found' || low === 'request failed') {
        msg =
          'На Worker нет этого API (404). Чаще всего не задеплоена последняя версия: в папке backend выполни git pull и npm run deploy.';
      }
    } else if (resp.status === 409) {
      // оставляем текст от API (например профиль в БД)
    } else if (resp.status === 503) {
      const serverMsg = typeof raw === 'string' && raw.trim();
      if (serverMsg) msg = serverMsg;
    } else {
      const vague =
        !raw ||
        String(raw).trim() === '' ||
        String(raw).toLowerCase() === 'internal';
      if (vague && (resp.status >= 500 || String(msg).toLowerCase() === 'internal')) {
        msg =
          'Не сохранилось (ошибка ' +
          resp.status +
          '). Ссылка на игру тут ни при чём — смотри Cloudflare → Workers → smolgame → Logs. Обнови Worker: git pull && npx wrangler deploy';
      }
    }
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
  updateMe:     (payload)  => apiFetch('/api/me', { method: 'PATCH', body: payload }),
  myGames:      ()         => apiFetch('/api/me/games'),
  gamesLibrary: ()         => apiFetch('/api/me/games-library'),
  likedGames:   ()         => apiFetch('/api/me/liked-games'),
  playedGames:  ()         => apiFetch('/api/me/played-games'),
  game:         (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}`),
  gameReviews:  (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}/reviews`),
  postGameReview: (gameId, payload) =>
    apiFetch(`/api/games/${encodeURIComponent(gameId)}/reviews`, { method: 'POST', body: payload }),
  register:     (payload)  => apiFetch('/api/register', { method: 'POST', body: payload }),
  checkRegistered: ()      => apiFetch('/api/me/registered'),
  submit:       (payload)  => apiFetch('/api/submit', { method: 'POST', body: payload }),
  githubPublishGame: (payload) => apiFetch('/api/github/publish-game', { method: 'POST', body: payload }),
  uploadImage:  (formData) => apiFetch('/api/upload-image', { method: 'POST', body: formData }),
  delete:       (gameId, opts) =>
    apiFetch(`/api/games/${encodeURIComponent(gameId)}`, {
      method: 'DELETE',
      body: opts && typeof opts === 'object' ? opts : undefined,
    }),
  updateGame:   (gameId, payload) =>
    apiFetch(`/api/games/${encodeURIComponent(gameId)}`, { method: 'PATCH', body: payload }),

  like:         (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}/like`,   { method: 'POST' }),
  unlike:       (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}/like`,   { method: 'DELETE' }),
  bookmark:     (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}/bookmark`, { method: 'POST' }),
  unbookmark:   (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}/bookmark`, { method: 'DELETE' }),

  follow:       (authorId) => apiFetch(`/api/users/${encodeURIComponent(authorId)}/follow`, { method: 'POST' }),
  unfollow:     (authorId) => apiFetch(`/api/users/${encodeURIComponent(authorId)}/follow`, { method: 'DELETE' }),
  userProfile:  (userId)   => apiFetch(`/api/users/${encodeURIComponent(userId)}`),
  userGames:    (userId)   => apiFetch(`/api/users/${encodeURIComponent(userId)}/games`),

  play:         (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}/play`, { method: 'POST' }),

  githubOAuthStart: () => apiFetch('/api/auth/github/start'),
  githubUnlink: () => apiFetch('/api/auth/github/unlink', { method: 'POST' }),

  admin: {
    pending:    ()         => apiFetch('/api/admin/pending'),
    approve:    (gameId)   => apiFetch(`/api/admin/approve/${encodeURIComponent(gameId)}`, { method: 'POST' }),
    reject:     (gameId)   => apiFetch(`/api/admin/reject/${encodeURIComponent(gameId)}`,  { method: 'POST' }),
    delete:     (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}`, { method: 'DELETE' }),
  },
};
