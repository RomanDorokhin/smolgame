/**
 * Первый запуск: welcome + демо «свайп вверх» по реальной ленте (см. ТЗ).
 * Флаг: STORAGE_KEYS.feedOnboardingDone
 */
(function () {
  const LIFT_MS = 600;
  const RETURN_MS = 500;
  const HOLD_MS = 500;
  const LIFT_EASE = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  /** Подсказка на карточке — через ~3.5 с от старта демо (фаза 2) */
  const HINT_AT_MS = 3500;

  let timers = [];
  let hintEl = null;
  let demoRunning = false;
  let hintActive = false;
  let hintTapDown = null;
  let onHintPointerUpBound = null;

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

  function clearTimers() {
    for (const t of timers) clearTimeout(t);
    timers = [];
  }

  function schedule(fn, ms) {
    const t = setTimeout(fn, ms);
    timers.push(t);
    return t;
  }

  function resetSlideTransforms() {
    const slides = window.slides;
    if (!Array.isArray(slides) || slides.length === 0) return;
    const idx = window.currentIdx || 0;
    const vert = window.FEED_VERTICAL !== false;
    slides.forEach((s, i) => {
      s.style.transition = 'none';
      s.style.transform = vert
        ? `translate3d(0,${(i - idx) * 100}%,0)`
        : `translate3d(${(i - idx) * 100}%,0,0)`;
    });
    void slides[0]?.offsetWidth;
    slides.forEach(s => {
      s.style.transition = '';
      s.style.transform = '';
    });
  }

  function removeSwipeHint() {
    hintEl?.remove();
    hintEl = null;
    hintActive = false;
    if (onHintPointerUpBound) {
      document.removeEventListener('pointerup', onHintPointerUpBound, true);
      document.removeEventListener('pointercancel', onHintPointerUpBound, true);
      onHintPointerUpBound = null;
    }
    hintTapDown = null;
  }

  function onHintPointerUp(ev) {
    if (!hintActive) return;
    if (hintTapDown == null || ev.pointerId !== hintTapDown.id) return;
    const dur = Date.now() - hintTapDown.t;
    const dx = Math.abs(ev.clientX - hintTapDown.x);
    const dy = Math.abs(ev.clientY - hintTapDown.y);
    if (dur < 420 && dx < 14 && dy < 14) {
      completeOnboarding();
    }
    hintTapDown = null;
  }

  function onHintPointerDownCapture(ev) {
    if (!hintActive) return;
    hintTapDown = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: Date.now() };
  }

  function attachHintTapToDismiss() {
    onHintPointerUpBound = onHintPointerUp;
    document.addEventListener('pointerdown', onHintPointerDownCapture, true);
    document.addEventListener('pointerup', onHintPointerUpBound, true);
    document.addEventListener('pointercancel', onHintPointerUpBound, true);
  }

  function showSwipeHintOnFirstSlide() {
    const slide0 = window.slides?.[0];
    if (!slide0) return;
    removeSwipeHint();
    const inner = slide0.querySelector('.slide-inner');
    if (!inner) return;
    const wrap = document.createElement('div');
    wrap.className = 'feed-onboarding-swipe-hint';
    wrap.innerHTML = `
      <span class="feed-onboarding-swipe-hint-arrow" aria-hidden="true">↑</span>
      <p class="feed-onboarding-swipe-hint-text">Свайпни вверх, чтобы перейти к следующей игре</p>
    `;
    inner.appendChild(wrap);
    hintEl = wrap;
    hintActive = true;
    requestAnimationFrame(() => wrap.classList.add('feed-onboarding-swipe-hint--visible'));
    attachHintTapToDismiss();
  }

  function teardownUi() {
    clearTimers();
    demoRunning = false;
    document.body.classList.remove(
      'feed-onboarding-ui',
      'feed-onboarding-active',
      'feed-onboarding-demo'
    );
    const root = rootEl();
    if (root) {
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
      root.querySelector('#feed-onboarding-welcome')?.classList.remove('feed-onboarding-welcome--visible');
      root.querySelector('#feed-onboarding-dismiss')?.setAttribute('hidden', '');
      root.querySelector('#feed-onboarding-hand')?.setAttribute('hidden', '');
      root.querySelector('.feed-onboarding-brand')?.classList.remove('feed-onboarding-brand--in');
    }
    const hand = document.getElementById('feed-onboarding-hand');
    if (hand) {
      hand.classList.remove('feed-onboarding-hand--show', 'feed-onboarding-hand--lift', 'feed-onboarding-hand--hide');
    }
    removeSwipeHint();
    resetSlideTransforms();
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

  function runDemoSequence() {
    const slides = window.slides;
    if (!Array.isArray(slides) || slides.length < 2) return;

    const s0 = slides[0];
    const s1 = slides[1];
    const vert = window.FEED_VERTICAL !== false;
    if (!vert || !s0 || !s1) return;

    const idx = window.currentIdx || 0;
    demoRunning = true;
    document.body.classList.remove('feed-onboarding-active');
    document.body.classList.add('feed-onboarding-demo');

    const base = i => (i - idx) * 100;

    const apply = (demo0, demo1, ms, ease) => {
      const tr = ms > 0 ? `transform ${ms}ms ${ease}` : 'none';
      s0.style.transition = tr;
      s1.style.transition = tr;
      s0.style.transform = `translate3d(0,${base(0) + demo0}%,0)`;
      s1.style.transform = `translate3d(0,${base(1) + demo1}%,0)`;
    };

    apply(0, 0, 0, LIFT_EASE);
    void s0.offsetWidth;

    const dismiss = document.getElementById('feed-onboarding-dismiss');
    dismiss?.removeAttribute('hidden');
    dismiss?.removeAttribute('aria-hidden');

    const hand = document.getElementById('feed-onboarding-hand');
    hand?.removeAttribute('hidden');
    hand?.removeAttribute('aria-hidden');
    requestAnimationFrame(() => {
      hand?.classList.add('feed-onboarding-hand--show');
    });

    schedule(() => {
      if (!demoRunning) return;
      hand?.classList.add('feed-onboarding-hand--lift');
      apply(-50, -50, LIFT_MS, LIFT_EASE);
    }, 80);

    /* Пик: hold, затем возврат (80 + lift + hold от старта демо) */
    schedule(() => {
      if (!demoRunning) return;
      hand?.classList.remove('feed-onboarding-hand--lift');
      hand?.classList.add('feed-onboarding-hand--hide');
      apply(0, 0, RETURN_MS, LIFT_EASE);
      schedule(() => {
        hand?.classList.remove('feed-onboarding-hand--show', 'feed-onboarding-hand--hide');
        hand?.setAttribute('hidden', '');
        hand?.setAttribute('aria-hidden', 'true');
        dismiss?.setAttribute('hidden', '');
        dismiss?.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('feed-onboarding-demo');
        demoRunning = false;
        s0.style.transition = '';
        s1.style.transition = '';
        s0.style.transform = '';
        s1.style.transform = '';
      }, RETURN_MS + 40);
    }, 80 + LIFT_MS + HOLD_MS);

    schedule(() => {
      if (storageDone()) return;
      showSwipeHintOnFirstSlide();
    }, HINT_AT_MS);
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
    schedule(runDemoSequence, 320);
  }
  window.onFeedOnboardingWelcomeCta = onWelcomeCta;

  function onWelcomeBackdropClick(ev) {
    if (ev.target.closest('.feed-onboarding-welcome-cta')) return;
    interruptToClose();
  }

  function onDismissTap() {
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
    const root = rootEl();
    const welcome = document.getElementById('feed-onboarding-welcome');
    const dismiss = document.getElementById('feed-onboarding-dismiss');
    welcome?.addEventListener('click', onWelcomeBackdropClick);
    dismiss?.addEventListener('click', onDismissTap);
    dismiss?.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      ev.stopPropagation();
    });
  }

  function notifyFeedOnboardingUserSwipe() {
    if (!hintActive) return;
    removeSwipeHint();
    completeOnboarding();
  }

  window.maybeStartFeedOnboarding = maybeStartFeedOnboarding;
  window.isFeedOnboardingBlocking = function isFeedOnboardingBlocking() {
    return document.body.classList.contains('feed-onboarding-ui');
  };
  window.notifyFeedOnboardingUserSwipe = notifyFeedOnboardingUserSwipe;
  window.initFeedOnboardingUi = initFeedOnboardingUi;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFeedOnboardingUi);
  } else {
    initFeedOnboardingUi();
  }
})();
