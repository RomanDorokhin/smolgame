function toggleLike() {
  if (GAMES.length === 0) return;
  const g = GAMES[window.currentIdx];
  const icon = document.getElementById('likeIcon');

  const wasLiked = likedSet.has(g.id);
  // Лайк = и избранное: оба набора и оба API держим вместе.
  if (wasLiked) {
    likedSet.delete(g.id);
    bookmarkedSet.delete(g.id);
    icon.innerHTML = likeIconMarkup(false);
    icon.classList.remove('active-like');
  } else {
    likedSet.add(g.id);
    bookmarkedSet.add(g.id);
    icon.innerHTML = likeIconMarkup(true);
    icon.classList.add('active-like', 'pop');
    setTimeout(() => icon.classList.remove('pop'), 400);
  }
  saveSet(STORAGE_KEYS.liked, likedSet);
  saveSet(STORAGE_KEYS.bookmarked, bookmarkedSet);
  document.getElementById('likeCount').textContent =
    fmtNum(g.likes + (likedSet.has(g.id) ? 1 : 0));

  const req = wasLiked
    ? Promise.all([API.unlike(g.id), API.unbookmark(g.id)])
    : Promise.all([API.like(g.id), API.bookmark(g.id)]);
  req.catch(err => {
    if (wasLiked) {
      likedSet.add(g.id);
      bookmarkedSet.add(g.id);
    } else {
      likedSet.delete(g.id);
      bookmarkedSet.delete(g.id);
    }
    saveSet(STORAGE_KEYS.liked, likedSet);
    saveSet(STORAGE_KEYS.bookmarked, bookmarkedSet);
    updateOverlay();
    showToast('⚠️ Не удалось, попробуй ещё раз');
    console.warn('like/bookmark failed', err);
  });
}

function toggleFollow() {
  if (GAMES.length === 0) return;
  const g = GAMES[window.currentIdx];
  const btn = document.getElementById('followBtn');

  const wasFollowing = followedSet.has(g.authorId);
  if (wasFollowing) {
    followedSet.delete(g.authorId);
    btn.textContent = '+ Follow';
    btn.classList.remove('following');
    showToast('Отписался');
  } else {
    followedSet.add(g.authorId);
    btn.textContent = '✓ Following';
    btn.classList.add('following');
    showToast('✅ Подписался на ' + g.authorName);
  }
  saveSet(STORAGE_KEYS.followed, followedSet);

  (wasFollowing ? API.unfollow(g.authorId) : API.follow(g.authorId)).catch(err => {
    if (wasFollowing) followedSet.add(g.authorId); else followedSet.delete(g.authorId);
    saveSet(STORAGE_KEYS.followed, followedSet);
    updateOverlay();
    showToast('⚠️ Не удалось');
    console.warn('follow failed', err);
  });
}

function buildGameShareUrl(gameId) {
  // Формат Telegram deep-link для mini-app: https://t.me/<bot>?startapp=<param>
  // Параметр не может содержать / или : — используем префикс g_ + id игры.
  const param = 'g_' + encodeURIComponent(gameId);
  const bot = window.BOT_USERNAME || '';
  const app = window.BOT_APP_NAME || '';
  if (app) return `https://t.me/${bot}/${app}?startapp=${param}`;
  return `https://t.me/${bot}?startapp=${param}`;
}

async function shareGame() {
  if (GAMES.length === 0) return;
  const g = GAMES[window.currentIdx];
  const url = buildGameShareUrl(g.id);
  const text = `🎮 ${g.title} — играй в SmolGame`;

  // 1) Лучший путь в Telegram: нативный share-sheet в чат.
  try {
    const shareUrl = 'https://t.me/share/url?url=' + encodeURIComponent(url) +
                     '&text=' + encodeURIComponent(text);
    if (window.Telegram?.WebApp?.openTelegramLink) {
      Telegram.WebApp.openTelegramLink(shareUrl);
      return;
    }
  } catch (e) {}

  // 2) Fallback: Web Share API (вне Telegram, в обычном браузере).
  try {
    if (navigator.share) {
      await navigator.share({ title: g.title, text, url });
      return;
    }
  } catch (e) { /* юзер отменил — не критично */ }

  // 3) Последний fallback — копирование в буфер.
  try {
    await navigator.clipboard.writeText(url);
    showToast('🔗 Ссылка скопирована');
  } catch (e) {
    showToast('🔗 ' + url);
  }
}

window.buildGameShareUrl = buildGameShareUrl;

function reportGame() {
  showToast('⚑ Жалоба: напиши админу бота');
}

function trackPlay(gameId) {
  if (!API.play) return;
  API.play(gameId).catch(e => console.warn('play track failed', e));
}

function openAuthorProfile() {
  if (GAMES.length === 0) return;
  const g = GAMES[window.currentIdx];
  if (!g?.authorId) return;
  openAuthorScreen(g.authorId);
}

window.toggleLike = toggleLike;
window.toggleFollow = toggleFollow;
window.shareGame = shareGame;
window.reportGame = reportGame;
window.trackPlay = trackPlay;
window.openAuthorProfile = openAuthorProfile;
