/**
 * Первый запуск: welcome; после «Начать» — лента и при необходимости краткая подсказка (feed-nav-tip).
 * Флаг: STORAGE_KEYS.feedOnboardingDone
 */
(function () {
  function storageDone() {
    try {
      return localStorage.getItem(STORAGE_KEYS.feedOnboardingDone) === '1';
    } catch (e) {
      return true;
    }
  }

  function setStorageDone() {
    try {
      localStorage.setItem(STORAGE_KEYS.feedOnboardingDone, '1');
    } catch (e) { /* ignore */ }
  }

  function rootEl() {
    return document.getElementById('feed-onboarding-root');
  }

  function isRegistrationOpen() {
    return document.getElementById('onboarding-screen')?.classList.contains('open');
  }

  function teardownUi() {
    document.body.classList.remove('feed-onboarding-ui', 'feed-onboarding-active');
    const root = rootEl();
    if (root) {
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
      root.querySelector('#feed-onboarding-welcome')?.classList.remove('feed-onboarding-welcome--visible');
      root.querySelector('.feed-onboarding-brand')?.classList.remove('feed-onboarding-brand--in');
    }
  }

  function completeOnboarding() {
    const already = storageDone();
    if (!already) setStorageDone();
    teardownUi();
    if (already) return;
    if (typeof maybeShowFeedNavTipAfterGames === 'function') maybeShowFeedNavTipAfterGames();
    if (typeof refreshFeedCoachState === 'function') refreshFeedCoachState();
  }

  function interruptToClose() {
    completeOnboarding();
  }

  function startWelcomePhase() {
    const root = rootEl();
    const welcome = document.getElementById('feed-onboarding-welcome');
    if (!root || !welcome) return;
    root.hidden = false;
    root.removeAttribute('aria-hidden');
    document.body.classList.add('feed-onboarding-ui', 'feed-onboarding-active');
    welcome.classList.add('feed-onboarding-welcome--visible');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        welcome.querySelector('.feed-onboarding-brand')?.classList.add('feed-onboarding-brand--in');
      });
    });
  }

  function onWelcomeCta() {
    const welcome = document.getElementById('feed-onboarding-welcome');
    welcome?.classList.remove('feed-onboarding-welcome--visible');
    welcome?.querySelector('.feed-onboarding-brand')?.classList.remove('feed-onboarding-brand--in');
    setTimeout(() => completeOnboarding(), 280);
  }
  window.onFeedOnboardingWelcomeCta = onWelcomeCta;

  function onWelcomeBackdropClick(ev) {
    if (ev.target.closest('.feed-onboarding-welcome-cta')) return;
    interruptToClose();
  }

  function maybeStartFeedOnboarding() {
    if (storageDone()) return;
    if (isRegistrationOpen()) return;
    if (!Array.isArray(window.GAMES) || window.GAMES.length < 2) return;
    if (!document.body.classList.contains('is-tab-feed')) return;
    const root = rootEl();
    if (!root || root.hidden === false) return;
    startWelcomePhase();
  }

  function initFeedOnboardingUi() {
    const welcome = document.getElementById('feed-onboarding-welcome');
    welcome?.addEventListener('click', onWelcomeBackdropClick);
  }

  window.maybeStartFeedOnboarding = maybeStartFeedOnboarding;
  window.isFeedOnboardingBlocking = function isFeedOnboardingBlocking() {
    return document.body.classList.contains('feed-onboarding-ui');
  };
  /** Снять welcome при уходе с ленты — иначе switchTab раньше time return и не открывает другие вкладки. */
  window.forceDismissFeedOnboarding = interruptToClose;
  window.notifyFeedOnboardingUserSwipe = function notifyFeedOnboardingUserSwipe() { /* no-op: демо свайпа убрано */ };
  window.initFeedOnboardingUi = initFeedOnboardingUi;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFeedOnboardingUi);
  } else {
    initFeedOnboardingUi();
  }
})();
