function gameThumbHtml(g) {
  return g.imageUrl
    ? `<img src="${esc(g.imageUrl)}" class="game-card-cover" alt="">`
    : `<span class="game-card-thumb-placeholder">${typeof genreIconForGame === 'function' ? genreIconForGame(g) : ''}</span>`;
}

/** Нормализация ответа GET /api/me (статы могут прийти строками из D1). */
function parseProfileStats(me) {
  const raw = me?.stats;
  if (!raw || typeof raw !== 'object') {
    return { games: null, likes: null, followers: null };
  }
  const games = Number(raw.games ?? raw.gamesCount);
  const likes = Number(raw.likes ?? raw.likesTotal);
  const followers = Number(raw.followers ?? raw.followersCount);
  return {
    games: Number.isFinite(games) ? games : null,
    likes: Number.isFinite(likes) ? likes : null,
    followers: Number.isFinite(followers) ? followers : null,
  };
}

function gameStatusBadgeHtml(status) {
  if (status === 'pending') {
    return '<span class="game-card-status-badge pending">Модерация</span>';
  }
  if (status === 'rejected') {
    return '<span class="game-card-status-badge rejected">Отклонено</span>';
  }
  return '';
}

async function renderProfile() {
  const bioRead = document.getElementById('profileBio');
  const handleRead = document.getElementById('profileSiteHandleRead');

  setProfileAvatar(USER.avatar);
  document.getElementById('profileName').textContent = USER.name || '—';
  document.getElementById('profileHandle').textContent = '@' + (USER.siteHandle || USER.id || '—');
  if (handleRead) handleRead.textContent = USER.siteHandle || USER.id || '—';
  bioRead.textContent = '';

  const setStatGames = v => { document.getElementById('statGames').textContent = v; };
  const setStatFollowers = v => { document.getElementById('statFollowers').textContent = v; };
  const setStatLikes = v => { document.getElementById('statLikes').textContent = v; };
  setStatGames('…');
  setStatFollowers('…');
  setStatLikes('…');

  document.getElementById('devBadge').style.display = USER.isGithubConnected ? '' : 'none';

  let myGames = [];

  try {
    const me = await API.me();
    const st = parseProfileStats(me);
    if (st.games != null) setStatGames(String(st.games));
    if (st.likes != null) setStatLikes(fmtNum(st.likes));
    if (st.followers != null) setStatFollowers(fmtNum(st.followers));
    if (me?.user?.isAdmin) {
      document.body.classList.add('is-admin');
    } else {
      document.body.classList.remove('is-admin');
    }
    if (me?.user) {
      USER.siteHandle = me.user.siteHandle || USER.siteHandle;
      USER.name = me.user.name || USER.name;
      USER.avatar = me.user.avatar || USER.avatar;
      USER.isGithubConnected = Boolean(me.user.isGithubConnected);
      USER.githubUsername = me.user.githubUsername || null;
      USER.hasGithubPublishToken = Boolean(me.user.hasGithubPublishToken);
      USER.displayName = me.user.displayName != null ? me.user.displayName : '';
      USER.bio = me.user.bio != null ? me.user.bio : '';
      document.getElementById('profileName').textContent = USER.name;
      document.getElementById('profileHandle').textContent = '@' + (USER.siteHandle || USER.id || '—');
      if (handleRead) handleRead.textContent = USER.siteHandle || USER.id || '—';
      bioRead.textContent = USER.bio || '';
      setProfileAvatar(USER.avatar);
      document.getElementById('profileDisplayName').value = USER.displayName || USER.name || '';
      document.getElementById('profileBioInput').value = USER.bio || '';
    }
  } catch (e) {
    console.warn('profile /me failed', e);
  }

  try {
    const { games } = await API.myGames();
    myGames = Array.isArray(games) ? games : [];
  } catch (e) {
    console.warn('profile my games failed', e);
    myGames = GAMES.filter(g => g.authorId === USER.id);
  }

  const publishedCount = myGames.filter(g => g && g.status === 'published').length;
  if (document.getElementById('statGames').textContent === '…') {
    setStatGames(String(publishedCount));
  }
  if (document.getElementById('statFollowers').textContent === '…') {
    setStatFollowers('0');
  }
  if (document.getElementById('statLikes').textContent === '…') {
    const sumLikes = myGames.reduce((acc, g) => acc + (Number(g?.likes) || 0), 0);
    setStatLikes(fmtNum(sumLikes));
  }

  const grid = document.getElementById('myGamesGrid');
  if (myGames.length === 0) {
    grid.innerHTML =
      typeof sgEmptyGridHtml === 'function'
        ? sgEmptyGridHtml('Пока без своих игр', 'Добавь через вкладку «Загрузить» (＋).')
        : `<div class="sg-empty-state sg-empty-state--grid"><div class="sg-empty-state-title">Пока без своих игр</div><div class="sg-empty-state-sub">Добавь через вкладку «Загрузить» (＋).</div></div>`;
  } else {
    grid.innerHTML = myGames.map(g => `
      <div class="game-card" data-action="open-game-profile" data-game-id="${esc(g.id)}">
        <div class="game-card-thumb">
          ${gameStatusBadgeHtml(g.status)}
          ${gameThumbHtml(g)}
          <button type="button" class="delete-game-btn" data-action="delete-game" data-game-id="${esc(g.id)}" aria-label="Удалить"><svg class="sg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 3h6M5 7h14M10 11v8M14 11v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8 7l1 14h6l1-14" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></button>
        </div>
        <div class="game-card-info">
          <div class="game-card-name">${esc(g.title)}</div>
          <div class="game-card-stats"><span class="sg-mini-stat">${sgStatHeartSvg()}${fmtNum(g.likes)}</span><span class="sg-mini-sep">·</span><span class="sg-mini-stat">${sgStatEyeSvg()}${fmtNum(g.plays)}</span></div>
        </div>
      </div>
    `).join('');
  }
}

function setProfileAvatar(avatar) {
  const el = document.getElementById('profileAvatar');
  const avatarUrl = avatarImgUrl(avatar);
  if (avatarUrl) el.innerHTML = `<img src="${esc(avatarUrl)}" alt="" referrerpolicy="no-referrer">`;
  else el.textContent = avatar || '?';
}

async function saveProfile() {
  const displayName = document.getElementById('profileDisplayName').value.trim();
  const bio = document.getElementById('profileBioInput').value.trim();

  if (!displayName) {
    showToast('⚠️ Укажи имя');
    return;
  }

  try {
    const me = await API.updateMe({ displayName, bio });
    if (me?.user) {
      USER.name = me.user.name || USER.name;
      USER.siteHandle = me.user.siteHandle || USER.siteHandle;
      USER.avatar = me.user.avatar || USER.avatar;
      USER.displayName = me.user.displayName != null ? me.user.displayName : '';
      USER.bio = me.user.bio != null ? me.user.bio : '';
      document.getElementById('profileName').textContent = USER.name;
      document.getElementById('profileHandle').textContent = '@' + (USER.siteHandle || USER.id || '—');
      const handleRead = document.getElementById('profileSiteHandleRead');
      if (handleRead) handleRead.textContent = USER.siteHandle || USER.id || '—';
      document.getElementById('profileBio').textContent = USER.bio || '';
      setProfileAvatar(USER.avatar);
      document.getElementById('profileDisplayName').value = USER.displayName || USER.name || '';
      document.getElementById('profileBioInput').value = USER.bio || '';
    }
    showToast('Сохранено');
    if (typeof hapticSuccess === 'function') hapticSuccess();
    if (typeof updateOverlay === 'function') updateOverlay();
    cancelProfileEdit();
  } catch (e) {
    showToast(typeof userFacingError === 'function' ? userFacingError(e) : 'Не сохранилось');
    if (typeof hapticWarning === 'function') hapticWarning();
  }
}

function startProfileEdit() {
  document.getElementById('profile-screen')?.classList.add('profile-edit-active');
}

function cancelProfileEdit() {
  document.getElementById('profile-screen')?.classList.remove('profile-edit-active');
  const dn = document.getElementById('profileDisplayName');
  const bio = document.getElementById('profileBioInput');
  if (dn) dn.value = USER.displayName || USER.name || '';
  if (bio) bio.value = USER.bio || '';
}

async function resetProfilePhoto() {
  try {
    const me = await API.updateMe({ photoUrl: null });
    if (me?.user) {
      USER.avatar = me.user.avatar || USER.avatar;
      setProfileAvatar(USER.avatar);
    }
    showToast('✅ Фото из Telegram');
    if (typeof updateOverlay === 'function') updateOverlay();
  } catch (e) {
    showToast('⚠️ ' + (e.message || 'ошибка'));
  }
}

async function onProfileAvatarFileChange(ev) {
  const input = ev.target;
  const file = input?.files?.[0];
  if (!file) return;
  try {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('kind', 'avatar');
    const uploaded = await API.uploadImage(formData);
    const imageUrl = uploaded?.imageUrl;
    if (!imageUrl) throw new Error('нет URL');
    const me = await API.updateMe({ photoUrl: imageUrl });
    if (me?.user) {
      USER.avatar = me.user.avatar || imageUrl;
      setProfileAvatar(USER.avatar);
    }
    showToast('✅ Фото обновлено');
    if (typeof updateOverlay === 'function') updateOverlay();
  } catch (e) {
    showToast('⚠️ ' + (e.message || 'не загрузилось'));
  } finally {
    input.value = '';
  }
}

async function openGameFromProfile(gameId) {
  if (!gameId) return;
  if (typeof closeProfile === 'function') closeProfile();
  if (typeof switchTab === 'function') switchTab('feed');
  const idx = await injectGameIntoFeed(gameId);
  if (typeof goTo === 'function') goTo(idx, false);
}

async function deleteGame(gameId) {
  if (!gameId) return;
  if (!confirm('Удалить игру? Это действие нельзя отменить.')) return;
  try {
    await API.delete(gameId);
    showToast('🗑 Игра удалена');
    await loadGames();
    renderProfile();
  } catch (e) {
    showToast('⚠️ ' + (e.message || 'не удалось удалить'));
  }
}

window.renderProfile = renderProfile;
window.deleteGame = deleteGame;
window.saveProfile = saveProfile;
window.resetProfilePhoto = resetProfilePhoto;
window.openGameFromProfile = openGameFromProfile;
window.startProfileEdit = startProfileEdit;
window.cancelProfileEdit = cancelProfileEdit;

document.addEventListener('change', ev => {
  if (ev.target?.id === 'profileAvatarInput') onProfileAvatarFileChange(ev);
});
