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

function showTelegramOnlyWall() {
  document.body.classList.add('tg-only-wall');
  const wall = document.getElementById('tg-only-wall');
  if (wall) wall.hidden = false;
}

function hideTelegramOnlyWall() {
  document.body.classList.remove('tg-only-wall');
  const wall = document.getElementById('tg-only-wall');
  if (wall) wall.hidden = true;
}

window.hasTelegramInitData = hasTelegramInitData;
window.showTelegramOnlyWall = showTelegramOnlyWall;
window.hideTelegramOnlyWall = hideTelegramOnlyWall;
