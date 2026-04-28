/**
 * Подсказки ленты: первый показ (localStorage feedNavTip) + кнопка «Справка».
 */
function closeFeedNavTip() {
  document.getElementById('feed-nav-tip-overlay')?.classList.remove('feed-nav-tip-visible');
  if (typeof maybeFeedSwipeTeaseAfterOverlayClosed === 'function') {
    maybeFeedSwipeTeaseAfterOverlayClosed();
  }
}

function ackFeedNavTip() {
  try {
    localStorage.setItem(STORAGE_KEYS.feedNavTip, '1');
  } catch (e) { /* ignore */ }
  closeFeedNavTip();
}

function openFeedHelp() {
  document.getElementById('feed-nav-tip-overlay')?.classList.add('feed-nav-tip-visible');
}

/** После первого смены игры — убираем пульсацию полоски и FAB-подсказку */
function markFeedSwipeLearned() {
  try {
    if (localStorage.getItem(STORAGE_KEYS.feedSwipeLearned) === '1') return;
    localStorage.setItem(STORAGE_KEYS.feedSwipeLearned, '1');
  } catch (e) { /* ignore */ }
  document.getElementById('swipe-strip')?.classList.remove('swipe-strip--coach');
  document.getElementById('feed-coach-fab')?.setAttribute('hidden', '');
  if (typeof clearFeedSwipeTeaseCoaching === 'function') clearFeedSwipeTeaseCoaching();
}

function refreshFeedCoachState() {
  const strip = document.getElementById('swipe-strip');
  const fab = document.getElementById('feed-coach-fab');
  if (!strip) return;
  let learned = false;
  try {
    learned = localStorage.getItem(STORAGE_KEYS.feedSwipeLearned) === '1';
  } catch (e) { /* ignore */ }
  const multi = Array.isArray(GAMES) && GAMES.length >= 2;
  const visible = strip.style.display !== 'none';
  if (!multi || !visible) {
    strip.classList.remove('swipe-strip--coach');
    fab?.setAttribute('hidden', '');
    if (typeof clearFeedSwipeTeaseCoaching === 'function') clearFeedSwipeTeaseCoaching();
    return;
  }
  if (learned) {
    strip.classList.remove('swipe-strip--coach');
    fab?.setAttribute('hidden', '');
    if (typeof clearFeedSwipeTeaseCoaching === 'function') clearFeedSwipeTeaseCoaching();
  } else {
    strip.classList.add('swipe-strip--coach');
    fab?.removeAttribute('hidden');
    if (typeof queueMaybeOfferFeedSwipeTease === 'function') queueMaybeOfferFeedSwipeTease();
  }
}

function maybeShowFeedNavTipAfterGames() {
  const overlay = document.getElementById('feed-nav-tip-overlay');
  if (!overlay) return;
  if (document.getElementById('onboarding-screen')?.classList.contains('open')) return;
  if (!GAMES || GAMES.length === 0) return;
  try {
    if (localStorage.getItem(STORAGE_KEYS.feedNavTip) === '1') return;
  } catch (e) { /* ignore */ }
  overlay.classList.add('feed-nav-tip-visible');
  refreshFeedCoachState();
}

function feedNavPrev() {
  if (window.FEED_VERTICAL) {
    if (GAMES.length < 2 || window.currentIdx >= GAMES.length - 1) return;
    goTo(window.currentIdx + 1);
  } else {
    if (GAMES.length < 2 || window.currentIdx <= 0) return;
    goTo(window.currentIdx - 1);
  }
  hideSwipeHint();
}

function feedNavNext() {
  if (window.FEED_VERTICAL) {
    if (GAMES.length < 2 || window.currentIdx <= 0) return;
    goTo(window.currentIdx - 1);
  } else {
    if (GAMES.length < 2 || window.currentIdx >= GAMES.length - 1) return;
    goTo(window.currentIdx + 1);
  }
  hideSwipeHint();
}

window.closeFeedNavTip = closeFeedNavTip;
window.ackFeedNavTip = ackFeedNavTip;
window.openFeedHelp = openFeedHelp;
window.markFeedSwipeLearned = markFeedSwipeLearned;
window.refreshFeedCoachState = refreshFeedCoachState;
window.dismissFeedNavTip = ackFeedNavTip;
window.maybeShowFeedNavTipAfterGames = maybeShowFeedNavTipAfterGames;
window.feedNavPrev = feedNavPrev;
window.feedNavNext = feedNavNext;
