/**
 * Подсказки ленты: первый показ (localStorage feedNavTip).
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

window.closeFeedNavTip = closeFeedNavTip;
window.ackFeedNavTip = ackFeedNavTip;
window.openFeedHelp = openFeedHelp;
window.markFeedSwipeLearned = markFeedSwipeLearned;
window.refreshFeedCoachState = refreshFeedCoachState;
window.dismissFeedNavTip = ackFeedNavTip;
window.maybeShowFeedNavTipAfterGames = maybeShowFeedNavTipAfterGames;
