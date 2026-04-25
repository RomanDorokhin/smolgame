function toggleLike() {
  if (GAMES.length === 0) return;
  const g = GAMES[window.currentIdx];
  const icon = document.getElementById('likeIcon');

  if (likedSet.has(g.id)) {
    likedSet.delete(g.id);
    icon.textContent = '🤍';
    icon.classList.remove('active-like');
  } else {
    likedSet.add(g.id);
    icon.textContent = '❤️';
    icon.classList.add('active-like', 'pop');
    setTimeout(() => icon.classList.remove('pop'), 400);
    // TODO: POST /api/like { gameId: g.id, userId: USER.id }
  }

  document.getElementById('likeCount').textContent =
    fmtNum(g.likes + (likedSet.has(g.id) ? 1 : 0));
}

function toggleFollow() {
  if (GAMES.length === 0) return;
  const g = GAMES[window.currentIdx];
  const btn = document.getElementById('followBtn');

  if (followedSet.has(g.authorId)) {
    followedSet.delete(g.authorId);
    btn.textContent = '+ Follow';
    btn.classList.remove('following');
    showToast('Отписался');
  } else {
    followedSet.add(g.authorId);
    btn.textContent = '✓ Following';
    btn.classList.add('following');
    showToast('✅ Подписался на ' + g.authorName);
    // TODO: POST /api/follow { authorId: g.authorId, userId: USER.id }
  }
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
  // TODO: POST /api/play { gameId, userId: USER.id }
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
