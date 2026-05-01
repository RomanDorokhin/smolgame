// Клиент API. Шлёт Telegram initData в заголовке x-telegram-init-data,
// сервер сам проверяет подпись и определяет юзера.
//
// Часть WebView (Telegram Desktop) падает TypeError на fetch, если URL слишком длинный
// (initData в query на каждый запрос) или если заголовок initData «плохой».
// Стратегия: 1) только заголовок, короткий URL; 2) при TypeError — повтор с initData
// только в ?tgWebAppData= (без заголовка), сервер читает query (см. backend auth.js).
//
// ВАЖНО: смени PROD_API_BASE на свой Worker URL после первого деплоя.
// Или задай window.SMOLGAME_API_BASE до загрузки этого скрипта.

const PROD_API_BASE =
  (typeof window !== 'undefined' && window.SMOLGAME_API_BASE) ||
  'https://smolgame.dorokhin731.workers.dev';
const API_BASE = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://127.0.0.1:8787'
  : PROD_API_BASE;

const INIT_DATA_CACHE_KEY = 'smolgame:tgInitData:v1';

function _looksLikeInitData(s) {
  const t = String(s || '').trim();
  return t.length >= 30 && t.includes('hash=');
}

function _initData() {
  try {
    const o = typeof window !== 'undefined' ? window.__smolgameInitDataOverride : '';
    if (o && String(o).trim()) return String(o).trim();
    const tw = Telegram?.WebApp?.initData;
    if (tw && String(tw).trim()) return String(tw).trim();
    try {
      const c = sessionStorage.getItem(INIT_DATA_CACHE_KEY);
      if (c && _looksLikeInitData(c)) return String(c).trim();
    } catch (e2) { /* ignore */ }
    return '';
  } catch (e) {
    return '';
  }
}

function _persistInitDataCache(raw) {
  const t = String(raw || '').trim();
  if (!_looksLikeInitData(t)) return;
  try {
    sessionStorage.setItem(INIT_DATA_CACHE_KEY, t);
  } catch (e) { /* ignore */ }
}

/** Строка для HTTP-заголовка: без управляющих символов (часть WebView падает TypeError на fetch). */
function _initDataHeaderValue() {
  const raw = _initData();
  if (!raw) return '';
  return raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

/** Добавить initData в URL (сервер читает как fallback к заголовку). */
function pathWithTgWebAppData(path, rawInit) {
  const raw = String(rawInit || '').trim();
  if (!raw) return path;
  const sep = path.includes('?') ? '&' : '?';
  return path + sep + 'tgWebAppData=' + encodeURIComponent(raw);
}

function _fetchTypeErrorRetryable(msg) {
  const low = String(msg || '').toLowerCase();
  return (
    low.includes('type error') ||
    low.includes('typeerror') ||
    (low.includes('invalid') && low.includes('header'))
  );
}

/** Проверяет, является ли сетевая ошибка webkit/WebView-специфичной. */
function _isWebkitNetworkError(msg) {
  const low = String(msg || '').toLowerCase();
  return (
    low.includes('load failed') ||
    low.includes('failed to fetch') ||
    low.includes('network') ||
    low.includes('network connection was lost') ||
    low.includes('internet connection appears to be offline') ||
    low.includes('cancelled') ||
    low.includes('canceled')
  );
}

const API_FETCH_TIMEOUT_MS = 22000;
const WEBKIT_NETWORK_ERR_MSG =
  'Сеть/WebView: не удалось связаться с API. Подожди минуту, выключи VPN, обнови мини-апп (закрой полностью). Если с телефона работает — обнови Worker: backend → git pull && npx wrangler deploy.';

function _needsTelegramAuth(path, method) {
  if (method !== 'GET' && method !== 'POST' && method !== 'DELETE' && method !== 'PATCH') return false;
  if (path.startsWith('/api/feed')) return false;
  if (path.startsWith('/api/games/') && method === 'GET') return false;
  if (path.startsWith('/api/users/') && method === 'GET') return false;
  if (path === '/' || path.startsWith('/api/health')) return false;
  return true;
}

async function apiFetch(path, { method = 'GET', body, _did401Retry = false, _forceQueryAuth = false } = {}) {
  if (typeof ensureSmolgameInitDataFromUrl === 'function') ensureSmolgameInitDataFromUrl();
  if (typeof window.syncUSERFromTelegramInit === 'function') window.syncUSERFromTelegramInit();

  const initRaw = _initData();
  _persistInitDataCache(initRaw);
  const initHdr = _initDataHeaderValue();
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const jsonBody = body !== undefined && !isFormData ? JSON.stringify(body) : undefined;

  if (path !== '/api/feed') {
    console.log(`[API] ${method} ${path}, initData: ${initRaw ? 'YES (' + initRaw.length + ')' : 'NO'}, USER.id: ${window.USER?.id}`);
  }

  if (path !== '/api/feed') {
    console.log(`[API] ${method} ${path}, initData: ${initRaw ? 'YES (' + initRaw.length + ')' : 'NO'}, USER.id: ${window.USER?.id}`);
  }

  function doFetch(urlPath, includeInitHeader, signal) {
    const headers = {};
    if (includeInitHeader && initHdr) headers['x-telegram-init-data'] = initHdr;
    if (body !== undefined && !isFormData) headers['content-type'] = 'application/json';
    return fetch(API_BASE + urlPath, {
      method,
      headers,
      body: isFormData ? body : jsonBody,
      signal,
    });
  }

  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    ac &&
    setTimeout(() => {
      try {
        ac.abort();
      } catch (e) { /* ignore */ }
    }, API_FETCH_TIMEOUT_MS);

  let resp;
  try {
    const urlForRequest =
      _forceQueryAuth && initRaw ? pathWithTgWebAppData(path, initRaw) : path;
    const wantHeader = !_forceQueryAuth && Boolean(initHdr);
    resp = await doFetch(urlForRequest, wantHeader, ac?.signal);
  } catch (e1) {
    const msg1 = String(e1?.message || e1 || '');
    if (ac?.signal?.aborted) {
      throw new Error(
        typeof t === 'function'
          ? t('err_network')
          : 'Нет ответа от сервера (таймаут). Закрой мини-апп и открой снова из бота.'
      );
    }
    if (initRaw && _fetchTypeErrorRetryable(msg1)) {
      try {
        const urlPath = pathWithTgWebAppData(path, initRaw);
        resp = await doFetch(urlPath, false, ac?.signal);
      } catch (e2) {
        const net = String(e2?.message || e2 || '');
        throw new Error(
          _isWebkitNetworkError(net)
            ? WEBKIT_NETWORK_ERR_MSG
            : 'Запрос не выполнился: ' + (net || 'ошибка сети')
        );
      }
    } else {
      const net = String(e1?.message || e1 || '');
      throw new Error(
        _isWebkitNetworkError(net)
          ? WEBKIT_NETWORK_ERR_MSG
          : 'Запрос не выполнился: ' + (net || 'ошибка сети')
      );
    }
  } finally {
    if (timer) clearTimeout(timer);
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

    if (
      resp.status === 401 &&
      !_did401Retry &&
      _needsTelegramAuth(path, method) &&
      initRaw &&
      _looksLikeInitData(initRaw)
    ) {
      if (typeof ensureSmolgameInitDataFromUrl === 'function') ensureSmolgameInitDataFromUrl();
      if (typeof window.syncUSERFromTelegramInit === 'function') window.syncUSERFromTelegramInit();
      await new Promise(r => setTimeout(r, 80));
      return apiFetch(path, { method, body, _did401Retry: true, _forceQueryAuth: true });
    }

    if (
      resp.status === 401 &&
      !_did401Retry &&
      _needsTelegramAuth(path, method) &&
      typeof ensureSmolgameInitDataFromUrl === 'function'
    ) {
      ensureSmolgameInitDataFromUrl();
      if (typeof window.syncUSERFromTelegramInit === 'function') window.syncUSERFromTelegramInit();
      await new Promise(r => setTimeout(r, 120));
      return apiFetch(path, { method, body, _did401Retry: true });
    }

    if (resp.status === 401) {
      const serverMsg = typeof raw === 'string' ? raw.trim() : '';
      msg = serverMsg || 'Вход из Telegram не подтверждён. Открой только из бота. Если из бота — токен на Worker должен быть от ЭТОГО бота: npx wrangler secret put TELEGRAM_BOT_TOKEN';
    } else if (resp.status === 404) {
      const low = String(msg || '').toLowerCase();
      if (!raw || low === 'not found' || low === 'request failed') {
        msg =
          'На Worker нет этого API (404). Чаще всего не задеплоена последняя версия: в папке backend выполни git pull и npm run deploy.';
      }
    } else if (resp.status === 409) {
      // оставляем текст от API (например профиль в БД)
    } else if (resp.status === 503) {
      const serverMsg = typeof raw === 'string' ? raw.trim() : '';
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
  _persistInitDataCache(_initData());
  return data;
}

window.API = {
  base: API_BASE,

  feed:         (params = {}) => {
    const q = new URLSearchParams();
    if (params.offset != null) q.set('offset', String(params.offset));
    if (params.limit != null) q.set('limit', String(params.limit));
    q.set('_t', String(Date.now()));
    return apiFetch(`/api/feed?${q.toString()}`);
  },
  me:           ()         => apiFetch(`/api/me?_t=${Date.now()}`),
  updateMe:      (body)           => apiFetch('/api/me', { method: 'PATCH', body }),
  deleteAccount: ()               => apiFetch('/api/me', { method: 'DELETE' }),
  myGames:      ()         => apiFetch(`/api/me/games?_t=${Date.now()}`),
  gamesLibrary: ()         => apiFetch(`/api/me/games-library?_t=${Date.now()}`),
  likedGames:   ()         => apiFetch(`/api/me/liked-games?_t=${Date.now()}`),
  playedGames:  ()         => apiFetch(`/api/me/played-games?_t=${Date.now()}`),
  game:         (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}?_t=${Date.now()}`),
  gameReviews:  (gameId)   => apiFetch(`/api/games/${encodeURIComponent(gameId)}/reviews?_t=${Date.now()}`),
  postGameReview: (gameId, data) => apiFetch(`/api/games/${encodeURIComponent(gameId)}/reviews`, { method: 'POST', body: data }),
  deleteReview:   (id)             => apiFetch(`/api/reviews/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  updateReview:   (id, text)       => apiFetch(`/api/reviews/${encodeURIComponent(id)}`, { method: 'PATCH', body: { body: text } }),
  userPosts:      (userId)         => apiFetch(`/api/users/${encodeURIComponent(userId)}/posts?_t=${Date.now()}`),
  createPost:     (text)           => apiFetch('/api/posts', { method: 'POST', body: { body: text } }),
  deletePost:     (id)             => apiFetch(`/api/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
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
