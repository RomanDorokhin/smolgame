async function loadGames() {
  try {
    const data = await API.feed();
    window.GAMES = Array.isArray(data?.games) ? data.games : [];

    // Синхронизируем локальные Set-ы с ответом сервера (он знает истину).
    window.likedSet = new Set(GAMES.filter(g => g.isLiked).map(g => g.id));
    window.followedSet = new Set(GAMES.filter(g => g.isFollowing).map(g => g.authorId));
    window.bookmarkedSet = new Set(GAMES.filter(g => g.isBookmarked).map(g => g.id));
    saveSet(STORAGE_KEYS.liked, likedSet);
    saveSet(STORAGE_KEYS.followed, followedSet);
    saveSet(STORAGE_KEYS.bookmarked, bookmarkedSet);
  } catch (e) {
    console.error('feed load failed', e);
    window.GAMES = [];
  }
  renderFeed();
}

function renderFeed() {
  const feed = document.getElementById('feed');
  const dots = document.getElementById('dots');
  feed.innerHTML = '';
  dots.innerHTML = '';
  window.slides = [];

  if (GAMES.length === 0) {
    document.getElementById('empty-state').classList.add('show');
    document.getElementById('side-actions').style.display = 'none';
    document.getElementById('game-info').style.display = 'none';
    document.getElementById('play-cta').style.display = 'none';
    document.getElementById('touch-layer').style.display = 'none';
    return;
  }

  document.getElementById('empty-state').classList.remove('show');
  document.getElementById('side-actions').style.display = '';
  document.getElementById('game-info').style.display = '';
  document.getElementById('touch-layer').style.display = '';
  document.getElementById('play-cta').style.display = '';

  GAMES.forEach((g, i) => {
    const slide = document.createElement('div');
    slide.className = 'slide';
    slide.id = 'slide-' + i;
    slide.style.transform = `translateY(${i * 100}%)`;

    const placeholder = document.createElement('div');
    placeholder.className = 'slide-placeholder';
    const thumbHtml = g.imageUrl
      ? `<img src="${esc(g.imageUrl)}" class="slide-cover" alt="">`
      : `<div class="placeholder-icon">${esc(g.genreEmoji || '🎮')}</div>`;
    placeholder.innerHTML = `
      ${thumbHtml}
      <div class="placeholder-title">${esc(g.title)}</div>
      <div class="placeholder-sub">Загружаем игру...</div>
      <div class="loader-ring"></div>
    `;

    const iframe = document.createElement('iframe');
    iframe.className = 'slide-game';
    iframe.id = 'iframe-' + i;
    // Игры размещаются на чужом origin (GitHub Pages / Vercel / и т.п.),
    // поэтому НЕ даём allow-same-origin — иначе песочница теряет смысл.
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

    // Защита на клиенте: в iframe пускаем только http(s) URL.
    // Сервер всё равно должен проверять при сабмите, но пусть будет второй барьер.
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
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.id = 'dot-' + i;
      dots.appendChild(dot);
      return;
    }

    // Ленивая загрузка: только текущий ±1.
    if (Math.abs(i - window.currentIdx) <= 1) {
      iframe.src = safeUrl;
    }
    iframe.dataset.src = safeUrl;

    slide.appendChild(placeholder);
    slide.appendChild(iframe);
    feed.appendChild(slide);
    window.slides.push(slide);

    const dot = document.createElement('div');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.id = 'dot-' + i;
    dots.appendChild(dot);
  });

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
  if (prevIdx !== window.currentIdx) resetPlayCtaSub();

  window.slides.forEach((s, i) => {
    s.style.transition = instant ? 'none' : 'transform 0.4s cubic-bezier(0.4,0,0.2,1)';
    s.style.transform = `translateY(${(i - window.currentIdx) * 100}%)`;
  });

  document.querySelectorAll('.dot').forEach((d, i) =>
    d.classList.toggle('active', i === window.currentIdx)
  );

  updateOverlay();
  lazyLoadAround(window.currentIdx);
}

function updateOverlay() {
  if (GAMES.length === 0) return;
  const g = GAMES[window.currentIdx];
  if (!g) return;

  document.getElementById('gameBadge').textContent =
    (g.genreEmoji || '🕹️') + ' ' + (g.genre || 'Игра');
  document.getElementById('gameTitle').textContent = g.title;
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

function isPlayMode() {
  return document.body.classList.contains('playing');
}

function isOverlayOpen() {
  return Boolean(document.querySelector('#upload-screen.open, #profile-screen.open, #search-screen.open, #author-screen.open, #onboarding-screen.open'));
}

function clearTelegramSwipePass(touchLayer) {
  touchLayer?.classList.remove('telegram-swipe-pass');
}

function feedPointerDown(e, touchLayer) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (isPlayMode() || isOverlayOpen() || GAMES.length === 0) return;
  if (touchLayer.style.display === 'none') return;

  window.scrollTo?.(0, 0);
  touching = true;
  activePointerId = e.pointerId;
  touchStartY = e.clientY;
  touchStartTime = Date.now();
  touchMoved = false;
  clearTelegramSwipePass(touchLayer);
  touchLayer.classList.add('dragging');
  try {
    touchLayer.setPointerCapture(e.pointerId);
  } catch (err) {
    /* setPointerCapture может бросить на старых WebView */
  }
}

function feedPointerMove(e, touchLayer) {
  if (!touching || e.pointerId !== activePointerId) return;
  const y = e.clientY;
  const deltaFromStart = y - touchStartY;

  if (window.currentIdx === 0 && deltaFromStart > MOVE_THRESHOLD_PX) {
    const passPid = e.pointerId;
    try { touchLayer.releasePointerCapture(e.pointerId); } catch (err) {}
    touching = false;
    activePointerId = null;
    touchLayer.classList.remove('dragging');
    touchLayer.classList.add('telegram-swipe-pass');
    const onLift = ev => {
      if (ev.pointerId !== passPid) return;
      clearTelegramSwipePass(touchLayer);
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

function feedPointerUp(e, touchLayer) {
  if (!touching || e.pointerId !== activePointerId) return;
  touching = false;
  activePointerId = null;
  touchLayer.classList.remove('dragging');

  if (touchLayer.classList.contains('telegram-swipe-pass')) {
    clearTelegramSwipePass(touchLayer);
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
      hideHint();
    }
  } else if (dy < 0 && window.currentIdx > 0) {
    if (-dy > SWIPE_PREV_PX || velocity > 0.35) {
      goTo(window.currentIdx - 1);
      hideHint();
    }
  }
  e.preventDefault();
}

function feedPointerCancel(e, touchLayer) {
  if (!touching || e.pointerId !== activePointerId) return;
  touching = false;
  activePointerId = null;
  touchLayer.classList.remove('dragging');
  clearTelegramSwipePass(touchLayer);
}

document.addEventListener('DOMContentLoaded', () => {
  const touchLayer = document.getElementById('touch-layer');
  if (!touchLayer) return;

  touchLayer.addEventListener('pointerdown', e => feedPointerDown(e, touchLayer));
  touchLayer.addEventListener('pointermove', e => feedPointerMove(e, touchLayer));
  touchLayer.addEventListener('pointerup', e => feedPointerUp(e, touchLayer));
  touchLayer.addEventListener('pointercancel', e => feedPointerCancel(e, touchLayer));

  touchLayer.addEventListener('wheel', e => {
    if (isPlayMode() || isOverlayOpen() || GAMES.length < 2) return;
    e.preventDefault();
    if (Math.abs(e.deltaY) < 24) return;
    goTo(e.deltaY > 0 ? window.currentIdx + 1 : window.currentIdx - 1);
    hideHint();
  }, { passive: false });
});

document.addEventListener('keydown', e => {
  if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
  if (isPlayMode() || isOverlayOpen() || GAMES.length === 0) return;
  e.preventDefault();
  if (e.key === 'ArrowDown') goTo(window.currentIdx + 1);
  else if (window.currentIdx > 0) goTo(window.currentIdx - 1);
});

let hintHidden = false;

function resetPlayCtaSub() {
  hintHidden = false;
  const sub = document.getElementById('play-cta-sub');
  if (sub) {
    sub.style.display = '';
    sub.style.opacity = '';
  }
}

function hideHint() {
  if (hintHidden) return;
  hintHidden = true;
  const sub = document.getElementById('play-cta-sub');
  if (sub) {
    sub.style.opacity = '0';
    setTimeout(() => { sub.style.display = 'none'; }, 400);
  }
}

window.loadGames = loadGames;
window.renderFeed = renderFeed;
window.goTo = goTo;
window.updateOverlay = updateOverlay;
window.hideHint = hideHint;

// ══ PLAY MODE ══
let playMode = false;

function enterPlayMode() {
  if (playMode || GAMES.length === 0 || isOverlayOpen()) return;
  playMode = true;
  document.body.classList.add('playing');
  document.getElementById('close-play-btn')?.classList.add('visible');
}

function exitPlayMode() {
  if (!playMode) return;
  playMode = false;
  document.body.classList.remove('playing');
  document.getElementById('close-play-btn')?.classList.remove('visible');
  resetPlayCtaSub();
}

window.enterPlayMode = enterPlayMode;
window.exitPlayMode = exitPlayMode;
