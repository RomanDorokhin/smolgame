function setBottomNavActive(tab) {
  document.querySelectorAll('#bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('nav-' + tab)?.classList.add('active');
}

/** Закрыть основные вкладки и оверлей автора (нижний таб не должен «застревать» под #author-screen). */
function closeAllMainTabs() {
  if (typeof clearFeedSwipeTeaseTimers === 'function') clearFeedSwipeTeaseTimers();
  const upload = document.getElementById('upload-screen');
  if (upload?.classList.contains('open')) {
    upload.classList.remove('open');
    if (typeof hideUploadWelcomeBlock === 'function') hideUploadWelcomeBlock();
  }
  if (typeof closeAllProfileGameEditors === 'function') closeAllProfileGameEditors();
  const profile = document.getElementById('profile-screen');
  profile?.classList.remove('open', 'profile-edit-active');
  document.getElementById('search-screen')?.classList.remove('open');
  document.getElementById('games-library-screen')?.classList.remove('open');
  document.getElementById('author-screen')?.classList.remove('open');
}

function openUpload() {
  switchTab('upload');
}
function closeUpload() {
  document.getElementById('upload-screen')?.classList.remove('open');
  if (typeof hideUploadWelcomeBlock === 'function') hideUploadWelcomeBlock();
  switchTab('feed');
}

function openProfile() {
  switchTab('profile');
}
function closeProfile() {
  if (typeof closeAllProfileGameEditors === 'function') closeAllProfileGameEditors();
  document.getElementById('profile-screen')?.classList.remove('open', 'profile-edit-active');
  switchTab('feed');
}

function openSearch() {
  switchTab('search');
}
function closeSearch() {
  document.getElementById('search-screen')?.classList.remove('open');
  switchTab('feed');
}

function closeGamesLibrary() {
  document.getElementById('games-library-screen')?.classList.remove('open');
  switchTab('feed');
}

function openAuthorScreen(authorId) {
  if (!authorId) return;
  document.body.classList.remove('is-tab-feed');
  if (typeof stopFeedSwipeTeaseForLeavingFeed === 'function') stopFeedSwipeTeaseForLeavingFeed();
  document.getElementById('author-screen').classList.add('open');
  loadAuthorProfile(authorId);
}
function closeAuthorScreen() {
  document.getElementById('author-screen').classList.remove('open');
  if (document.getElementById('nav-feed')?.classList.contains('active')) {
    document.body.classList.add('is-tab-feed');
    if (typeof scheduleFeedSwipeTeaseBoredom === 'function') scheduleFeedSwipeTeaseBoredom();
  }
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
        <div class="game-card-stats"><span class="sg-mini-stat">${sgStatHeartSvg()}${fmtNum(g.likes)}</span><span class="sg-mini-sep">·</span><span class="sg-mini-stat">${sgStatEyeSvg()}${fmtNum(g.plays)}</span></div>
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
    showToast('Отписались');
  } else {
    followedSet.add(authorId);
    btn.textContent = 'Вы подписаны';
    btn.classList.add('following');
    showToast('Подписка оформлена');
  }
  saveSet(STORAGE_KEYS.followed, followedSet);
  updateOverlay();
  (wasFollowing ? API.unfollow(authorId) : API.follow(authorId)).catch(err => {
    if (wasFollowing) followedSet.add(authorId); else followedSet.delete(authorId);
    saveSet(STORAGE_KEYS.followed, followedSet);
    updateOverlay();
    loadAuthorProfile(authorId);
    showToast(typeof userFacingError === 'function' ? userFacingError(err) : 'Не вышло');
    if (typeof hapticWarning === 'function') hapticWarning();
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
    btn.textContent = profile.isSelf ? 'Это вы' : (profile.isFollowing ? 'Вы подписаны' : '+ Подписаться');
    btn.classList.toggle('following', Boolean(profile.isFollowing || profile.isSelf));
    btn.dataset.authorId = authorId;
    btn.dataset.isSelf = profile.isSelf ? '1' : '';

    const games = Array.isArray(gamesData.games) ? gamesData.games : [];
    const grid = document.getElementById('authorGamesGrid');
    if (games.length === 0) {
      grid.innerHTML =
        typeof sgEmptyGridHtml === 'function'
          ? sgEmptyGridHtml('Нет игр', 'У этого автора пока ничего не опубликовано.')
          : `<div class="sg-empty-state sg-empty-state--grid"><div class="sg-empty-state-title">Нет игр</div><div class="sg-empty-state-sub">У этого автора пока ничего не опубликовано.</div></div>`;
    } else {
      grid.innerHTML = games.map(g => `
        <div class="game-card" data-action="open-game" data-game-id="${esc(g.id)}">
          <div class="game-card-thumb">${gameThumbHtml(g)}</div>
          <div class="game-card-info">
            <div class="game-card-name">${esc(g.title)}</div>
            <div class="game-card-stats"><span class="sg-mini-stat">${sgStatHeartSvg()}${fmtNum(g.likes)}</span><span class="sg-mini-sep">·</span><span class="sg-mini-stat">${sgStatEyeSvg()}${fmtNum(g.plays)}</span></div>
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
  if (!tab) return;
  if (typeof hapticLight === 'function') hapticLight();
  setBottomNavActive(tab);
  document.body.classList.toggle(
    'app-main-chrome',
    tab === 'feed' || tab === 'games' || tab === 'search' || tab === 'profile' || tab === 'upload'
  );

  if (tab === 'feed') {
    closeAllMainTabs();
    document.body.classList.add('is-tab-feed');
    const chrome = document.getElementById('app-tab-chrome-label');
    if (chrome) chrome.textContent = 'Лента';
    if (typeof refreshFeedCoachState === 'function') refreshFeedCoachState();
    if (typeof scheduleSwipeStripIdleNudge === 'function') scheduleSwipeStripIdleNudge();
    if (typeof scheduleFeedSwipeTeaseBoredom === 'function') scheduleFeedSwipeTeaseBoredom();
    return;
  }

  closeAllMainTabs();
  document.body.classList.remove('is-tab-feed');
  if (typeof stopFeedSwipeTeaseForLeavingFeed === 'function') stopFeedSwipeTeaseForLeavingFeed();

  if (tab === 'search') {
    const chrome = document.getElementById('app-tab-chrome-label');
    if (chrome) chrome.textContent = 'Поиск';
    document.getElementById('search-screen')?.classList.add('open');
    if (typeof renderGenreFilter === 'function') renderGenreFilter();
    if (typeof initSearchInput === 'function') initSearchInput();
    const q = document.getElementById('searchInput')?.value || '';
    if (typeof onSearch === 'function') onSearch(q);
  } else if (tab === 'profile') {
    const chrome = document.getElementById('app-tab-chrome-label');
    if (chrome) chrome.textContent = 'Профиль';
    const screen = document.getElementById('profile-screen');
    screen?.classList.remove('profile-edit-active');
    if (typeof renderProfile === 'function') renderProfile();
    if (typeof loadAdminPending === 'function') loadAdminPending();
    screen?.classList.add('open');
  } else if (tab === 'games') {
    document.getElementById('games-library-screen')?.classList.add('open');
    const chrome = document.getElementById('app-tab-chrome-label');
    if (chrome) chrome.textContent = 'Игры';
    if (typeof loadGamesLibrary === 'function') loadGamesLibrary();
  } else if (tab === 'upload') {
    const chrome = document.getElementById('app-tab-chrome-label');
    if (chrome) chrome.textContent = 'Загрузить';
    const upload = document.getElementById('upload-screen');
    upload?.classList.add('open');
    upload.scrollTop = 0;
    if (typeof resetGhCodeWizard === 'function') resetGhCodeWizard();
    if (typeof renderGenrePills === 'function') {
      renderGenrePills('genrePillsGhCode', 'ghCode');
      renderGenrePills('genrePills2', 'url');
    }
    if (typeof refreshUploadCapabilities === 'function') {
      refreshUploadCapabilities().finally(() => {
        if (typeof selectMethod === 'function') selectMethod(window.selectedUploadMethod || 'url');
      });
    } else if (typeof selectMethod === 'function') {
      selectMethod(window.selectedUploadMethod || 'url');
    }
    if (typeof maybeShowWelcomeOnUploadOpen === 'function') maybeShowWelcomeOnUploadOpen();
  }
}

window.openUpload = openUpload;
window.closeUpload = closeUpload;
window.openProfile = openProfile;
window.closeProfile = closeProfile;
window.openSearch = openSearch;
window.closeSearch = closeSearch;
window.closeGamesLibrary = closeGamesLibrary;
window.openAuthorScreen = openAuthorScreen;
window.closeAuthorScreen = closeAuthorScreen;
window.loadAuthorProfile = loadAuthorProfile;
window.toggleAuthorFollow = toggleAuthorFollow;
window.switchTab = switchTab;
window.closeAllMainTabs = closeAllMainTabs;
window.setBottomNavActive = setBottomNavActive;
