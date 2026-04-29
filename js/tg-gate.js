/**
 * Приложение только для Telegram Mini App: нужен подписанный initData.
 */
function hasSignedTelegramInitData() {
  try {
    const o = window.__smolgameInitDataOverride;
    if (o && String(o).includes('hash=')) return true;
    const d = Telegram.WebApp?.initData;
    return Boolean(d && String(d).includes('hash='));
  } catch (e) {
    return false;
  }
}

function hasTelegramInitData() {
  return hasSignedTelegramInitData();
}

function showTelegramOnlyWall() {
  document.getElementById('app-boot-splash')?.classList.remove('visible');
  document.getElementById('app-boot-splash')?.setAttribute('hidden', '');
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
