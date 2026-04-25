async function bootstrap() {
  try {
    const data = await API.feed();
    window.GAMES = Array.isArray(data?.games) ? data.games : [];
  } catch(e) {
    window.GAMES = [];
  }
  
  const empty = document.getElementById('empty-state');
  const feed = document.getElementById('feed');
  
  if (window.GAMES.length === 0) {
    if (empty) empty.classList.add('show');
    return;
  }
  
  if (empty) empty.classList.remove('show');
  renderFeed();
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
