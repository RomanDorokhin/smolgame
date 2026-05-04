/** SVG для лайка в ленте (outline / filled) — без эмодзи */
const SG_ICON_HEART_OUTLINE =
  '<svg class="sg-icon sg-icon--heart" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const SG_ICON_HEART_SOLID =
  '<svg class="sg-icon sg-icon--heart sg-icon--heart-filled" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="currentColor" d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2 12.39 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35l-.355-.44z"/></svg>';

function likeIconMarkup(liked) {
  return liked ? SG_ICON_HEART_SOLID : SG_ICON_HEART_OUTLINE;
}

/** Иконки для статистики карточек игр */
function sgStatHeartSvg() {
  return '<svg class="sg-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function sgStatEyeSvg() {
  return '<svg class="sg-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2.25 12s3.75-6 9.75-6 9.75 6 9.75 6-3.75 6-9.75 6S2.25 12 2.25 12z" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.25" stroke="currentColor" stroke-width="1.65"/></svg>';
}

/** Мини-марка SmolGame для загрузки (вращается вместо кольца) */
function sgLogoMarkLoaderHtml() {
  return '<div class="sg-brand-mark sg-brand-mark--loader" aria-hidden="true"><svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="13" y="13" width="22" height="22" rx="8" fill="none" stroke="currentColor" stroke-width="2.25"/><circle cx="24" cy="24" r="4.5" fill="currentColor" opacity=".88"/></svg></div>';
}

function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n || 0);
}

// Экранирование для безопасной вставки в innerHTML / атрибуты.
// Используй везде, где данные из API/формы попадают в HTML-шаблон.
const _ESC_MAP = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;', '`':'&#96;' };
function esc(v) {
  return String(v ?? '').replace(/[&<>"'`]/g, ch => _ESC_MAP[ch]);
}

/** Превью карточки игры (лента / поиск / профиль / экран автора). */
function gameThumbHtml(g) {
  if (g && g.imageUrl) {
    return `<img src="${esc(g.imageUrl)}" class="game-card-cover" alt="">`;
  }
  return `<span class="game-card-thumb-placeholder">${typeof genreIconForGame === 'function' ? genreIconForGame(g) : ''}</span>`;
}

/** Telegram numeric user id для сравнения (API/D1 могут отдать number, USER.id — string). */
function tgUserIdKey(id) {
  if (id == null || id === '') return '';
  const s = String(id).trim();
  const n = Number(s);
  if (Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER) return String(Math.trunc(n));
  return s;
}

function sameTelegramUserId(a, b) {
  const ka = tgUserIdKey(a);
  const kb = tgUserIdKey(b);
  return ka !== '' && ka === kb;
}

// Проверка URL: только http/https, с нормальным хостом.
// Возвращает нормализованный URL или null.
function safeHttpUrl(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname) return null;
    return u.toString();
  } catch (e) {
    return null;
  }
}

/** Для отправки на сервер: только https (http → https, GitHub Pages часто даёт http). */
function normalizeToHttpsUrl(raw) {
  const base = safeHttpUrl(raw);
  if (!base) return null;
  try {
    const u = new URL(base);
    if (u.protocol === 'http:') u.protocol = 'https:';
    if (u.protocol !== 'https:') return null;
    return u.toString();
  } catch (e) {
    return null;
  }
}

/** URL фото профиля (Telegram / CDN) или null, если показываем букву/эмодзи. */
function avatarImgUrl(avatar) {
  if (avatar == null || avatar === '') return null;
  const s = String(avatar).trim();
  if (!/^https?:\/\//i.test(s)) return null;
  return safeHttpUrl(s);
}

let toastTimer;
function showToast(msg, durationMs) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  const ms = Number(durationMs) > 0 ? Number(durationMs) : 2200;
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/** Короткое сообщение для пользователя из Error / строки (без длинных тех. текстов в тосте). */
function userFacingError(e) {
  const raw = String(e?.message || e || '').trim();
  const tFn = typeof t === 'function' ? t : null;
  if (!raw) return tFn ? tFn('err_generic') : 'Что-то пошло не так. Попробуй ещё раз.';
  const low = raw.toLowerCase();
  if (low.includes('нет сети') || low.includes('network') || low.includes('failed to fetch')) {
    return tFn ? tFn('err_network') : 'Нет сети. Проверь интернет и попробуй снова.';
  }
  if (raw.length > 120) return raw.slice(0, 117) + '…';
  return raw;
}

function hapticLight() {
  try {
    Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
  } catch (err) { /* ignore */ }
}

function hapticSuccess() {
  try {
    Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');
  } catch (err) { /* ignore */ }
}

function hapticWarning() {
  try {
    Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('warning');
  } catch (err) { /* ignore */ }
}

/** Короткая строка описания для карточки «как товар» (профиль / поиск). */
function sgCardDescSnippet(text, maxLen) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  const m = Math.max(8, Number(maxLen) || 64);
  if (t.length <= m) return t;
  return t.slice(0, m - 1).trimEnd() + '…';
}

/**
 * Нижняя часть карточки в стиле маркетплейса: категория, название, опционально автор и описание, статистика + «Бесплатно».
 * @param {object} g — объект игры из ленты/API
 * @param {{ author?: boolean, desc?: boolean }} [opts]
 */
function sgStorefrontCardInfoHtml(g, opts) {
  const o = opts || {};
  const showAuthor = Boolean(o.author);
  const showDesc = o.desc !== false;
  const genreLine = esc(
    g && g.genre && String(g.genre).trim()
      ? typeof genreDisplayFromApi === 'function'
        ? genreDisplayFromApi(g.genre)
        : g.genre
      : typeof t === 'function'
        ? t('game_fallback')
        : 'Игра'
  );
  const titleFallback = typeof t === 'function' ? t('game_fallback') : 'Игра';
  const title = esc((g && g.title && String(g.title).trim()) ? g.title : titleFallback);
  const snippet = showDesc ? sgCardDescSnippet(g && g.description, 72) : '';
  const snippetHtml = snippet ? `<p class="sg-store-card-desc">${esc(snippet)}</p>` : '';
  let authorHtml = '';
  if (showAuthor) {
    const an = g && g.authorName != null ? String(g.authorName).trim() : '';
    const ah = g && g.authorHandle != null ? String(g.authorHandle).trim() : '';
    const line = an || (ah ? '@' + ah : '');
    if (line) authorHtml = `<div class="sg-store-card-author">${esc(line)}</div>`;
  }
  return `
    <div class="sg-store-card-info">
      <div class="sg-store-card-cat">${genreLine}</div>
      <div class="sg-store-card-title">${title}</div>
      ${authorHtml}
      ${snippetHtml}
      <div class="sg-store-card-meta">
        <div class="sg-store-card-stats">
          <span class="sg-mini-stat">${sgStatHeartSvg()}${fmtNum(g && g.likes)}</span>
          <span class="sg-mini-sep">·</span>
          <span class="sg-mini-stat">${sgStatEyeSvg()}${fmtNum(g && g.plays)}</span>
        </div>
        <span class="sg-store-card-badge">${esc(typeof t === 'function' ? t('free') : 'Бесплатно')}</span>
      </div>
    </div>`;
}

/** Единый блок «пусто» в сетках (профиль, автор). */
function sgEmptyGridHtml(title, sub) {
  const t = esc(title || '');
  const s = esc(sub || '');
  return `<div class="sg-empty-state sg-empty-state--grid"><div class="sg-empty-state-title">${t}</div><div class="sg-empty-state-sub">${s}</div></div>`;
}

// Localstorage-хелперы для Set<string>.
// Тихо падают в no-op, если storage недоступен (приватный режим, квота и т.п.).
function loadSet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch (e) {
    return new Set();
  }
}

function saveSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch (e) {
    // storage полон/заблокирован — игнор.
  }
}

window.debugClearCache = function() {
  try {
    sessionStorage.clear();
    localStorage.clear();
    const url = new URL(window.location.href);
    url.searchParams.set('_tg', String(Date.now()));
    window.location.replace(url.toString());
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️ Reset failed: ' + e.message);
  }
};

window.fmtNum = fmtNum;
window.likeIconMarkup = likeIconMarkup;
window.sgStatHeartSvg = sgStatHeartSvg;
window.sgStatEyeSvg = sgStatEyeSvg;
window.sgLogoMarkLoaderHtml = sgLogoMarkLoaderHtml;
window.showToast = showToast;
window.userFacingError = userFacingError;
window.hapticLight = hapticLight;
window.hapticSuccess = hapticSuccess;
window.hapticWarning = hapticWarning;
window.sgEmptyGridHtml = sgEmptyGridHtml;
window.sgCardDescSnippet = sgCardDescSnippet;
window.sgStorefrontCardInfoHtml = sgStorefrontCardInfoHtml;
window.esc = esc;
window.gameThumbHtml = gameThumbHtml;
window.safeHttpUrl = safeHttpUrl;
window.normalizeToHttpsUrl = normalizeToHttpsUrl;
window.avatarImgUrl = avatarImgUrl;
window.loadSet = loadSet;
window.saveSet = saveSet;
window.tgUserIdKey = tgUserIdKey;
window.sameTelegramUserId = sameTelegramUserId;
