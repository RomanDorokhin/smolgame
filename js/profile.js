function gameThumbHtml(g) {
  return g.imageUrl
    ? `<img src="${esc(g.imageUrl)}" class="game-card-cover" alt="">`
    : `<span>${esc(g.genreEmoji || '🎮')}</span>`;
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

function isTelegramUser() {
  return Boolean(USER.tgId);
}

async function renderProfile() {
  const guestNote = document.getElementById('profile-guest-note');
  const editWrap = document.getElementById('profile-edit-wrap');
  const bioRead = document.getElementById('profileBio');

  setProfileAvatar(USER.avatar);
  document.getElementById('profileName').textContent = USER.name;
  document.getElementById('profileHandle').textContent = '@' + (USER.siteHandle || USER.name);
  bioRead.textContent = '';

  if (!isTelegramUser()) {
    guestNote.style.display = '';
    editWrap.style.display = 'none';
  } else {
    guestNote.style.display = 'none';
    editWrap.style.display = '';
  }

  document.getElementById('statGames').textContent = '—';
  document.getElementById('statFollowers').textContent = '—';
  document.getElementById('statLikes').textContent = '—';

  if (USER.isGithubConnected) document.getElementById('devBadge').style.display = '';

  let myGames = [];

  if (isTelegramUser()) {
    try {
      const me = await API.me();
      if (me?.stats) {
        document.getElementById('statGames').textContent = me.stats.games;
        document.getElementById('statLikes').textContent = fmtNum(me.stats.likes);
        document.getElementById('statFollowers').textContent = fmtNum(me.stats.followers);
      }
      if (me?.user?.isAdmin) {
        document.body.classList.add('is-admin');
      } else {
        document.body.classList.remove('is-admin');
      }
      if (me?.user) {
        USER.siteHandle = me.user.siteHandle || USER.siteHandle;
        USER.name = me.user.name || USER.name;
        USER.avatar = me.user.avatar || USER.avatar;
        USER.displayName = me.user.displayName != null ? me.user.displayName : '';
        USER.bio = me.user.bio != null ? me.user.bio : '';
        document.getElementById('profileName').textContent = USER.name;
        document.getElementById('profileHandle').textContent = '@' + (USER.siteHandle || USER.name);
        bioRead.textContent = USER.bio || '';
        setProfileAvatar(USER.avatar);
        document.getElementById('profileDisplayName').value = USER.displayName || USER.name || '';
        document.getElementById('profileSiteHandle').value = USER.siteHandle || '';
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
  } else {
    myGames = GAMES.filter(g => g.authorId === USER.id);
    document.getElementById('statGames').textContent = myGames.length;
    document.getElementById('statLikes').textContent =
      fmtNum(myGames.reduce((s, g) => s + (g.likes || 0), 0));
    document.getElementById('statFollowers').textContent = '—';
  }

  const grid = document.getElementById('myGamesGrid');
  if (myGames.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:var(--muted);font-size:14px;">Пока нет игр. Загрузи в разделе «Загрузить».</div>`;
  } else {
    grid.innerHTML = myGames.map(g => `
      <div class="game-card" data-action="open-game-profile" data-game-id="${esc(g.id)}">
        <div class="game-card-thumb">
          ${gameStatusBadgeHtml(g.status)}
          ${gameThumbHtml(g)}
          ${isTelegramUser() ? `<button type="button" class="delete-game-btn" data-action="delete-game" data-game-id="${esc(g.id)}">🗑</button>` : ''}
        </div>
        <div class="game-card-info">
          <div class="game-card-name">${esc(g.title)}</div>
          <div class="game-card-stats">❤️ ${fmtNum(g.likes)} · 👁 ${fmtNum(g.plays)}</div>
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
  if (!isTelegramUser()) {
    showToast('⚠️ Нужен Telegram');
    return;
  }
  const displayName = document.getElementById('profileDisplayName').value.trim();
  const siteHandle = document.getElementById('profileSiteHandle').value.trim().toLowerCase();
  const bio = document.getElementById('profileBioInput').value.trim();

  if (!displayName) {
    showToast('⚠️ Укажи имя');
    return;
  }
  if (!/^[a-z0-9_]{3,24}$/.test(siteHandle)) {
    showToast('⚠️ Публичный ID: 3–24 символа, a-z, 0-9, _');
    return;
  }

  try {
    const me = await API.updateMe({ displayName, siteHandle, bio });
    if (me?.user) {
      USER.name = me.user.name || USER.name;
      USER.siteHandle = me.user.siteHandle || USER.siteHandle;
      USER.avatar = me.user.avatar || USER.avatar;
      USER.displayName = me.user.displayName != null ? me.user.displayName : '';
      USER.bio = me.user.bio != null ? me.user.bio : '';
      document.getElementById('profileName').textContent = USER.name;
      document.getElementById('profileHandle').textContent = '@' + (USER.siteHandle || USER.name);
      document.getElementById('profileBio').textContent = USER.bio || '';
      setProfileAvatar(USER.avatar);
      document.getElementById('profileDisplayName').value = USER.displayName || USER.name || '';
      document.getElementById('profileSiteHandle').value = USER.siteHandle || '';
      document.getElementById('profileBioInput').value = USER.bio || '';
    }
    showToast('✅ Профиль сохранён');
    if (typeof updateOverlay === 'function') updateOverlay();
  } catch (e) {
    showToast('⚠️ ' + (e.message || 'не сохранилось'));
  }
}

async function resetProfilePhoto() {
  if (!isTelegramUser()) return;
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
  if (!file || !isTelegramUser()) return;
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

document.addEventListener('change', ev => {
  if (ev.target?.id === 'profileAvatarInput') onProfileAvatarFileChange(ev);
});
