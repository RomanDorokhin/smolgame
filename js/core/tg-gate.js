/**
 * Приложение только для Telegram Mini App: нужен подписанный initData.
 */
function hasSignedTelegramInitData() {
  try {
    const o = window.__smolgameInitDataOverride;
    if (o && String(o).includes('hash=')) return true;
    const d = Telegram.WebApp?.initData;
    if (d && String(d).includes('hash=')) return true;
    try {
      const c = sessionStorage.getItem('smolgame:tgInitData:v1');
      if (c && String(c).includes('hash=')) return true;
    } catch (e2) { /* ignore */ }
    return false;
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
