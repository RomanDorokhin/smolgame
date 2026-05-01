/** Сброс кэша БЕЗ подтверждения (confirm может блокироваться в WebView) */
function debugClearCache() {
  try {
    sessionStorage.clear();
    localStorage.clear();
    location.reload();
  } catch (e) {
    alert('Err: ' + e.message);
  }
}
window.debugClearCache = debugClearCache;

var tf = typeof window.t === 'function' ? window.t : k => k;
var genreOtherApi = () => tf('genre_api_other');

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
    return `<span class="game-card-status-badge pending">${esc(tf('moderation'))}</span>`;
  }
  if (status === 'rejected') {
    return `<span class="game-card-status-badge rejected">${esc(tf('rejected'))}</span>`;
  }
  return '';
}

/** Короткое ожидание: на Desktop initData / initDataUnsafe иногда появляются с задержкой. */
async function waitTelegramUserForProfile(maxMs) {
  const cap = Number(maxMs) > 0 ? Number(maxMs) : 3500;
  const step = 70;
  const deadline = Date.now() + cap;
  while (Date.now() < deadline) {
    if (typeof ensureSmolgameInitDataFromUrl === 'function') ensureSmolgameInitDataFromUrl();
    syncUserFromTelegramWebApp();
    if (USER.id) return;
    await new Promise(r => setTimeout(r, step));
  }
}

/** Всегда подставить id/имя/аватар из Telegram (см. telegram-initdata.js syncUSERFromTelegramInit). */
function syncUserFromTelegramWebApp() {
  if (typeof window.syncUSERFromTelegramInit === 'function') {
    window.syncUSERFromTelegramInit();
  }
}

function setProfileMeBannerVisible(show, message) {
  const box = document.getElementById('profileMeBanner');
  const txt = document.getElementById('profileMeBannerText');
  if (!box) return;
  if (show && message && txt) txt.textContent = message;
  if (show) box.removeAttribute('hidden');
  else box.setAttribute('hidden', '');
}

/** Применить ответ GET /api/me к USER и DOM профиля (отдельно от списка игр). */
function applyMeToProfileUi(me, { bioRead, handleRead, premBadge, setStatGames, setStatFollowers, setStatLikes }) {
  console.log('[Profile] applyMeToProfileUi', { me, USER_before: { ...USER } });
  const st = parseProfileStats(me);
  if (st.games != null) setStatGames(String(st.games));
  if (st.likes != null) setStatLikes(fmtNum(st.likes));
  if (st.followers != null) setStatFollowers(fmtNum(st.followers));

  if (me && me.user) {
    const mu = me.user;
    // Всегда обновляем ID из API, если он пришел
    if (mu.id) {
      USER.id = String(mu.id);
      USER.tgId = String(mu.id);
    }
    if (mu.siteHandle) USER.siteHandle = mu.siteHandle;

    // Имя: приоритет за тем что в БД (mu.name), иначе за mu.displayName, иначе за mu.telegramName
    const bestName = mu.name || mu.displayName || mu.telegramName;
    if (bestName) USER.name = bestName;

    if (mu.avatar) USER.avatar = mu.avatar;

    USER.isGithubConnected = Boolean(mu.isGithubConnected);
    USER.githubUsername = mu.githubUsername || null;
    USER.hasGithubPublishToken = Boolean(mu.hasGithubPublishToken);
    USER.isPremium = Boolean(mu.isPremium);
    USER.displayName = mu.displayName || mu.name || USER.displayName || '';
    USER.bio = mu.bio || USER.bio || '';

    if (mu.isAdmin) document.body.classList.add('is-admin');
    else document.body.classList.remove('is-admin');

    if (mu.id) {
      try { localStorage.setItem('smolgame:persisted_id:v1', String(mu.id)); } catch(e) {}
    }

    if (premBadge) {
      premBadge.style.display = mu.isPremium ? 'inline-flex' : 'none';
    }
  }

  console.log('[Profile] USER_after', { ...USER });

  // Обновляем текст в любом случае (даже если me.user пустой, покажем что есть в USER)
  const nameEl = document.getElementById('profileName');
  if (nameEl) nameEl.textContent = USER.name || USER.id || tf('guest');

  const handleEl = document.getElementById('profileHandle');
  if (handleEl) {
    handleEl.textContent = '@' + (USER.siteHandle || USER.id || '—');
  }

  if (handleRead) {
    handleRead.textContent = USER.siteHandle || USER.id || '—';
  }

  if (bioRead) {
    bioRead.textContent = USER.bio || '';
    bioRead.style.display = USER.bio ? '' : 'none';
  }
  setProfileAvatar(USER.avatar);
  const dnInput = document.getElementById('profileDisplayName');
  if (dnInput) dnInput.value = USER.displayName || USER.name || '';
  const bioInput = document.getElementById('profileBioInput');
  if (bioInput) bioInput.value = USER.bio || '';
}

async function renderProfile() {
  const bioRead = document.getElementById('profileBio');
  const handleRead = document.getElementById('profileSiteHandleRead');

  await waitTelegramUserForProfile(4000);
  syncUserFromTelegramWebApp();
  setProfileMeBannerVisible(false);

  setProfileAvatar(USER.avatar);
  document.getElementById('profileName').textContent = USER.name || USER.id || tf('guest');
  document.getElementById('profileHandle').textContent = '@' + (USER.siteHandle || USER.id || '—');
  if (handleRead) handleRead.textContent = USER.siteHandle || USER.id || '—';
  if (bioRead) bioRead.textContent = '';

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

  // watchdog для защиты от сброса имени в "Гость" (бывает при лагах i18n или WebView)
  if (!window._profileWatchdog) {
    window._profileWatchdog = setInterval(() => {
      const el = document.getElementById('profileName');
      const cur = el?.textContent;
      const tFunc = typeof window.t === 'function' ? window.t : k => k;
      const guestText = tFunc('guest') || 'Гость';
      if (el && USER.id && (cur === guestText || cur === 'Guest' || !cur || cur === '...')) {
        el.textContent = USER.name || USER.id;
      }
    }, 1000);
  }

  let me = null;
  try {
    me = await API.me();
    
    // FALLBACK: Если API.me вернул Гостя (user: null), но у нас есть хоть какой-то USER.id
    // (например, вытянутый из Telegram initData или URL), попробуем дернуть публичный профиль.
    if ((!me || !me.user) && USER.id) {
      console.log('[Profile] API.me returned Guest, trying fallback to API.userProfile for ID:', USER.id);
      try {
        const pub = await API.userProfile(USER.id);
        if (pub && pub.user) {
          // Собираем "псевдо-me" объект из публичного профиля
          me = {
            ...me,
            user: { ...pub.user, isAdmin: document.body.classList.contains('is-admin') }, // isAdmin сохраняем если он уже был
            stats: pub.stats
          };
          console.log('[Profile] Fallback success', me);
        }
      } catch (e2) {
        console.warn('[Profile] Fallback failed', e2);
      }
    }

    if (debugPanel) {
      document.getElementById('debugMe').textContent = JSON.stringify(me);
    }
    applyMeToProfileUi(me, { bioRead, handleRead, premBadge, setStatGames, setStatFollowers, setStatLikes });
  } catch (err) {
    console.error('renderProfile failed', err);
    const hint = err.message || '';
    if (debugPanel) {
      document.getElementById('debugLastErr').textContent = hint;
    }
    setProfileMeBannerVisible(true, hint || tf('profile_me_failed'));
  } finally {
    if (USER.id) {
      document.getElementById('profileEditOpenBtn').style.display = '';
    } else {
      // Если даже после всех попыток ID нет — кнопка не нужна
      document.getElementById('profileEditOpenBtn').style.display = 'none';
    }
  }
  document.getElementById('devBadge').style.display = USER.isGithubConnected ? '' : 'none';

  try {
    const myGamesRes = await API.myGames();
    const games = myGamesRes?.games;
    myGames = Array.isArray(games) ? games : [];
  } catch (e) {
    console.warn('profile myGames failed', e);
    try {
      const { games } = await API.myGames();
      myGames = Array.isArray(games) ? games : [];
    } catch (e2) {
      myGames = Array.isArray(GAMES) ? GAMES.filter(g => sameTelegramUserId(g.authorId, USER.id)) : [];
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
  if (!grid) {
    console.warn('renderProfile: #myGamesGrid missing');
    return;
  }
  if (myGames.length === 0) {
    grid.innerHTML =
      typeof sgEmptyGridHtml === 'function'
        ? sgEmptyGridHtml(tf('profile_empty_games_title'), tf('profile_empty_games_sub'))
        : `<div class="sg-empty-state sg-empty-state--grid"><div class="sg-empty-state-title">${esc(tf('profile_empty_games_title'))}</div><div class="sg-empty-state-sub">${esc(tf('profile_empty_games_sub'))}</div></div>`;
  } else {
    grid.innerHTML = myGames.map(g => {
      const idRaw = String(g.id || '');
      const gid = esc(idRaw);
      const canEdit = g.status !== 'rejected';
      const genreRaw = (g.genre && String(g.genre).trim()) ? g.genre : genreOtherApi();
      const genreEsc = esc(genreRaw);
      const titleEsc = esc(g.title || '');
      const descEsc = esc(g.description || '');
      const urlEsc = esc(g.url || '');
      const imgEsc = esc(g.imageUrl || '');
      const statEsc = esc(g.status || '');
      const pillsId = 'genrePillsEdit-' + idRaw;
      const editorHtml = canEdit ? `
      <div id="profileGameEditor-${idRaw}" class="profile-game-editor" hidden>
        <p class="profile-game-editor-lead">${esc(tf('profile_editor_lead'))}</p>
        <div class="field-group">
          <div class="field-label">${esc(tf('field_title'))}</div>
          <input class="field-input profile-game-editor-title" type="text" maxlength="40" placeholder="${esc(tf('field_title_placeholder'))}" value="${titleEsc}">
        </div>
        <div class="field-group">
          <div class="field-label">${esc(tf('field_desc'))}</div>
          <textarea class="field-input profile-game-editor-desc" maxlength="120" rows="3" placeholder="${esc(tf('field_desc_short'))}">${descEsc}</textarea>
        </div>
        <div class="field-group">
          <div class="field-label">${esc(tf('field_genre'))}</div>
          <div class="genre-pills" id="${pillsId}"></div>
        </div>
        <div class="field-group">
          <div class="field-label">${esc(tf('cover_optional'))}</div>
          <input class="field-input profile-game-editor-cover-url" type="url" placeholder="${esc(tf('profile_cover_url_hint'))}" value="${imgEsc}">
          <label class="image-upload">
            <input type="file" accept="image/*" class="profile-game-editor-cover-file" data-input="cover-profile" data-game-id="${idRaw}">
            <span>${esc(tf('profile_choose_file'))}</span>
          </label>
          <div class="image-preview profile-game-editor-preview">${g.imageUrl ? `<img src="${imgEsc}" alt="">` : `<span>${esc(tf('no_cover'))}</span>`}</div>
          <button type="button" class="profile-text-btn" data-action="game-editor-clear-cover" data-game-id="${idRaw}">${esc(tf('profile_clear_cover'))}</button>
        </div>
        <p class="field-hint profile-game-editor-url-hint">${esc(tf('profile_game_url_label'))} <code class="profile-game-editor-url">${urlEsc || '—'}</code></p>
        <div class="profile-game-editor-actions">
          <button type="button" class="profile-text-btn" data-action="profile-game-editor-cancel" data-game-id="${idRaw}">${esc(tf('profile_discard'))}</button>
          <button type="button" class="submit-btn" data-action="profile-game-editor-save" data-game-id="${idRaw}">${esc(tf('profile_save_review'))}</button>
        </div>
      </div>` : '';
      return `
      <div class="profile-game-row" id="profileGameRow-${idRaw}" data-profile-game-id="${idRaw}" data-title="${titleEsc}" data-description="${descEsc}" data-genre="${genreEsc}" data-url="${urlEsc}" data-image-url="${imgEsc}" data-status="${statEsc}">
        <div class="game-card sg-store-card" data-action="open-game-detail" data-game-id="${gid}">
          <div class="game-card-thumb sg-store-card-thumb">
            ${gameStatusBadgeHtml(g.status)}
            ${typeof gameThumbHtml === 'function' ? gameThumbHtml(g) : ''}
          </div>
          ${typeof sgStorefrontCardInfoHtml === 'function' ? sgStorefrontCardInfoHtml(g, { author: false, desc: true }) : `<div class="game-card-info"><div class="game-card-name">${esc(g.title)}</div><div class="game-card-stats"><span class="sg-mini-stat">${sgStatHeartSvg()}${fmtNum(g.likes)}</span><span class="sg-mini-sep">·</span><span class="sg-mini-stat">${sgStatEyeSvg()}${fmtNum(g.plays)}</span></div></div>`}
        </div>
        <div class="profile-game-actions profile-game-actions--icons" role="toolbar" aria-label="${esc(tf('profile_game_actions_aria'))}">
          ${canEdit ? `<button type="button" class="profile-game-icon-btn" data-action="toggle-profile-game-editor" data-game-id="${idRaw}" title="${esc(tf('gd_edit'))}" aria-label="${esc(tf('gd_edit'))}"><svg class="sg-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M15 6l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>` : ''}
          <button type="button" class="profile-game-icon-btn" data-action="open-game-in-feed" data-game-id="${gid}" title="${esc(tf('to_feed'))}" aria-label="${esc(tf('profile_open_in_feed_aria'))}"><svg class="sg-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h14" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/></svg></button>
          <button type="button" class="profile-game-icon-btn profile-game-icon-btn--danger" data-action="delete-game" data-game-id="${gid}" data-game-title="${titleEsc}" title="${esc(tf('gd_delete'))}" aria-label="${esc(tf('profile_delete_game_aria'))}"><svg class="sg-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 3h6M4 7h16M6 7l1 14h10l1-14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
        </div>
        ${editorHtml}
      </div>`;
    }).join('');
    myGames.forEach(g => {
      if (g.status === 'rejected') return;
      const sk = 'edit_' + g.id;
      if (typeof renderGenrePills === 'function') {
        window.selectedGenres[sk] = (g.genre && String(g.genre).trim()) ? g.genre : genreOtherApi();
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
    showToast(tf('profile_toast_name'));
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
    showToast(tf('profile_saved'));
    if (typeof hapticSuccess === 'function') hapticSuccess();
    if (typeof updateOverlay === 'function') updateOverlay();
    window.profileEditSnapshot = null;
    document.getElementById('profile-screen')?.classList.remove('profile-edit-active');
    return true;
  } catch (e) {
    showToast(typeof userFacingError === 'function' ? userFacingError(e) : tf('err_load'));
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
    showToast(tf('profile_photo_tg'));
    if (typeof updateOverlay === 'function') updateOverlay();
  } catch (e) {
    showToast('⚠️ ' + (e.message || tf('err_error')));
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
    if (!imageUrl) throw new Error(tf('err_no_url'));
    const me = await API.updateMe({ photoUrl: imageUrl });
    if (me?.user) {
      USER.avatar = me.user.avatar || imageUrl;
      setProfileAvatar(USER.avatar);
    }
    showToast(tf('profile_photo_updated'));
    if (typeof updateOverlay === 'function') updateOverlay();
  } catch (e) {
    showToast('⚠️ ' + (e.message || tf('err_load')));
  } finally {
    input.value = '';
  }
}

async function openGameFromProfile(gameId) {
  if (!gameId) return;
  if (typeof openGameDetail === 'function') openGameDetail(gameId);
}

async function openGameInFeedFromProfile(gameId) {
  if (!gameId) return;
  if (typeof closeProfile === 'function') closeProfile();
  if (typeof switchTab === 'function') switchTab('feed');
  const idx = typeof injectGameIntoFeed === 'function' ? await injectGameIntoFeed(gameId) : -1;
  if (idx >= 0 && typeof goTo === 'function') goTo(idx, false);
}

function isGithubPagesGameUrl(urlRaw) {
  try {
    const u = new URL(String(urlRaw || '').trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return u.hostname.toLowerCase().endsWith('.github.io');
  } catch {
    return false;
  }
}

async function deleteGame(gameId, titleHint, playUrlHint) {
  if (!gameId) return;
  const idEsc = String(gameId).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const row = document.querySelector('.profile-game-row[data-profile-game-id="' + idEsc + '"]');
  const fromRow = row?.dataset?.title?.trim();
  const label = (titleHint && String(titleHint).trim()) || fromRow || tf('profile_delete_this');
  const genericLabel = tf('profile_delete_this');
  const question =
    label === genericLabel
      ? tf('profile_delete_confirm_generic')
      : tf('profile_delete_confirm_named', { title: label });
  if (!confirm(question)) return;

  const playUrl =
    (playUrlHint && String(playUrlHint).trim()) ||
    row?.dataset?.url?.trim() ||
    '';

  let deleteGithubRepo = false;
  if (playUrl && isGithubPagesGameUrl(playUrl)) {
    let host = '';
    try {
      host = new URL(playUrl).hostname;
    } catch {
      host = playUrl.split('/')[2] || '';
    }
    deleteGithubRepo = confirm(tf('profile_delete_gh_confirm', { host }));
  }

  try {
    const res = await API.delete(gameId, { deleteGithubRepo });
    const msg = tf('profile_delete_done');
    if (res?.githubDeleted) msg += tf('profile_delete_repo_done');
    else if (res?.githubDeleteNote) msg += '. ' + res.githubDeleteNote;
    showToast(msg);
    await loadGames();
    renderProfile();
  } catch (e) {
    showToast('⚠️ ' + (e.message || tf('profile_delete_fail')));
  }
}

window.renderProfile = renderProfile;
window.deleteGame = deleteGame;
window.saveProfile = saveProfile;
window.resetProfilePhoto = resetProfilePhoto;
window.openGameFromProfile = openGameFromProfile;
window.openGameInFeedFromProfile = openGameInFeedFromProfile;
window.startProfileEdit = startProfileEdit;
window.cancelProfileEdit = cancelProfileEdit;
window.discardProfileEdit = discardProfileEdit;
window.finishProfileEdit = finishProfileEdit;

window.finishProfileEdit = finishProfileEdit;

document.addEventListener('change', ev => {
  if (ev.target?.id === 'profileAvatarInput') onProfileAvatarFileChange(ev);
});
