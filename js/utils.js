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

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

window.fmtNum = fmtNum;
window.showToast = showToast;
window.esc = esc;
window.safeHttpUrl = safeHttpUrl;
