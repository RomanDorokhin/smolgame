async function bootstrap() {
  try {
    const data = await API.feed();
    window.GAMES = Array.isArray(data?.games) ? data.games : [];
    alert('Игр загружено: ' + window.GAMES.length);
  } catch(e) {
    alert('Ошибка: ' + e.message);
    window.GAMES = [];
  }
  renderFeed();
  jumpToStartParamGame();
}

function jumpToStartParamGame() {
  let startParam = '';
  try { startParam = Telegram.WebApp.initDataUnsafe?.start_param || ''; } catch (e) {}
  if (!startParam) return;
  const gameId = startParam.startsWith('g_')
    ? decodeURIComponent(startParam.slice(2))
    : startParam;
  const idx = (window.GAMES || []).findIndex(g => g.id === gameId);
  if (idx >= 0) { goTo(idx, true); hideHint(); }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

window.jumpToStartParamGame = jumpToStartParamGame;
