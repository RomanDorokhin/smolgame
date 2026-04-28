const FEED_PAGE_SIZE = 15;

window.feedHasMore = true;
window.feedLoadingMore = false;
/** Сколько опубликованных игр уже подгружено (без очереди модерации в начале). */
window.feedPublishedLoaded = 0;

function feedEl() {
  return document.getElementById('feed');
}

/** Класс всплеска на body — двигаются #feed и стрелка «следующая» синхронно */
function feedSwipeTeaseBurstBody() {
  return document.body;
}

function mergePendingIntoFeed(pendingQueue, published) {
  const pq = Array.isArray(pendingQueue) ? pendingQueue : [];
  const pub = Array.isArray(published) ? published : [];
  const seen = new Set();
  const out = [];
  for (const g of pq) {
    if (!g?.id || seen.has(g.id)) continue;
    seen.add(g.id);
    out.push({ ...g, status: 'pending', isModerationQueue: true });
  }
  for (const g of pub) {
    if (!g?.id || seen.has(g.id)) continue;
    seen.add(g.id);
    out.push(g);
  }
  return out;
}

async function loadGames() {
  window.feedHasMore = true;
  window.feedLoadingMore = false;
  window.feedPublishedLoaded = 0;
  try {
    const data = await API.feed({ offset: 0, limit: FEED_PAGE_SIZE });
    const published = Array.isArray(data?.games) ? data.games : [];
    window.feedPublishedLoaded = published.length;
    if (data?.isAdmin === true) {
      document.body.classList.add('is-admin');
    }
    if (data?.isAdmin === true && Array.isArray(data.pendingQueue) && data.pendingQueue.length > 0) {
      window.GAMES = mergePendingIntoFeed(data.pendingQueue, published);
    } else {
      window.GAMES = published;
    }
    window.feedHasMore = data?.hasMore !== false;

    window.likedSet = new Set(GAMES.filter(g => g.isLiked).map(g => g.id));
    window.followedSet = new Set(GAMES.filter(g => g.isFollowing).map(g => g.authorId));
    window.bookmarkedSet = new Set(GAMES.filter(g => g.isBookmarked).map(g => g.id));
    for (const g of GAMES) {
      if (g.isLiked) bookmarkedSet.add(g.id);
      if (g.isBookmarked) likedSet.add(g.id);
    }
    saveSet(STORAGE_KEYS.liked, likedSet);
    saveSet(STORAGE_KEYS.followed, followedSet);
    saveSet(STORAGE_KEYS.bookmarked, bookmarkedSet);
  } catch (e) {
    console.error('feed load failed', e);
    window.GAMES = [];
    window.feedHasMore = false;
  }
  renderFeed();
}

function mergeInteractionSetsFromGames(games) {
  if (!Array.isArray(games)) return;
  for (const g of games) {
    if (g.isLiked) {
      likedSet.add(g.id);
      bookmarkedSet.add(g.id);
    }
    if (g.isFollowing) followedSet.add(g.authorId);
    if (g.isBookmarked) bookmarkedSet.add(g.id);
  }
  saveSet(STORAGE_KEYS.liked, likedSet);
  saveSet(STORAGE_KEYS.followed, followedSet);
  saveSet(STORAGE_KEYS.bookmarked, bookmarkedSet);
}

async function loadMoreFeed() {
  if (!feedHasMore || feedLoadingMore || GAMES.length === 0) return;
  feedLoadingMore = true;
  try {
    const data = await API.feed({ offset: feedPublishedLoaded, limit: FEED_PAGE_SIZE });
    const batch = Array.isArray(data?.games) ? data.games : [];
    window.feedHasMore = typeof data?.hasMore === 'boolean'
      ? data.hasMore
      : batch.length >= FEED_PAGE_SIZE;

    const seen = new Set(GAMES.map(g => g.id));
    const fresh = batch.filter(g => g && g.id && !seen.has(g.id));
    if (fresh.length === 0) {
      window.feedHasMore = false;
      return;
    }

    window.feedPublishedLoaded += fresh.length;
    mergeInteractionSetsFromGames(fresh);
    const start = GAMES.length;
    GAMES.push(...fresh);
    appendSlides(start, fresh);
  } catch (e) {
    console.warn('feed load more failed', e);
  } finally {
    feedLoadingMore = false;
  }
}

function maybeLoadMoreFeed() {
  if (!feedHasMore || feedLoadingMore) return;
  if (window.currentIdx >= GAMES.length - 5) loadMoreFeed();
}

/** Подставить игру в конец ленты (если её ещё нет) и вернуть индекс. */
async function injectGameIntoFeed(gameId) {
  if (!gameId) return window.currentIdx;
  const existing = GAMES.findIndex(g => g.id === gameId);
  if (existing >= 0) return existing;
  try {
    const data = await API.game(gameId);
    const game = data?.game;
    if (!game?.id) return window.currentIdx;
    const prevLen = GAMES.length;
    const idx = prevLen;
    if (game.isLiked) {
      likedSet.add(game.id);
      bookmarkedSet.add(game.id);
    }
    if (game.isFollowing && game.authorId) followedSet.add(game.authorId);
    if (game.isBookmarked) bookmarkedSet.add(game.id);
    saveSet(STORAGE_KEYS.liked, likedSet);
    saveSet(STORAGE_KEYS.followed, followedSet);
    saveSet(STORAGE_KEYS.bookmarked, bookmarkedSet);
    GAMES.push(game);
    appendSlides(idx, [game]);
    if (prevLen === 0) {
      document.getElementById('empty-state').classList.remove('show');
      document.getElementById('side-actions').style.display = '';
      document.getElementById('game-info').style.display = '';
      document.getElementById('swipe-strip').style.display = '';
      goTo(0, true);
    }
    return idx;
  } catch (e) {
    showToast('⚠️ ' + (e.message || 'не удалось открыть игру'));
    return window.currentIdx;
  }
}

function appendSlides(startIndex, gamesSlice) {
  const feed = feedEl();
  const dots = document.getElementById('dots');
  if (!feed || !dots) return;

  gamesSlice.forEach((g, j) => {
    const i = startIndex + j;
    const slide = document.createElement('div');
    slide.className = 'slide';
    slide.id = 'slide-' + i;
    slide.classList.toggle('feed-slide--active', i === window.currentIdx);
    slide.classList.toggle('feed-slide--inactive', i !== window.currentIdx);
    slide.style.left = '';
    slide.style.transform = `translate3d(${(i - window.currentIdx) * 100}%,0,0)`;

    const placeholder = document.createElement('div');
    placeholder.className = 'slide-placeholder';
    const thumbHtml = g.imageUrl
      ? `<img src="${esc(g.imageUrl)}" class="slide-cover" alt="">`
      : `<div class="placeholder-icon sg-placeholder-genre">${typeof genreIconForGame === 'function' ? genreIconForGame(g) : ''}</div>`;
    const statusBanner = g.status === 'pending'
      ? '<div class="slide-status-banner">На модерации</div>'
      : g.status === 'rejected'
        ? '<div class="slide-status-banner slide-status-rejected">Не прошла модерацию</div>'
        : '';
    placeholder.innerHTML = `
      ${statusBanner}
      ${thumbHtml}
      <div class="placeholder-title">${esc(g.title)}</div>
      <div class="placeholder-sub">Загрузка…</div>
      ${typeof sgLogoMarkLoaderHtml === 'function' ? sgLogoMarkLoaderHtml() : '<div class="loader-ring"></div>'}
    `;

    const iframe = document.createElement('iframe');
    iframe.className = 'slide-game';
    iframe.id = 'iframe-' + i;
    iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups');
    iframe.setAttribute('allow', 'autoplay');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('loading', 'lazy');
    iframe.style.opacity = '0';
    iframe.style.transition = 'opacity 0.3s';

    iframe.onload = () => {
      iframe.style.opacity = '1';
      placeholder.classList.add('hidden');
      trackPlay(g.id);
    };

    iframe.onerror = () => {
      placeholder.innerHTML = `
        <div class="placeholder-icon">💔</div>
        <div class="placeholder-title">Не загрузилась</div>
        <div class="placeholder-sub">${esc(g.url)}</div>
      `;
    };

    const safeUrl = safeHttpUrl(g.url);
    if (!safeUrl) {
      placeholder.innerHTML = `
        <div class="placeholder-icon">⚠️</div>
        <div class="placeholder-title">${esc(g.title)}</div>
        <div class="placeholder-sub">Некорректная ссылка</div>
      `;
      slide.appendChild(placeholder);
      feed.appendChild(slide);
      window.slides.push(slide);
      const dot = document.createElement('div');
      dot.className = 'dot' + (i === window.currentIdx ? ' active' : '');
      dot.id = 'dot-' + i;
      dots.appendChild(dot);
      return;
    }

    if (Math.abs(i - window.currentIdx) <= 1) {
      iframe.src = safeUrl;
    }
    iframe.dataset.src = safeUrl;

    slide.appendChild(placeholder);
    slide.appendChild(iframe);
    if (g.isModerationQueue && document.body.classList.contains('is-admin')) {
      const mod = document.createElement('div');
      mod.className = 'feed-moderation-card';
      mod.dataset.gameId = g.id;
      mod.innerHTML = `
        <div class="feed-moderation-actions">
          <button type="button" class="admin-btn approve" data-action="admin-approve">✓ Одобрить</button>
          <button type="button" class="admin-btn reject" data-action="admin-reject">✗ Отклонить</button>
          <button type="button" class="admin-btn delete" data-action="admin-delete">🗑</button>
        </div>`;
      slide.appendChild(mod);
    }
    feed.appendChild(slide);
    window.slides.push(slide);

    const dot = document.createElement('div');
    dot.className = 'dot' + (i === window.currentIdx ? ' active' : '');
    dot.id = 'dot-' + i;
    dots.appendChild(dot);
  });
}

function renderFeed() {
  const feed = feedEl();
  const dots = document.getElementById('dots');
  feed.innerHTML = '';
  dots.innerHTML = '';
  window.slides = [];

  if (GAMES.length === 0) {
    document.getElementById('empty-state').classList.add('show');
    document.getElementById('side-actions').style.display = 'none';
    document.getElementById('game-info').style.display = 'none';
    document.getElementById('swipe-strip').style.display = 'none';
    document.getElementById('feed-coach-fab')?.setAttribute('hidden', '');
    document.getElementById('swipe-strip')?.classList.remove('swipe-strip--coach');
    const ft = document.getElementById('feed-transition');
    if (ft) {
      ft.classList.remove('feed-transition--show');
      ft.setAttribute('hidden', '');
    }
    clearTimeout(feedTransHideT1);
    clearTimeout(feedTransHideT2);
    return;
  }

  document.getElementById('empty-state').classList.remove('show');
  document.getElementById('side-actions').style.display = '';
  document.getElementById('game-info').style.display = '';
  document.getElementById('swipe-strip').style.display = '';

  appendSlides(0, GAMES);
  goTo(0, true);
  if (typeof refreshFeedCoachState === 'function') refreshFeedCoachState();
  if (typeof queueMaybeOfferFeedSwipeTease === 'function') queueMaybeOfferFeedSwipeTease();
}

function lazyLoadAround(idx) {
  GAMES.forEach((g, i) => {
    if (Math.abs(i - idx) <= 1) {
      const iframe = document.getElementById('iframe-' + i);
      if (iframe && !iframe.src && iframe.dataset.src) {
        iframe.src = iframe.dataset.src;
      }
    }
  });
}

function hapticFeedNav() {
  try {
    Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
  } catch (e) { /* ignore */ }
}

/** Длительность «карточки» в секундах — совпадает с CSS-ощущением Tinder-like */
const FEED_CARD_TRANSITION_SEC = 0.56;
const FEED_LOGO_OVERLAY_MS = Math.round(FEED_CARD_TRANSITION_SEC * 1000) + 140;
const FEED_LOGO_FADEOUT_MS = 260;
let feedTransHideT1 = 0;
let feedTransHideT2 = 0;

function showBetweenGamesLogoOverlay() {
  const el = document.getElementById('feed-transition');
  if (!el) return;
  el.removeAttribute('hidden');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('feed-transition--show'));
  });
  clearTimeout(feedTransHideT1);
  clearTimeout(feedTransHideT2);
  feedTransHideT1 = setTimeout(() => {
    el.classList.remove('feed-transition--show');
    feedTransHideT2 = setTimeout(() => {
      el.setAttribute('hidden', '');
    }, FEED_LOGO_FADEOUT_MS);
  }, FEED_LOGO_OVERLAY_MS);
}

function updateFeedNavArrows() {
  const prevBtn = document.querySelector('[data-action="feed-nav-prev"]');
  const nextBtn = document.querySelector('[data-action="feed-nav-next"]');
  const n = GAMES.length;
  const i = window.currentIdx;
  if (prevBtn) prevBtn.disabled = n < 2 || i <= 0;
  if (nextBtn) nextBtn.disabled = n < 2 || i >= n - 1;
}

function updateSlidePointerEvents() {
  if (!Array.isArray(window.slides)) return;
  window.slides.forEach((slideEl, i) => {
    const on = i === window.currentIdx;
    slideEl.classList.toggle('feed-slide--active', on);
    slideEl.classList.toggle('feed-slide--inactive', !on);
  });
}

function goTo(idx, instant = false) {
  if (GAMES.length === 0) return;

  const prevIdx = window.currentIdx;
  window.currentIdx = Math.max(0, Math.min(GAMES.length - 1, idx));
  if (prevIdx !== window.currentIdx) {
    resetSwipeHint();
    if (!instant) {
      hapticFeedNav();
      showBetweenGamesLogoOverlay();
      if (typeof markFeedSwipeLearned === 'function') markFeedSwipeLearned();
    }
  }

  window.slides.forEach((s, i) => {
    s.style.left = '';
    s.style.transition = instant
      ? 'none'
      : `transform ${FEED_CARD_TRANSITION_SEC}s cubic-bezier(0.25, 0.82, 0.3, 1)`;
    s.style.transform = `translate3d(${(i - window.currentIdx) * 100}%,0,0)`;
  });

  document.querySelectorAll('.dot').forEach((d, i) =>
    d.classList.toggle('active', i === window.currentIdx)
  );

  updateOverlay();
  lazyLoadAround(window.currentIdx);
  maybeLoadMoreFeed();
  updateFeedNavArrows();
  updateSlidePointerEvents();
  if (prevIdx !== window.currentIdx && !instant && typeof scheduleFeedSwipeTeaseBoredom === 'function') {
    scheduleFeedSwipeTeaseBoredom();
  }
}

function updateOverlay() {
  if (GAMES.length === 0) return;
  const g = GAMES[window.currentIdx];
  if (!g) return;

  const titleEl = document.getElementById('gameTitle');
  const sepEl = document.getElementById('gameMetaSep');
  const genreEl = document.getElementById('gameGenreInline');

  titleEl.textContent = g.title || '—';

  if (g.genre) {
    const icon =
      typeof genreIconForGame === 'function'
        ? genreIconForGame(g)
        : '';
    genreEl.innerHTML = `${icon}<span class="game-genre-label">${esc(g.genre)}</span>`;
    genreEl.hidden = false;
    sepEl.hidden = false;
  } else {
    genreEl.innerHTML = '';
    genreEl.hidden = true;
    sepEl.hidden = true;
  }

  document.getElementById('authorName').textContent = g.authorName;

  const avatar = document.getElementById('authorAvatar');
  const avatarUrl = avatarImgUrl(g.authorAvatar);
  if (avatarUrl) {
    avatar.innerHTML = `<img src="${esc(avatarUrl)}" alt="" referrerpolicy="no-referrer">`;
  } else {
    avatar.textContent = g.authorAvatar || g.authorName?.[0] || '?';
  }

  const liked = likedSet.has(g.id);
  const likeIcon = document.getElementById('likeIcon');
  likeIcon.innerHTML = likeIconMarkup(liked);
  likeIcon.classList.toggle('active-like', liked);
  document.querySelector('[data-action="toggle-like"]')?.classList.toggle('active-like-row', liked);
  document.getElementById('likeCount').textContent = fmtNum(g.likes + (liked ? 1 : 0));
  document.getElementById('playsCount').textContent = fmtNum(g.plays);

  const following = followedSet.has(g.authorId);
  const followBtn = document.getElementById('followBtn');
  followBtn.textContent = following ? 'Вы подписаны' : '+ Подписаться';
  followBtn.classList.toggle('following', following);

}

/** Горизонт в полоске: влево = следующая, вправо = предыдущая (как карточки) */
const SWIPE_HORIZ_PX = 48;
const SWIPE_HORIZ_VELOCITY = 0.28;
const MOVE_THRESHOLD_PX = 10;
/** Жест «вниз» в полоске на первом слайде — отдать закрытию Telegram */
const TELEGRAM_PASS_DOWN_PX = 14;

let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let touchMoved = false;
let touching = false;
let activePointerId = null;

function isOverlayOpen() {
  return Boolean(document.querySelector(
    '#upload-screen.open, #profile-screen.open, #search-screen.open, #author-screen.open, #onboarding-screen.open, #feed-nav-tip-overlay.feed-nav-tip-visible'
  ));
}

function swipeNavStrip() {
  return document.getElementById('swipe-strip');
}

function clearTelegramSwipePass() {
  swipeNavStrip()?.classList.remove('telegram-swipe-pass');
}

/** Визуал «трека» свайпа: ручка и подсветка следуют за горизонтальным жестом */
function resetSwipeStripDragVisual(stripEl) {
  const s = stripEl || document.getElementById('swipe-strip');
  if (!s) return;
  s.style.removeProperty('--swipe-dx');
  s.style.removeProperty('--swipe-pull-abs');
}

function updateSwipeStripDragVisual(stripEl, dx) {
  const strip = stripEl || document.getElementById('swipe-strip');
  const track = document.getElementById('swipe-strip-track');
  if (!strip || !track) return;
  const w = track.getBoundingClientRect().width;
  const halfHandle = 20;
  const max = Math.max(12, w / 2 - halfHandle - 2);
  const clamped = Math.max(-max, Math.min(max, dx));
  strip.style.setProperty('--swipe-dx', clamped + 'px');
  const pull = Math.min(1, Math.abs(dx) / Math.max(36, max * 1.1));
  strip.style.setProperty('--swipe-pull-abs', String(pull));
}

let swipeDragHost = null;

function feedPointerDown(e, dragHost) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (isOverlayOpen() || GAMES.length === 0) return;
  const strip = document.getElementById('swipe-strip');
  if (strip?.style.display === 'none') return;

  if (dragHost === strip && typeof onSwipeStripUserActivity === 'function') {
    onSwipeStripUserActivity();
  }
  if (dragHost === strip) {
    resetSwipeStripDragVisual(strip);
    feedSwipeTeaseBurstBody().classList.remove('feed-swipe-tease-burst');
  }

  touching = true;
  activePointerId = e.pointerId;
  swipeDragHost = dragHost;
  touchStartX = e.clientX;
  touchStartY = e.clientY;
  touchStartTime = Date.now();
  touchMoved = false;
  clearTelegramSwipePass();
  dragHost.classList.add('dragging');
  try {
    dragHost.setPointerCapture(e.pointerId);
  } catch (err) {
    /* setPointerCapture может бросить на старых WebView */
  }
}

function feedPointerMove(e, dragHost) {
  if (!touching || e.pointerId !== activePointerId || dragHost !== swipeDragHost) return;
  const strip = swipeNavStrip();
  const dx = e.clientX - touchStartX;
  const dy = e.clientY - touchStartY;
  const verticalDominant = Math.abs(dy) > Math.abs(dx) * 1.15;

  if (window.currentIdx === 0 && verticalDominant && dy > TELEGRAM_PASS_DOWN_PX) {
    const passPid = e.pointerId;
    try { dragHost.releasePointerCapture(e.pointerId); } catch (err) {}
    touching = false;
    activePointerId = null;
    swipeDragHost = null;
    dragHost.classList.remove('dragging');
    resetSwipeStripDragVisual(strip);
    swipeNavStrip()?.classList.add('telegram-swipe-pass');
    const onLift = ev => {
      if (ev.pointerId !== passPid) return;
      clearTelegramSwipePass();
      window.removeEventListener('pointerup', onLift, true);
      window.removeEventListener('pointercancel', onLift, true);
    };
    window.addEventListener('pointerup', onLift, true);
    window.addEventListener('pointercancel', onLift, true);
    return;
  }

  if (
    Math.abs(dx) > MOVE_THRESHOLD_PX ||
    Math.abs(dy) > MOVE_THRESHOLD_PX
  ) {
    touchMoved = true;
    e.preventDefault();
  }

  if (dragHost === strip && Math.abs(dx) > 8 && Math.abs(dx) >= Math.abs(dy) * 0.75) {
    if (typeof markFeedSwipeLearned === 'function') markFeedSwipeLearned();
  }

  if (dragHost === strip) {
    const horiz = Math.abs(dx) >= Math.abs(dy) * 0.55 || Math.abs(dx) > 6;
    updateSwipeStripDragVisual(strip, horiz ? dx : dx * 0.2);
  }
}

function feedPointerUp(e, dragHost) {
  if (!touching || e.pointerId !== activePointerId || dragHost !== swipeDragHost) return;
  touching = false;
  activePointerId = null;
  swipeDragHost = null;
  dragHost.classList.remove('dragging');
  if (dragHost === swipeNavStrip()) resetSwipeStripDragVisual(dragHost);

  if (dragHost.classList.contains('telegram-swipe-pass')) {
    clearTelegramSwipePass();
    return;
  }

  if (!touchMoved) return;

  const now = Date.now();
  const x = e.clientX;
  const y = e.clientY;
  const dx = touchStartX - x;
  const dy = touchStartY - y;
  const duration = Math.max(1, now - touchStartTime);
  const vHoriz = Math.abs(dx) / duration;

  const horizontalIntent = Math.abs(dx) >= Math.abs(dy) * 0.85;

  if (horizontalIntent) {
    if (dx > SWIPE_HORIZ_PX || (dx > 22 && vHoriz > SWIPE_HORIZ_VELOCITY)) {
      goTo(window.currentIdx + 1);
      hideSwipeHint();
    } else if (dx < -SWIPE_HORIZ_PX || (dx < -22 && vHoriz > SWIPE_HORIZ_VELOCITY)) {
      if (window.currentIdx > 0) {
        goTo(window.currentIdx - 1);
        hideSwipeHint();
      }
    }
  }
  e.preventDefault();
}

function feedPointerCancel(e, dragHost) {
  if (!touching || e.pointerId !== activePointerId || dragHost !== swipeDragHost) return;
  touching = false;
  activePointerId = null;
  swipeDragHost = null;
  dragHost.classList.remove('dragging');
  if (dragHost === swipeNavStrip()) resetSwipeStripDragVisual(dragHost);
  clearTelegramSwipePass();
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('nav-feed')?.classList.contains('active')) {
    document.body.classList.add('is-tab-feed');
  }
  feedEl()?.addEventListener('animationend', onFeedSwipeTeaseBurstAnimationEnd);

  const strip = swipeNavStrip();
  if (!strip) return;

  strip.addEventListener('pointerdown', e => feedPointerDown(e, strip));
  strip.addEventListener('pointermove', e => feedPointerMove(e, strip));
  strip.addEventListener('pointerup', e => feedPointerUp(e, strip));
  strip.addEventListener('pointercancel', e => feedPointerCancel(e, strip));

  strip.addEventListener('wheel', e => {
    if (isOverlayOpen() || GAMES.length < 2) return;
    e.preventDefault();
    if (typeof onSwipeStripUserActivity === 'function') onSwipeStripUserActivity();
    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);
    if (absX >= absY) {
      if (absX < 18) return;
      if (e.deltaX < 0) goTo(window.currentIdx + 1);
      else if (window.currentIdx > 0) goTo(window.currentIdx - 1);
    } else {
      if (absY < 24) return;
      goTo(e.deltaY > 0 ? window.currentIdx + 1 : window.currentIdx - 1);
    }
    hideSwipeHint();
  }, { passive: false });
});

document.addEventListener('keydown', e => {
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  if (isOverlayOpen() || GAMES.length === 0) return;
  e.preventDefault();
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') goTo(window.currentIdx + 1);
  else if ((e.key === 'ArrowUp' || e.key === 'ArrowLeft') && window.currentIdx > 0) {
    goTo(window.currentIdx - 1);
  }
});

let swipeHintHidden = false;

function resetSwipeHint() {
  swipeHintHidden = false;
  const label = document.getElementById('swipe-hint-label');
  if (label) {
    label.style.display = '';
    label.style.opacity = '';
  }
}

function hideSwipeHint() {
  if (swipeHintHidden) return;
  swipeHintHidden = true;
  const label = document.getElementById('swipe-hint-label');
  if (label) {
    label.style.opacity = '0';
    setTimeout(() => { label.style.display = 'none'; }, 400);
  }
}

/** Раньше: idle-пульсация центра полоски. Отключено — мешала; отклик только от жеста. */
function clearSwipeStripIdleTimer() {}
function scheduleSwipeStripIdleNudge() {
  document.getElementById('swipe-strip')?.classList.remove('swipe-strip--idle-nudge');
}
function onSwipeStripUserActivity() {
  document.getElementById('swipe-strip')?.classList.remove('swipe-strip--idle-nudge');
  scheduleFeedSwipeTeaseBoredom();
}

window.scheduleSwipeStripIdleNudge = scheduleSwipeStripIdleNudge;
window.onSwipeStripUserActivity = onSwipeStripUserActivity;

/* ── «Дёрни экран» подсказка свайпа: короткие всплески, не бесконечный loop ── */
const FEED_SWIPE_TEASE_BOREDOM_MS = 18 * 1000; /* без действий на ленте — снова намекнуть */
let feedSwipeTeaseBoredomT = 0;
let feedSwipeTeaseOfferQueued = false;

function isFeedSwipeLearned() {
  try {
    return localStorage.getItem(STORAGE_KEYS.feedSwipeLearned) === '1';
  } catch (e) {
    return true;
  }
}

function hasFeedSwipeTeaseShownOnce() {
  try {
    return localStorage.getItem(STORAGE_KEYS.feedSwipeTeaseShown) === '1';
  } catch (e) {
    return false;
  }
}

function canGoNextInFeed() {
  return Array.isArray(GAMES) && GAMES.length >= 2 && window.currentIdx < GAMES.length - 1;
}

function canRunFeedSwipeTeaseBurst() {
  if (isFeedSwipeLearned()) return false;
  if (!document.body.classList.contains('is-tab-feed')) return false;
  if (typeof isOverlayOpen === 'function' && isOverlayOpen()) return false;
  if (document.getElementById('onboarding-screen')?.classList.contains('open')) return false;
  const strip = document.getElementById('swipe-strip');
  if (!strip || strip.style.display === 'none') return false;
  if (GAMES.length < 2) return false;
  if (!canGoNextInFeed()) return false;
  return true;
}

function clearFeedSwipeTeaseTimers() {
  if (feedSwipeTeaseBoredomT) {
    clearTimeout(feedSwipeTeaseBoredomT);
    feedSwipeTeaseBoredomT = 0;
  }
  if (feedSwipeTeaseFinishT) {
    clearTimeout(feedSwipeTeaseFinishT);
    feedSwipeTeaseFinishT = 0;
  }
}

/** Учился свайпать или ушли с coach — убрать всплеск и таймеры */
function clearFeedSwipeTeaseCoaching() {
  feedSwipeTeaseBurstBody().classList.remove('feed-swipe-tease-burst');
  clearFeedSwipeTeaseTimers();
}

/** Ушли с вкладки ленты (поиск, профиль, загрузка, карточка автора) — сразу убрать дёрганье */
function stopFeedSwipeTeaseForLeavingFeed() {
  feedSwipeTeaseBurstBody().classList.remove('feed-swipe-tease-burst');
  clearFeedSwipeTeaseTimers();
}

let feedSwipeTeaseFinishT = 0;

function finishFeedSwipeTeaseBurst() {
  const b = feedSwipeTeaseBurstBody();
  if (!b.classList.contains('feed-swipe-tease-burst')) return;
  b.classList.remove('feed-swipe-tease-burst');
  if (feedSwipeTeaseFinishT) {
    clearTimeout(feedSwipeTeaseFinishT);
    feedSwipeTeaseFinishT = 0;
  }
  if (!hasFeedSwipeTeaseShownOnce()) {
    try {
      localStorage.setItem(STORAGE_KEYS.feedSwipeTeaseShown, '1');
    } catch (e) { /* ignore */ }
  }
  scheduleFeedSwipeTeaseBoredom();
}

function startFeedSwipeTeaseBurst() {
  const b = feedSwipeTeaseBurstBody();
  b.classList.remove('feed-swipe-tease-burst');
  void b.offsetWidth;
  b.classList.add('feed-swipe-tease-burst');
  if (feedSwipeTeaseFinishT) clearTimeout(feedSwipeTeaseFinishT);
  /* animationend не срабатывает при prefers-reduced-motion — подстраховка */
  feedSwipeTeaseFinishT = setTimeout(() => {
    feedSwipeTeaseFinishT = 0;
    finishFeedSwipeTeaseBurst();
  }, 2800);
}

function scheduleFeedSwipeTeaseBoredom() {
  if (feedSwipeTeaseBoredomT) {
    clearTimeout(feedSwipeTeaseBoredomT);
    feedSwipeTeaseBoredomT = 0;
  }
  if (isFeedSwipeLearned()) return;
  if (!document.body.classList.contains('is-tab-feed')) return;
  if (!canRunFeedSwipeTeaseBurst()) return;
  feedSwipeTeaseBoredomT = setTimeout(() => {
    feedSwipeTeaseBoredomT = 0;
    if (canRunFeedSwipeTeaseBurst()) offerFeedSwipeTeaseIfDue();
    else scheduleFeedSwipeTeaseBoredom();
  }, FEED_SWIPE_TEASE_BOREDOM_MS);
}

function onFeedSwipeTeaseBurstAnimationEnd(ev) {
  if (ev.target !== feedEl() || ev.animationName !== 'feedSwipeTeaseBurst') return;
  if (feedSwipeTeaseFinishT) {
    clearTimeout(feedSwipeTeaseFinishT);
    feedSwipeTeaseFinishT = 0;
  }
  finishFeedSwipeTeaseBurst();
}

function offerFeedSwipeTeaseIfDue() {
  if (!canRunFeedSwipeTeaseBurst()) {
    scheduleFeedSwipeTeaseBoredom();
    return;
  }
  startFeedSwipeTeaseBurst();
}

function queueMaybeOfferFeedSwipeTease() {
  if (feedSwipeTeaseOfferQueued) return;
  feedSwipeTeaseOfferQueued = true;
  requestAnimationFrame(() => {
    feedSwipeTeaseOfferQueued = false;
    if (!canRunFeedSwipeTeaseBurst()) return;
    const tipOpen = document.getElementById('feed-nav-tip-overlay')?.classList.contains('feed-nav-tip-visible');
    if (!tipOpen && !hasFeedSwipeTeaseShownOnce()) offerFeedSwipeTeaseIfDue();
    scheduleFeedSwipeTeaseBoredom();
  });
}

function maybeFeedSwipeTeaseAfterOverlayClosed() {
  setTimeout(() => {
    if (!canRunFeedSwipeTeaseBurst()) return;
    if (document.getElementById('feed-nav-tip-overlay')?.classList.contains('feed-nav-tip-visible')) return;
    if (!hasFeedSwipeTeaseShownOnce()) offerFeedSwipeTeaseIfDue();
    scheduleFeedSwipeTeaseBoredom();
  }, 160);
}

window.clearFeedSwipeTeaseCoaching = clearFeedSwipeTeaseCoaching;
window.stopFeedSwipeTeaseForLeavingFeed = stopFeedSwipeTeaseForLeavingFeed;
window.clearFeedSwipeTeaseTimers = clearFeedSwipeTeaseTimers;
window.scheduleFeedSwipeTeaseBoredom = scheduleFeedSwipeTeaseBoredom;
window.queueMaybeOfferFeedSwipeTease = queueMaybeOfferFeedSwipeTease;
window.maybeFeedSwipeTeaseAfterOverlayClosed = maybeFeedSwipeTeaseAfterOverlayClosed;

window.loadGames = loadGames;
window.loadMoreFeed = loadMoreFeed;
window.renderFeed = renderFeed;
window.goTo = goTo;
window.updateOverlay = updateOverlay;
window.hideHint = hideSwipeHint;
window.injectGameIntoFeed = injectGameIntoFeed;
