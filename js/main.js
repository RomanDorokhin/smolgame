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
  await jumpToStartParamGame();
  handleGithubOAuthReturn();
}

function handleGithubOAuthReturn() {
  try {
    const u = new URL(window.location.href);
    const g = u.searchParams.get('github');
    if (!g) return;
    const msg = u.searchParams.get('message');
    if (g === 'connected') {
      showToast('✅ GitHub подключён');
    } else if (g === 'error') {
      showToast('⚠️ GitHub: ' + (msg || 'ошибка'));
    }
    u.searchParams.delete('github');
    u.searchParams.delete('message');
    const qs = u.searchParams.toString();
    const clean = u.pathname + (qs ? '?' + qs : '') + u.hash;
    window.history.replaceState({}, '', clean);
  } catch (e) {
    /* ignore */
  }
}

async function jumpToStartParamGame() {
  let startParam = '';
  try { startParam = Telegram.WebApp.initDataUnsafe?.start_param || ''; } catch (e) {}
  if (!startParam) return;
  const gameId = startParam.startsWith('g_')
    ? decodeURIComponent(startParam.slice(2))
    : startParam;
  let idx = (window.GAMES || []).findIndex(g => g.id === gameId);
  if (idx >= 0) {
    goTo(idx, true);
    hideHint();
    return;
  }
  if (typeof injectGameIntoFeed === 'function') {
    await injectGameIntoFeed(gameId);
    idx = (window.GAMES || []).findIndex(g => g.id === gameId);
    if (idx >= 0) {
      goTo(idx, true);
      hideHint();
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

window.jumpToStartParamGame = jumpToStartParamGame;
