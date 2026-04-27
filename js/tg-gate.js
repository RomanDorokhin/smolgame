/**
 * Приложение только для Telegram Mini App: нужен подписанный initData.
 */
function hasTelegramInitData() {
  try {
    return Boolean(Telegram.WebApp?.initData && String(Telegram.WebApp.initData).length > 0);
  } catch (e) {
    return false;
  }
}

function miniAppTelegramUrl() {
  const bot = String(window.BOT_USERNAME || 'smolgame_bot').replace(/^@/, '');
  const app = String(window.BOT_APP_NAME || '').trim();
  if (app) return `https://t.me/${bot}/${app}`;
  return `https://t.me/${bot}`;
}

function showTelegramOnlyWall() {
  document.getElementById('app-boot-splash')?.classList.remove('visible');
  document.getElementById('app-boot-splash')?.setAttribute('hidden', '');
  document.getElementById('tg-only-panel-default')?.removeAttribute('hidden');
  document.getElementById('tg-only-panel-github')?.setAttribute('hidden', '');
  document.body.classList.add('tg-only-wall');
  const wall = document.getElementById('tg-only-wall');
  if (wall) wall.hidden = false;
}

/**
 * После GitHub OAuth браузер открывает GitHub Pages без initData — показываем итог и deep-link в Telegram.
 */
function showGithubOAuthBrowserWall(status, message) {
  document.getElementById('app-boot-splash')?.classList.remove('visible');
  document.getElementById('app-boot-splash')?.setAttribute('hidden', '');
  document.getElementById('tg-only-panel-default')?.setAttribute('hidden', '');
  const ghPanel = document.getElementById('tg-only-panel-github');
  if (ghPanel) ghPanel.removeAttribute('hidden');
  document.body.classList.add('tg-only-wall');
  const wall = document.getElementById('tg-only-wall');
  if (wall) wall.hidden = false;

  const title = document.getElementById('tg-only-github-title');
  const text = document.getElementById('tg-only-github-text');
  const link = document.getElementById('tg-only-open-telegram');
  const tgUrl = miniAppTelegramUrl();
  if (link) link.href = tgUrl;

  if (status === 'connected') {
    if (title) title.textContent = 'GitHub подключён';
    if (text) {
      text.textContent =
        'Вход прошёл в браузере. Чтобы вставить код и отправить игру, открой мини-апп в Telegram: Загрузить → Вставить код → Загрузить на GitHub.';
    }
  } else {
    if (title) title.textContent = 'GitHub';
    let m = message ? String(message) : 'ошибка';
    try {
      if (message) m = decodeURIComponent(String(message).replace(/\+/g, ' '));
    } catch (e) {
      /* уже декодировано из searchParams */
    }
    if (text) text.textContent = 'Не удалось: ' + m + '. Открой мини-апп в Telegram и попробуй снова.';
  }

  try {
    const u = new URL(window.location.href);
    u.searchParams.delete('github');
    u.searchParams.delete('message');
    const qs = u.searchParams.toString();
    window.history.replaceState({}, '', u.pathname + (qs ? '?' + qs : '') + u.hash);
  } catch (e) {
    /* ignore */
  }
}

function hideTelegramOnlyWall() {
  document.body.classList.remove('tg-only-wall');
  const wall = document.getElementById('tg-only-wall');
  if (wall) wall.hidden = true;
}

window.hasTelegramInitData = hasTelegramInitData;
window.showTelegramOnlyWall = showTelegramOnlyWall;
window.hideTelegramOnlyWall = hideTelegramOnlyWall;
window.showGithubOAuthBrowserWall = showGithubOAuthBrowserWall;
window.miniAppTelegramUrl = miniAppTelegramUrl;
