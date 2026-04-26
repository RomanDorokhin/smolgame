async function bootstrap() {
  if (typeof hasTelegramInitData === 'function' && !hasTelegramInitData()) {
    if (typeof showTelegramOnlyWall === 'function') showTelegramOnlyWall();
    return;
  }
  if (typeof hideTelegramOnlyWall === 'function') hideTelegramOnlyWall();

  let needOnboarding = false;
  if (typeof checkOnboarding === 'function') {
    try {
      needOnboarding = await checkOnboarding();
    } catch (e) {
      console.warn('onboarding check failed', e);
    }
  }

  if (needOnboarding && typeof showOnboardingScreen === 'function') {
    showOnboardingScreen();
  }

  await loadGames();
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
