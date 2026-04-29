/**
 * Подсказки ленты: первый показ (localStorage feedNavTip).
 */
function feedNavTipOverlayEl() {
  return document.getElementById('feed-nav-tip-overlay');
}

function setFeedNavTipDetail(on) {
  feedNavTipOverlayEl()?.classList.toggle('feed-nav-tip--detail', Boolean(on));
}

function closeFeedNavTip() {
  setFeedNavTipDetail(false);
  feedNavTipOverlayEl()?.classList.remove('feed-nav-tip-visible');
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
  setFeedNavTipDetail(false);
  feedNavTipOverlayEl()?.classList.add('feed-nav-tip-visible');
}

function openFeedHelpFull() {
  const o = feedNavTipOverlayEl();
  if (!o) return;
  o.classList.add('feed-nav-tip-visible');
  setFeedNavTipDetail(true);
}

function leaveFeedHelpDetail() {
  setFeedNavTipDetail(false);
}

/** После первого смены игры — убрать анимацию-подсказку свайпа */
function markFeedSwipeLearned() {
  try {
    if (localStorage.getItem(STORAGE_KEYS.feedSwipeLearned) === '1') return;
    localStorage.setItem(STORAGE_KEYS.feedSwipeLearned, '1');
  } catch (e) { /* ignore */ }
  if (typeof clearFeedSwipeTeaseCoaching === 'function') clearFeedSwipeTeaseCoaching();
}

function refreshFeedCoachState() {
  if (typeof clearFeedSwipeTeaseCoaching === 'function') clearFeedSwipeTeaseCoaching();
  if (typeof queueMaybeOfferFeedSwipeTease === 'function') queueMaybeOfferFeedSwipeTease();
}

function maybeShowFeedNavTipAfterGames() {
  const overlay = feedNavTipOverlayEl();
  if (!overlay) return;
  if (document.body.classList.contains('feed-onboarding-ui')) return;
  if (document.getElementById('onboarding-screen')?.classList.contains('open')) return;
  if (!GAMES || GAMES.length === 0) return;
  try {
    if (localStorage.getItem(STORAGE_KEYS.feedNavTip) === '1') return;
  } catch (e) { /* ignore */ }
  setFeedNavTipDetail(false);
  // После сплэша не всплывать сразу поверх ленты — короткая пауза и плавное появление (CSS).
  setTimeout(() => {
    if (document.getElementById('onboarding-screen')?.classList.contains('open')) return;
    if (!GAMES || GAMES.length === 0) return;
    overlay.classList.add('feed-nav-tip-visible');
    refreshFeedCoachState();
  }, 450);
}

window.closeFeedNavTip = closeFeedNavTip;
window.ackFeedNavTip = ackFeedNavTip;
window.openFeedHelp = openFeedHelp;
window.openFeedHelpFull = openFeedHelpFull;
window.leaveFeedHelpDetail = leaveFeedHelpDetail;
window.markFeedSwipeLearned = markFeedSwipeLearned;
window.refreshFeedCoachState = refreshFeedCoachState;
window.dismissFeedNavTip = ackFeedNavTip;
window.maybeShowFeedNavTipAfterGames = maybeShowFeedNavTipAfterGames;
