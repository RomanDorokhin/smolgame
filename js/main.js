async function bootstrap() {
  if (typeof initI18n === 'function') initI18n();
  if (typeof hasTelegramInitData === 'function' && !hasTelegramInitData()) {
    if (typeof hideBootSplash === 'function') hideBootSplash();
    if (typeof showTelegramOnlyWall === 'function') showTelegramOnlyWall();
    return;
  }
  if (typeof hideTelegramOnlyWall === 'function') hideTelegramOnlyWall();
  if (typeof showBootSplash === 'function') showBootSplash();

  let needOnboarding = false;
  try {
    const onboardingP =
      typeof checkOnboarding === 'function'
        ? checkOnboarding().catch(e => {
            console.warn('onboarding check failed', e);
            return false;
          })
        : Promise.resolve(false);

    const gamesP = typeof loadGames === 'function' ? loadGames() : Promise.resolve();

    const [need] = await Promise.all([onboardingP, gamesP]);
    needOnboarding = Boolean(need);

    if (needOnboarding && typeof showOnboardingScreen === 'function') {
      if (typeof hideBootSplash === 'function') hideBootSplash();
      showOnboardingScreen();
    }

    await jumpToStartParamGame();
    await handleGithubOAuthReturn();
    if (typeof refreshUploadCapabilities === 'function') {
      refreshUploadCapabilities().catch(() => {});
    }

    if (!needOnboarding && typeof maybeShowFeedNavTipAfterGames === 'function') {
      maybeShowFeedNavTipAfterGames();
    }
    if (typeof refreshFeedCoachState === 'function') refreshFeedCoachState();
  } catch (e) {
    console.error('bootstrap failed', e);
    if (typeof showToast === 'function') {
      const m =
        typeof userFacingError === 'function'
          ? userFacingError(e)
          : String(e?.message || (typeof t === 'function' ? t('err_load') : 'Не загрузилось'));
      showToast(m);
      if (typeof hapticWarning === 'function') hapticWarning();
    }
  } finally {
    if (!needOnboarding && typeof hideBootSplash === 'function') hideBootSplash();
  }
}

async function handleGithubOAuthReturn() {
  try {
    const u = new URL(window.location.href);
    const g = u.searchParams.get('github');
    if (!g) return;
    const msg = u.searchParams.get('message');
    if (g === 'connected') {
      showToast(typeof t === 'function' ? t('github_connected') : '✅ GitHub подключён');
    } else if (g === 'error') {
      showToast((typeof t === 'function' ? t('github_error') : '⚠️ GitHub: ') + (msg || (typeof t === 'function' ? t('github_error_generic') : 'ошибка')));
    }
    u.searchParams.delete('github');
    u.searchParams.delete('message');
    const qs = u.searchParams.toString();
    const clean = u.pathname + (qs ? '?' + qs : '') + u.hash;
    window.history.replaceState({}, '', clean);

    if (typeof refreshUploadCapabilities === 'function') {
      await refreshUploadCapabilities();
    }
    if (g === 'connected') {
      if (typeof openUpload === 'function') openUpload();
      if (typeof selectMethod === 'function') await selectMethod('github');
    }
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
