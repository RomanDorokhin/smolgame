/**
 * Свайп сверху вниз по шапке полноэкранного экрана — закрыть (как pull в нативных sheet).
 */
const PULL_CLOSE_THRESHOLD = 72;
const PULL_HANDLE_ZONE = 120;

function closestOverlayScreen(el) {
  return el?.closest?.(
    '#profile-screen, #author-screen, #search-screen, #upload-screen'
  );
}

function isOverlayOpen() {
  return Boolean(document.querySelector(
    '#profile-screen.open, #author-screen.open, #search-screen.open, #upload-screen.open'
  ));
}

function closeOverlayScreen(screen) {
  if (!screen) return;
  if (screen.id === 'profile-screen' && typeof closeProfile === 'function') closeProfile();
  else if (screen.id === 'author-screen' && typeof closeAuthorScreen === 'function') closeAuthorScreen();
  else if (screen.id === 'search-screen' && typeof closeSearch === 'function') closeSearch();
  else if (screen.id === 'upload-screen' && typeof closeUpload === 'function') closeUpload();
}

document.addEventListener('DOMContentLoaded', () => {
  let startY = 0;
  let pulling = false;
  let screenEl = null;

  document.addEventListener(
    'touchstart',
    e => {
      if (!isOverlayOpen()) return;
      const t = e.targetTouches[0];
      if (!t) return;
      const screen = closestOverlayScreen(e.target);
      if (!screen || !screen.classList.contains('open')) return;
      if (t.clientY > PULL_HANDLE_ZONE) return;
      startY = t.clientY;
      pulling = true;
      screenEl = screen;
    },
    { passive: true }
  );

  document.addEventListener(
    'touchmove',
    e => {
      if (!pulling || !screenEl) return;
      const t = e.targetTouches[0];
      if (!t) return;
      const dy = t.clientY - startY;
      if (dy > 24) e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    'touchend',
    e => {
      if (!pulling || !screenEl) {
        pulling = false;
        screenEl = null;
        return;
      }
      const t = e.changedTouches[0];
      const dy = t ? t.clientY - startY : 0;
      pulling = false;
      const toClose = screenEl;
      screenEl = null;
      if (dy > PULL_CLOSE_THRESHOLD) closeOverlayScreen(toClose);
    },
    { passive: true }
  );

  document.addEventListener('touchcancel', () => {
    pulling = false;
    screenEl = null;
  });
});
