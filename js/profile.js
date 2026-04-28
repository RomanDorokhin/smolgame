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
  const premBadge = document.getElementById('premiumBadge');
  if (premBadge) premBadge.style.display = USER.isPremium ? '' : 'none';

  let myGames = [];

  try {
    const [me, myGamesRes] = await Promise.all([API.me(), API.myGames()]);
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
      USER.isPremium = Boolean(me.user.isPremium);
      USER.displayName = me.user.displayName != null ? me.user.displayName : '';
      USER.bio = me.user.bio != null ? me.user.bio : '';
      document.getElementById('profileName').textContent = USER.name;
      document.getElementById('profileHandle').textContent = '@' + (USER.siteHandle || USER.id || '—');
      if (handleRead) handleRead.textContent = USER.siteHandle || USER.id || '—';
      bioRead.textContent = USER.bio || '';
      setProfileAvatar(USER.avatar);
      document.getElementById('profileDisplayName').value = USER.displayName || USER.name || '';
      document.getElementById('profileBioInput').value = USER.bio || '';
      if (premBadge) premBadge.style.display = USER.isPremium ? '' : 'none';
    }
    const games = myGamesRes?.games;
    myGames = Array.isArray(games) ? games : [];
  } catch (e) {
    console.warn('profile /me or myGames failed', e);
    try {
      const me = await API.me();
      const st = parseProfileStats(me);
      if (st.games != null) setStatGames(String(st.games));
      if (st.likes != null) setStatLikes(fmtNum(st.likes));
      if (st.followers != null) setStatFollowers(fmtNum(st.followers));
      if (me?.user?.isAdmin) document.body.classList.add('is-admin');
      else document.body.classList.remove('is-admin');
      if (me?.user) {
        USER.siteHandle = me.user.siteHandle || USER.siteHandle;
        USER.name = me.user.name || USER.name;
        USER.avatar = me.user.avatar || USER.avatar;
        USER.isGithubConnected = Boolean(me.user.isGithubConnected);
        USER.githubUsername = me.user.githubUsername || null;
        USER.hasGithubPublishToken = Boolean(me.user.hasGithubPublishToken);
        USER.isPremium = Boolean(me.user.isPremium);
        USER.displayName = me.user.displayName != null ? me.user.displayName : '';
        USER.bio = me.user.bio != null ? me.user.bio : '';
        document.getElementById('profileName').textContent = USER.name;
        document.getElementById('profileHandle').textContent = '@' + (USER.siteHandle || USER.id || '—');
        if (handleRead) handleRead.textContent = USER.siteHandle || USER.id || '—';
        bioRead.textContent = USER.bio || '';
        setProfileAvatar(USER.avatar);
        document.getElementById('profileDisplayName').value = USER.displayName || USER.name || '';
        document.getElementById('profileBioInput').value = USER.bio || '';
        if (premBadge) premBadge.style.display = USER.isPremium ? '' : 'none';
      }
    } catch (e2) {
      console.warn('profile /me retry failed', e2);
    }
    try {
      const { games } = await API.myGames();
      myGames = Array.isArray(games) ? games : [];
    } catch (e3) {
      myGames = GAMES.filter(g => g.authorId === USER.id);
    }
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
    grid.innerHTML = myGames.map(g => {
      const idRaw = String(g.id || '');
      const gid = esc(idRaw);
      const canEdit = g.status !== 'rejected';
      const genreEsc = esc(g.genre || 'Прочее');
      const titleEsc = esc(g.title || '');
      const descEsc = esc(g.description || '');
      const urlEsc = esc(g.url || '');
      const imgEsc = esc(g.imageUrl || '');
      const statEsc = esc(g.status || '');
      const pillsId = 'genrePillsEdit-' + idRaw;
      const editorHtml = canEdit ? `
      <div id="profileGameEditor-${idRaw}" class="profile-game-editor" hidden>
        <p class="profile-game-editor-lead">Карточка в ленте: название, описание, жанр, обложка. Ссылка на игру не меняется. После сохранения снова на модерацию.</p>
        <div class="field-group">
          <div class="field-label">Название</div>
          <input class="field-input profile-game-editor-title" type="text" maxlength="40" placeholder="Название игры" value="${titleEsc}">
        </div>
        <div class="field-group">
          <div class="field-label">Описание</div>
          <textarea class="field-input profile-game-editor-desc" maxlength="120" rows="3" placeholder="Кратко о игре">${descEsc}</textarea>
        </div>
        <div class="field-group">
          <div class="field-label">Жанр</div>
          <div class="genre-pills" id="${pillsId}"></div>
        </div>
        <div class="field-group">
          <div class="field-label">Обложка (необязательно)</div>
          <input class="field-input profile-game-editor-cover-url" type="url" placeholder="https://… jpg/png" value="${imgEsc}">
          <label class="image-upload">
            <input type="file" accept="image/*" class="profile-game-editor-cover-file" data-input="cover-profile" data-game-id="${idRaw}">
            <span>Выбрать файл</span>
          </label>
          <div class="image-preview profile-game-editor-preview">${g.imageUrl ? `<img src="${imgEsc}" alt="">` : '<span>Без обложки</span>'}</div>
          <button type="button" class="profile-text-btn" data-action="game-editor-clear-cover" data-game-id="${idRaw}">Убрать обложку</button>
        </div>
        <p class="field-hint profile-game-editor-url-hint">URL игры: <code class="profile-game-editor-url">${urlEsc || '—'}</code></p>
        <div class="profile-game-editor-actions">
          <button type="button" class="profile-text-btn" data-action="profile-game-editor-cancel" data-game-id="${idRaw}">Отмена</button>
          <button type="button" class="submit-btn" data-action="profile-game-editor-save" data-game-id="${idRaw}">Сохранить и на модерацию</button>
        </div>
      </div>` : '';
      return `
      <div class="profile-game-row" id="profileGameRow-${idRaw}" data-profile-game-id="${idRaw}" data-title="${titleEsc}" data-description="${descEsc}" data-genre="${genreEsc}" data-url="${urlEsc}" data-image-url="${imgEsc}" data-status="${statEsc}">
        <div class="game-card sg-store-card" data-action="open-game-profile" data-game-id="${gid}">
          <div class="game-card-thumb sg-store-card-thumb">
            ${gameStatusBadgeHtml(g.status)}
            ${gameThumbHtml(g)}
          </div>
          ${typeof sgStorefrontCardInfoHtml === 'function' ? sgStorefrontCardInfoHtml(g, { author: false, desc: true }) : `<div class="game-card-info"><div class="game-card-name">${esc(g.title)}</div><div class="game-card-stats"><span class="sg-mini-stat">${sgStatHeartSvg()}${fmtNum(g.likes)}</span><span class="sg-mini-sep">·</span><span class="sg-mini-stat">${sgStatEyeSvg()}${fmtNum(g.plays)}</span></div></div>`}
        </div>
        <div class="profile-game-actions">
          ${canEdit ? `<button type="button" class="profile-text-btn" data-action="toggle-profile-game-editor" data-game-id="${idRaw}" title="Редактировать карточку в ленте">Правки</button>` : ''}
          <button type="button" class="profile-text-btn profile-game-play-btn" data-action="open-game-profile" data-game-id="${gid}" title="Открыть в ленте">Лента</button>
          <button type="button" class="profile-text-btn profile-game-delete-btn" data-action="delete-game" data-game-id="${gid}" data-game-title="${titleEsc}" title="Удалить игру" aria-label="Удалить игру">Удалить</button>
        </div>
        ${editorHtml}
      </div>`;
    }).join('');
    myGames.forEach(g => {
      if (g.status === 'rejected') return;
      const sk = 'edit_' + g.id;
      if (typeof renderGenrePills === 'function') {
        window.selectedGenres[sk] = (g.genre && String(g.genre).trim()) ? g.genre : 'Прочее';
        renderGenrePills('genrePillsEdit-' + g.id, sk);
      }
    });
  }
}

function setProfileAvatar(avatar) {
  const el = document.getElementById('profileAvatar');
  const avatarUrl = avatarImgUrl(avatar);
  if (avatarUrl) el.innerHTML = `<img src="${esc(avatarUrl)}" alt="" referrerpolicy="no-referrer">`;
  else el.textContent = avatar || '?';
}

/** Снимок полей при входе в «Редактировать профиль» — для «Отмена». */
window.profileEditSnapshot = null;

async function saveProfile() {
  const displayName = document.getElementById('profileDisplayName').value.trim();
  const bio = document.getElementById('profileBioInput').value.trim();

  if (!displayName) {
    showToast('⚠️ Укажи имя');
    return false;
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
    window.profileEditSnapshot = null;
    document.getElementById('profile-screen')?.classList.remove('profile-edit-active');
    return true;
  } catch (e) {
    showToast(typeof userFacingError === 'function' ? userFacingError(e) : 'Не сохранилось');
    if (typeof hapticWarning === 'function') hapticWarning();
    return false;
  }
}

function startProfileEdit() {
  const dn = document.getElementById('profileDisplayName');
  const bio = document.getElementById('profileBioInput');
  window.profileEditSnapshot = {
    displayName: dn?.value ?? '',
    bio: bio?.value ?? '',
  };
  document.getElementById('profile-screen')?.classList.add('profile-edit-active');
  const wrap = document.getElementById('profile-edit-wrap');
  try {
    wrap?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch (e) {
    wrap?.scrollIntoView();
  }
  setTimeout(() => dn?.focus(), 180);
}

/** Закрыть режим редактирования без сохранения (восстановить поля из снимка). */
function discardProfileEdit() {
  document.getElementById('profile-screen')?.classList.remove('profile-edit-active');
  const snap = window.profileEditSnapshot;
  window.profileEditSnapshot = null;
  const dn = document.getElementById('profileDisplayName');
  const bio = document.getElementById('profileBioInput');
  if (snap && dn && bio) {
    dn.value = snap.displayName;
    bio.value = snap.bio;
  } else if (dn && bio) {
    dn.value = USER.displayName || USER.name || '';
    bio.value = USER.bio || '';
  }
}

/** Сохранить и выйти из режима редактирования (кнопка «Сохранить» в шапке). */
async function finishProfileEdit() {
  const ok = await saveProfile();
  if (ok && typeof closeAllProfileGameEditors === 'function') closeAllProfileGameEditors();
}

function cancelProfileEdit() {
  discardProfileEdit();
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

async function deleteGame(gameId, titleHint) {
  if (!gameId) return;
  const idEsc = String(gameId).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const row = document.querySelector('.profile-game-row[data-profile-game-id="' + idEsc + '"]');
  const fromRow = row?.dataset?.title?.trim();
  const label = (titleHint && String(titleHint).trim()) || fromRow || 'эту игру';
  const question =
    label === 'эту игру'
      ? 'Удалить игру? Это действие нельзя отменить.'
      : `Удалить «${label}»? Это действие нельзя отменить.`;
  if (!confirm(question)) return;
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
window.discardProfileEdit = discardProfileEdit;
window.finishProfileEdit = finishProfileEdit;

document.addEventListener('change', ev => {
  if (ev.target?.id === 'profileAvatarInput') onProfileAvatarFileChange(ev);
});
