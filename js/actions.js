function toggleLike() {
  if (GAMES.length === 0) return;
  const g = GAMES[window.currentIdx];
  const icon = document.getElementById('likeIcon');

  const wasLiked = likedSet.has(g.id);
  // Оптимистичное обновление UI — откатим если API упадёт.
  if (wasLiked) {
    likedSet.delete(g.id);
    icon.textContent = '🤍';
    icon.classList.remove('active-like');
  } else {
    likedSet.add(g.id);
    icon.textContent = '❤️';
    icon.classList.add('active-like', 'pop');
    setTimeout(() => icon.classList.remove('pop'), 400);
  }
  saveSet(STORAGE_KEYS.liked, likedSet);
  document.getElementById('likeCount').textContent =
    fmtNum(g.likes + (likedSet.has(g.id) ? 1 : 0));

  (wasLiked ? API.unlike(g.id) : API.like(g.id)).catch(err => {
    // Откат.
    if (wasLiked) likedSet.add(g.id); else likedSet.delete(g.id);
    saveSet(STORAGE_KEYS.liked, likedSet);
    updateOverlay();
    showToast('⚠️ Не удалось, попробуй ещё раз');
    console.warn('like failed', err);
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

function shareGame() {
  if (GAMES.length === 0) return;
  const g = GAMES[window.currentIdx];
  const text = `🎮 ${g.title} на SmolGame`;
  try {
    Telegram.WebApp.switchInlineQuery(text);
  } catch (e) {
    showToast('🔗 Ссылка скопирована');
  }
}

function reportGame() {
  showToast('⚑ Жалоба отправлена');
  // TODO: POST /api/report { gameId: GAMES[currentIdx].id }
}

function trackPlay(gameId) {
  API.play(gameId).catch(e => console.warn('play track failed', e));
}

function openAuthorProfile() {
  showToast('Профиль автора — скоро');
}

window.toggleLike = toggleLike;
window.toggleFollow = toggleFollow;
window.shareGame = shareGame;
window.reportGame = reportGame;
window.trackPlay = trackPlay;
window.openAuthorProfile = openAuthorProfile;
