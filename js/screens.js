function openUpload() {
  document.getElementById('upload-screen').classList.add('open');
  renderGenrePills('genrePills', 'code');
  renderGenrePills('genrePills2', 'url');
}
function closeUpload() {
  document.getElementById('upload-screen').classList.remove('open');
}

function openProfile() {
  const screen = document.getElementById('profile-screen');
  screen?.classList.remove('profile-edit-active');
  renderProfile();
  loadAdminPending();
  screen?.classList.add('open');
}
function closeProfile() {
  const screen = document.getElementById('profile-screen');
  screen?.classList.remove('open', 'profile-edit-active');
}

function openSearch() {
  document.getElementById('search-screen').classList.add('open');
  renderGenreFilter();
  onSearch('');
}
function closeSearch() {
  document.getElementById('search-screen').classList.remove('open');
}

function openAuthorScreen(authorId) {
  if (!authorId) return;
  document.getElementById('author-screen').classList.add('open');
  loadAuthorProfile(authorId);
}
function closeAuthorScreen() {
  document.getElementById('author-screen').classList.remove('open');
}
function setAvatar(el, avatar) {
  const avatarUrl = avatarImgUrl(avatar);
  if (avatarUrl) {
    el.innerHTML = `<img src="${esc(avatarUrl)}" alt="" referrerpolicy="no-referrer">`;
  } else {
    el.textContent = avatar || '?';
  }
}

function renderSmallGameCard(g) {
  return `
    <div class="game-card" data-action="open-game" data-game-id="${esc(g.id)}">
      <div class="game-card-thumb">${gameThumbHtml(g)}</div>
      <div class="game-card-info">
        <div class="game-card-name">${esc(g.title)}</div>
        <div class="game-card-stats">❤️ ${fmtNum(g.likes)} · 👁 ${fmtNum(g.plays)}</div>
      </div>
    </div>
  `;
}

function toggleAuthorFollow(btn) {
  if (!btn?.dataset.authorId || btn.dataset.isSelf) return;
  const authorId = btn.dataset.authorId;
  const wasFollowing = followedSet.has(authorId);
  if (wasFollowing) {
    followedSet.delete(authorId);
    btn.textContent = '+ Подписаться';
    btn.classList.remove('following');
  } else {
    followedSet.add(authorId);
    btn.textContent = '✓ Подписка';
    btn.classList.add('following');
  }
  saveSet(STORAGE_KEYS.followed, followedSet);
  updateOverlay();
  (wasFollowing ? API.unfollow(authorId) : API.follow(authorId)).catch(err => {
    if (wasFollowing) followedSet.add(authorId); else followedSet.delete(authorId);
    saveSet(STORAGE_KEYS.followed, followedSet);
    updateOverlay();
    loadAuthorProfile(authorId);
    showToast('⚠️ Не удалось');
    console.warn('author follow failed', err);
  });
}

async function loadAuthorProfile(authorId) {
  document.getElementById('authorProfileName').textContent = 'Загрузка...';
  document.getElementById('authorProfileHandle').textContent = '@—';
  document.getElementById('authorGamesGrid').innerHTML =
    `<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:var(--muted);font-size:14px;">Загружаем игры</div>`;

  try {
    const [profile, gamesData] = await Promise.all([
      API.userProfile(authorId),
      API.userGames(authorId),
    ]);
    const user = profile.user || {};
    const stats = profile.stats || {};
    setAvatar(document.getElementById('authorProfileAvatar'), user.avatar || '?');
    document.getElementById('authorProfileName').textContent = user.name || 'Аноним';
    document.getElementById('authorProfileHandle').textContent = '@' + (user.siteHandle || user.id || '—');
    const authorBio = document.getElementById('authorProfileBio');
    const bioText = (user.bio && String(user.bio).trim()) || '';
    if (authorBio) {
      authorBio.textContent = bioText;
      authorBio.style.display = bioText ? '' : 'none';
    }
    document.getElementById('authorStatGames').textContent = fmtNum(stats.games);
    document.getElementById('authorStatFollowers').textContent = fmtNum(stats.followers);
    document.getElementById('authorStatLikes').textContent = fmtNum(stats.likes);

    const btn = document.getElementById('authorFollowBtn');
    btn.textContent = profile.isSelf ? 'Это вы' : (profile.isFollowing ? '✓ Подписка' : '+ Подписаться');
    btn.classList.toggle('following', Boolean(profile.isFollowing || profile.isSelf));
    btn.dataset.authorId = authorId;
    btn.dataset.isSelf = profile.isSelf ? '1' : '';

    const games = Array.isArray(gamesData.games) ? gamesData.games : [];
    const grid = document.getElementById('authorGamesGrid');
    if (games.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:var(--muted);font-size:14px;">Игр пока нет</div>`;
    } else {
      grid.innerHTML = games.map(g => `
        <div class="game-card" data-action="open-game" data-game-id="${esc(g.id)}">
          <div class="game-card-thumb">${gameThumbHtml(g)}</div>
          <div class="game-card-info">
            <div class="game-card-name">${esc(g.title)}</div>
            <div class="game-card-stats">❤️ ${fmtNum(g.likes)} · 👁 ${fmtNum(g.plays)}</div>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    document.getElementById('authorProfileName').textContent = 'Не удалось загрузить';
    showToast('⚠️ ' + (e.message || 'ошибка профиля'));
  }
}

function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('nav-' + tab)?.classList.add('active');
  if (tab === 'search') openSearch();
  else if (tab === 'profile') openProfile();
  else if (tab === 'feed') { closeSearch(); closeProfile(); }
}

window.openUpload = openUpload;
window.closeUpload = closeUpload;
window.openProfile = openProfile;
window.closeProfile = closeProfile;
window.openSearch = openSearch;
window.closeSearch = closeSearch;
window.openAuthorScreen = openAuthorScreen;
window.closeAuthorScreen = closeAuthorScreen;
window.loadAuthorProfile = loadAuthorProfile;
window.toggleAuthorFollow = toggleAuthorFollow;
window.switchTab = switchTab;
