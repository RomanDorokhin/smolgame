const FEED_PAGE_SIZE = 15;

window.feedHasMore = true;
window.feedLoadingMore = false;

function feedEl() {
  return document.getElementById('feed');
}

async function loadGames() {
  window.feedHasMore = true;
  window.feedLoadingMore = false;
  try {
    const data = await API.feed({ offset: 0, limit: FEED_PAGE_SIZE });
    window.GAMES = Array.isArray(data?.games) ? data.games : [];
    window.feedHasMore = data?.hasMore !== false;

    window.likedSet = new Set(GAMES.filter(g => g.isLiked).map(g => g.id));
    window.followedSet = new Set(GAMES.filter(g => g.isFollowing).map(g => g.authorId));
    window.bookmarkedSet = new Set(GAMES.filter(g => g.isBookmarked).map(g => g.id));
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
    if (g.isLiked) likedSet.add(g.id);
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
    const data = await API.feed({ offset: GAMES.length, limit: FEED_PAGE_SIZE });
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
    if (game.isLiked) likedSet.add(game.id);
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
    slide.style.top = `${(i - window.currentIdx) * 100}%`;

    const placeholder = document.createElement('div');
    placeholder.className = 'slide-placeholder';
    const thumbHtml = g.imageUrl
      ? `<img src="${esc(g.imageUrl)}" class="slide-cover" alt="">`
      : `<div class="placeholder-icon">${esc(g.genreEmoji || '🎮')}</div>`;
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
      <div class="loader-ring"></div>
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
    return;
  }

  document.getElementById('empty-state').classList.remove('show');
  document.getElementById('side-actions').style.display = '';
  document.getElementById('game-info').style.display = '';
  document.getElementById('swipe-strip').style.display = '';

  appendSlides(0, GAMES);
  goTo(0, true);
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

function goTo(idx, instant = false) {
  if (GAMES.length === 0) return;

  const prevIdx = window.currentIdx;
  window.currentIdx = Math.max(0, Math.min(GAMES.length - 1, idx));
  if (prevIdx !== window.currentIdx) resetSwipeHint();

  window.slides.forEach((s, i) => {
    s.style.transition = instant ? 'none' : 'top 0.4s cubic-bezier(0.4,0,0.2,1)';
    s.style.top = `${(i - window.currentIdx) * 100}%`;
  });

  document.querySelectorAll('.dot').forEach((d, i) =>
    d.classList.toggle('active', i === window.currentIdx)
  );

  updateOverlay();
  lazyLoadAround(window.currentIdx);
  maybeLoadMoreFeed();
}

function updateOverlay() {
  if (GAMES.length === 0) return;
  const g = GAMES[window.currentIdx];
  if (!g) return;

  const titleEl = document.getElementById('gameTitle');
  const sepEl = document.getElementById('gameMetaSep');
  const genreEl = document.getElementById('gameGenreInline');

  titleEl.textContent = g.title || '—';

  const genreText = [g.genreEmoji, g.genre].filter(Boolean).join(' ').trim();
  if (genreText) {
    genreEl.textContent = genreText;
    genreEl.hidden = false;
    sepEl.hidden = false;
  } else {
    genreEl.textContent = '';
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
  document.getElementById('likeIcon').textContent = liked ? '❤️' : '🤍';
  document.getElementById('likeCount').textContent = fmtNum(g.likes + (liked ? 1 : 0));
  const bookmarked = bookmarkedSet.has(g.id);
  const bookmarkIcon = document.getElementById('bookmarkIcon');
  bookmarkIcon.textContent = bookmarked ? '🔖' : '📑';
  bookmarkIcon.classList.toggle('active-bookmark', bookmarked);
  document.getElementById('playsCount').textContent = fmtNum(g.plays);

  const following = followedSet.has(g.authorId);
  const followBtn = document.getElementById('followBtn');
  followBtn.textContent = following ? '✓ Following' : '+ Follow';
  followBtn.classList.toggle('following', following);
}

const SWIPE_NEXT_PX = 55;
const SWIPE_PREV_PX = 25;
const MOVE_THRESHOLD_PX = 10;

let touchStartY = 0;
let touchStartTime = 0;
let touchMoved = false;
let touching = false;
let activePointerId = null;

function isOverlayOpen() {
  return Boolean(document.querySelector('#upload-screen.open, #report-screen.open, #profile-screen.open, #search-screen.open, #author-screen.open, #onboarding-screen.open'));
}

function clearTelegramSwipePass(el) {
  el?.classList.remove('telegram-swipe-pass');
}

function feedPointerDown(e, strip) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (isOverlayOpen() || GAMES.length === 0) return;
  if (strip.style.display === 'none') return;

  touching = true;
  activePointerId = e.pointerId;
  touchStartY = e.clientY;
  touchStartTime = Date.now();
  touchMoved = false;
  clearTelegramSwipePass(strip);
  strip.classList.add('dragging');
  try {
    strip.setPointerCapture(e.pointerId);
  } catch (err) {
    /* setPointerCapture может бросить на старых WebView */
  }
}

function feedPointerMove(e, strip) {
  if (!touching || e.pointerId !== activePointerId) return;
  const y = e.clientY;
  const deltaFromStart = y - touchStartY;

  if (window.currentIdx === 0 && deltaFromStart > MOVE_THRESHOLD_PX) {
    const passPid = e.pointerId;
    try { strip.releasePointerCapture(e.pointerId); } catch (err) {}
    touching = false;
    activePointerId = null;
    strip.classList.remove('dragging');
    strip.classList.add('telegram-swipe-pass');
    const onLift = ev => {
      if (ev.pointerId !== passPid) return;
      clearTelegramSwipePass(strip);
      window.removeEventListener('pointerup', onLift, true);
      window.removeEventListener('pointercancel', onLift, true);
    };
    window.addEventListener('pointerup', onLift, true);
    window.addEventListener('pointercancel', onLift, true);
    return;
  }

  if (Math.abs(deltaFromStart) > MOVE_THRESHOLD_PX) {
    touchMoved = true;
    e.preventDefault();
  }
}

function feedPointerUp(e, strip) {
  if (!touching || e.pointerId !== activePointerId) return;
  touching = false;
  activePointerId = null;
  strip.classList.remove('dragging');

  if (strip.classList.contains('telegram-swipe-pass')) {
    clearTelegramSwipePass(strip);
    return;
  }

  if (!touchMoved) return;

  const now = Date.now();
  const y = e.clientY;
  const dy = touchStartY - y;
  const duration = Math.max(1, now - touchStartTime);
  const velocity = Math.abs(dy) / duration;

  if (dy > 0) {
    if (dy > SWIPE_NEXT_PX || velocity > 0.35) {
      goTo(window.currentIdx + 1);
      hideSwipeHint();
    }
  } else if (dy < 0 && window.currentIdx > 0) {
    if (-dy > SWIPE_PREV_PX || velocity > 0.35) {
      goTo(window.currentIdx - 1);
      hideSwipeHint();
    }
  }
  e.preventDefault();
}

function feedPointerCancel(e, strip) {
  if (!touching || e.pointerId !== activePointerId) return;
  touching = false;
  activePointerId = null;
  strip.classList.remove('dragging');
  clearTelegramSwipePass(strip);
}

document.addEventListener('DOMContentLoaded', () => {
  const strip = document.getElementById('swipe-strip');
  if (!strip) return;

  strip.addEventListener('pointerdown', e => feedPointerDown(e, strip));
  strip.addEventListener('pointermove', e => feedPointerMove(e, strip));
  strip.addEventListener('pointerup', e => feedPointerUp(e, strip));
  strip.addEventListener('pointercancel', e => feedPointerCancel(e, strip));

  strip.addEventListener('wheel', e => {
    if (isOverlayOpen() || GAMES.length < 2) return;
    e.preventDefault();
    if (Math.abs(e.deltaY) < 24) return;
    goTo(e.deltaY > 0 ? window.currentIdx + 1 : window.currentIdx - 1);
    hideSwipeHint();
  }, { passive: false });
});

document.addEventListener('keydown', e => {
  if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
  if (isOverlayOpen() || GAMES.length === 0) return;
  e.preventDefault();
  if (e.key === 'ArrowDown') goTo(window.currentIdx + 1);
  else if (window.currentIdx > 0) goTo(window.currentIdx - 1);
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

window.loadGames = loadGames;
window.loadMoreFeed = loadMoreFeed;
window.renderFeed = renderFeed;
window.goTo = goTo;
window.updateOverlay = updateOverlay;
window.hideHint = hideSwipeHint;
window.injectGameIntoFeed = injectGameIntoFeed;
