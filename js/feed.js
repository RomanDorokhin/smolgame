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
    document.getElementById('swipe-hint').style.display = 'none';
    document.getElementById('touch-layer').style.display = 'none';
    return;
  }

  document.getElementById('empty-state').classList.remove('show');
  document.getElementById('side-actions').style.display = '';
  document.getElementById('game-info').style.display = '';
  document.getElementById('touch-layer').style.display = '';

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
  window.currentIdx = Math.max(0, Math.min(GAMES.length - 1, idx));

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
  const avatarUrl = g.authorAvatar && g.authorAvatar.startsWith('http')
    ? safeHttpUrl(g.authorAvatar)
    : null;
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

let touchStartY = 0, touchStartTime = 0, touchMoved = false, touching = false;

function setIframePointerEvents(value) {
  document.querySelectorAll('.slide-game').forEach(f => f.style.pointerEvents = value);
}

function isOverlayOpen() {
  return Boolean(document.querySelector('#upload-screen.open, #profile-screen.open, #search-screen.open, #author-screen.open, #onboarding-screen.open'));
}

function beginSwipe(y) {
  if (isOverlayOpen() || GAMES.length < 2) return false;
  window.scrollTo?.(0, 0);
  touchStartY = y;
  touchStartTime = Date.now();
  touchMoved = false;
  touching = true;
  document.getElementById('touch-layer')?.classList.add('dragging');
  // moved to moveSwipe
  return true;
}

function moveSwipe(y) {
  if (!touching) return;
  if (Math.abs(y - touchStartY) > 10) { touchMoved = true; setIframePointerEvents('none'); }
}

function endSwipe(y) {
  if (!touching) return;
  touching = false;
  document.getElementById('touch-layer')?.classList.remove('dragging');
  setIframePointerEvents('auto');
  if (!touchMoved) return;
  const dy = touchStartY - y;
  const duration = Math.max(1, Date.now() - touchStartTime);
  const velocity = Math.abs(dy) / duration;
  if (Math.abs(dy) > 55 || velocity > 0.3) {
    goTo(dy > 0 ? window.currentIdx + 1 : window.currentIdx - 1);
    hideHint();
  }
}

function cancelSwipe() {
  touching = false;
  document.getElementById('touch-layer')?.classList.remove('dragging');
  setIframePointerEvents('auto');
}

document.addEventListener('DOMContentLoaded', () => {
  const touchLayer = document.getElementById('touch-layer');
  if (touchLayer) {
    touchLayer.addEventListener('pointerdown', e => {
      touchStartY = e.clientY;
      touchStartTime = Date.now();
      touchMoved = false;
      touching = true;
    });
    touchLayer.addEventListener('pointermove', e => {
      if (!touching) return;
      const dy = Math.abs(e.clientY - touchStartY);
      if (dy > 10) {
        touchMoved = true;
        setIframePointerEvents('none');
        touchLayer.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      }
      moveSwipe(e.clientY);
    });
    touchLayer.addEventListener('pointerup', e => {
      if (!touching) return;
      if (!touchMoved) {
        // это тап — пропускаем в iframe
        touching = false;
        setIframePointerEvents('auto');
        touchLayer.style.pointerEvents = 'none';
        setTimeout(() => { touchLayer.style.pointerEvents = 'auto'; }, 100);
        return;
      }
      e.preventDefault();
      endSwipe(e.clientY);
    });
    touchLayer.addEventListener('pointercancel', cancelSwipe);
    touchLayer.addEventListener('wheel', e => {
      if (isOverlayOpen() || GAMES.length < 2) return;
      e.preventDefault();
      if (Math.abs(e.deltaY) < 24) return;
      goTo(e.deltaY > 0 ? window.currentIdx + 1 : window.currentIdx - 1);
      hideHint();
    }, { passive: false });
  }

  document.addEventListener('touchstart', e => {
    if (e.target.closest('#touch-layer')) return;
    beginSwipe(e.touches[0].clientY);
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (e.target.closest('#touch-layer')) return;
    if (touching) e.preventDefault();
    moveSwipe(e.touches[0].clientY);
  }, { passive: false });

  document.addEventListener('touchend', e => {
    if (e.target.closest('#touch-layer')) return;
    endSwipe(e.changedTouches[0].clientY);
  }, { passive: true });

  document.addEventListener('touchcancel', cancelSwipe, { passive: true });
});

document.addEventListener('keydown', e => {
  if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
    e.preventDefault();
    goTo(e.key === 'ArrowDown' ? window.currentIdx + 1 : window.currentIdx - 1);
  }
});

let hintHidden = false;
function hideHint() {
  if (hintHidden) return;
  hintHidden = true;
  const h = document.getElementById('swipe-hint');
  h.style.opacity = '0';
  setTimeout(() => h.style.display = 'none', 500);
}

window.loadGames = loadGames;
window.renderFeed = renderFeed;
window.goTo = goTo;
window.updateOverlay = updateOverlay;
window.hideHint = hideHint;
