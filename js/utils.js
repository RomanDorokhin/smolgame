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
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
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

window.fmtNum = fmtNum;
window.likeIconMarkup = likeIconMarkup;
window.sgStatHeartSvg = sgStatHeartSvg;
window.sgStatEyeSvg = sgStatEyeSvg;
window.showToast = showToast;
window.esc = esc;
window.safeHttpUrl = safeHttpUrl;
window.normalizeToHttpsUrl = normalizeToHttpsUrl;
window.avatarImgUrl = avatarImgUrl;
window.loadSet = loadSet;
window.saveSet = saveSet;
