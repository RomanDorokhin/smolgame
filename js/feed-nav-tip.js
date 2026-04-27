/**
 * Одноразовая подсказка: где листать ленту (localStorage по STORAGE_KEYS.feedNavTip).
 */
function dismissFeedNavTip() {
  try {
    localStorage.setItem(STORAGE_KEYS.feedNavTip, '1');
  } catch (e) { /* ignore */ }
  document.getElementById('feed-nav-tip-overlay')?.classList.remove('feed-nav-tip-visible');
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
}

function feedNavPrev() {
  if (GAMES.length < 2 || window.currentIdx <= 0) return;
  goTo(window.currentIdx - 1);
  hideSwipeHint();
}

function feedNavNext() {
  if (GAMES.length < 2 || window.currentIdx >= GAMES.length - 1) return;
  goTo(window.currentIdx + 1);
  hideSwipeHint();
}

window.dismissFeedNavTip = dismissFeedNavTip;
window.maybeShowFeedNavTipAfterGames = maybeShowFeedNavTipAfterGames;
window.feedNavPrev = feedNavPrev;
window.feedNavNext = feedNavNext;
