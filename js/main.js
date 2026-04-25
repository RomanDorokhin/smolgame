async function bootstrap() {
  const needsOnboarding = await checkOnboarding();
  if (needsOnboarding) {
    showOnboardingScreen();
    return;
  }
  await loadGames();
  jumpToStartParamGame();
}

// Если мини-апп открыта по deep-link (https://t.me/<bot>?startapp=g_<id>),
// Telegram передаёт параметр в initDataUnsafe.start_param. Мы из него
// достаём id игры и переключаем ленту на неё.
function jumpToStartParamGame() {
  let startParam = '';
  try { startParam = Telegram.WebApp.initDataUnsafe?.start_param || ''; } catch (e) {}
  if (!startParam) return;

  const gameId = startParam.startsWith('g_')
    ? decodeURIComponent(startParam.slice(2))
    : startParam;
  const idx = (window.GAMES || []).findIndex(g => g.id === gameId);
  if (idx >= 0) {
    goTo(idx, true);
    hideHint();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

window.jumpToStartParamGame = jumpToStartParamGame;
