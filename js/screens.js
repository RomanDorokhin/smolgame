function setBottomNavActive(tab) {
  document.querySelectorAll('#bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('nav-' + tab)?.classList.add('active');
}

/** Скрыть ленту/iframe под шитами: в части WebView (Telegram) iframe композится поверх div. */
function syncBodyFeedHiddenUnderSheet() {
  const feedHidden = Boolean(
    document.getElementById('profile-screen')?.classList.contains('open') ||
      document.getElementById('search-screen')?.classList.contains('open') ||
      document.getElementById('games-library-screen')?.classList.contains('open') ||
      document.getElementById('upload-screen')?.classList.contains('open') ||
      document.getElementById('author-screen')?.classList.contains('open')
  );
  document.body.classList.toggle('app-feed-hidden-under-sheet', feedHidden);
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
  syncBodyFeedHiddenUnderSheet();
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
  syncBodyFeedHiddenUnderSheet();
  loadAuthorProfile(authorId);
}
function closeAuthorScreen() {
  document.getElementById('author-screen').classList.remove('open');
  syncBodyFeedHiddenUnderSheet();
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
    <div class="game-card sg-store-card" data-action="open-game-detail" data-game-id="${esc(g.id)}">
      <div class="game-card-thumb sg-store-card-thumb">${typeof gameThumbHtml === 'function' ? gameThumbHtml(g) : ''}</div>
      ${typeof sgStorefrontCardInfoHtml === 'function' ? sgStorefrontCardInfoHtml(g, { author: false, desc: true }) : `<div class="game-card-info"><div class="game-card-name">${esc(g.title)}</div><div class="game-card-stats"><span class="sg-mini-stat">${sgStatHeartSvg()}${fmtNum(g.likes)}</span><span class="sg-mini-sep">·</span><span class="sg-mini-stat">${sgStatEyeSvg()}${fmtNum(g.plays)}</span></div></div>`}
    </div>
  `;
}

function toggleAuthorFollow(btn) {
  if (!btn?.dataset.authorId || btn.dataset.isSelf) return;
  const t = typeof window.t === 'function' ? window.t : k => k;
  const authorId = btn.dataset.authorId;
  const wasFollowing = followedSet.has(authorId);
  if (wasFollowing) {
    followedSet.delete(authorId);
    btn.textContent = t('follow_add');
    btn.classList.remove('following');
    showToast(t('unsubscribed'));
  } else {
    followedSet.add(authorId);
    btn.textContent = t('follow_done');
    btn.classList.add('following');
    showToast(t('subscribed'));
  }
  saveSet(STORAGE_KEYS.followed, followedSet);
  updateOverlay();
  (wasFollowing ? API.unfollow(authorId) : API.follow(authorId)).catch(err => {
    if (wasFollowing) followedSet.add(authorId); else followedSet.delete(authorId);
    saveSet(STORAGE_KEYS.followed, followedSet);
    updateOverlay();
    loadAuthorProfile(authorId);
    showToast(typeof userFacingError === 'function' ? userFacingError(err) : t('try_again'));
    if (typeof hapticWarning === 'function') hapticWarning();
    console.warn('author follow failed', err);
  });
}

async function loadAuthorProfile(authorId) {
  const t = typeof window.t === 'function' ? window.t : k => k;
  document.getElementById('authorProfileName').textContent = t('author_loading');
  document.getElementById('authorProfileHandle').textContent = '@—';
  document.getElementById('authorGamesGrid').innerHTML =
    `<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:var(--muted);font-size:14px;">${esc(t('author_loading_games'))}</div>`;

  try {
    const [profile, gamesData] = await Promise.all([
      API.userProfile(authorId),
      API.userGames(authorId),
    ]);
    const user = profile.user || {};
    const stats = profile.stats || {};
    setAvatar(document.getElementById('authorProfileAvatar'), user.avatar || '?');
    document.getElementById('authorProfileName').textContent = user.name || t('author_anon');
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
    btn.textContent = profile.isSelf ? t('author_you') : (profile.isFollowing ? t('follow_done') : t('author_follow'));
    btn.classList.toggle('following', Boolean(profile.isFollowing || profile.isSelf));
    btn.dataset.authorId = authorId;
    btn.dataset.isSelf = profile.isSelf ? '1' : '';

    const games = Array.isArray(gamesData.games) ? gamesData.games : [];
    const grid = document.getElementById('authorGamesGrid');
    if (games.length === 0) {
      grid.innerHTML =
        typeof sgEmptyGridHtml === 'function'
          ? sgEmptyGridHtml(t('author_no_games'), t('author_no_games_sub'))
          : `<div class="sg-empty-state sg-empty-state--grid"><div class="sg-empty-state-title">${esc(t('author_no_games'))}</div><div class="sg-empty-state-sub">${esc(t('author_no_games_sub'))}</div></div>`;
    } else {
      grid.innerHTML = games.map(g => `
        <div class="game-card sg-store-card" data-action="open-game-detail" data-game-id="${esc(g.id)}">
          <div class="game-card-thumb sg-store-card-thumb">${typeof gameThumbHtml === 'function' ? gameThumbHtml(g) : ''}</div>
          ${typeof sgStorefrontCardInfoHtml === 'function' ? sgStorefrontCardInfoHtml(g, { author: false, desc: true }) : `<div class="game-card-info"><div class="game-card-name">${esc(g.title)}</div><div class="game-card-stats"><span class="sg-mini-stat">${sgStatHeartSvg()}${fmtNum(g.likes)}</span><span class="sg-mini-sep">·</span><span class="sg-mini-stat">${sgStatEyeSvg()}${fmtNum(g.plays)}</span></div></div>`}
        </div>
      `).join('');
    }
  } catch (e) {
    document.getElementById('authorProfileName').textContent = t('author_load_fail');
    showToast('⚠️ ' + (e.message || t('profile_err')));
  }
}

function switchTab(tab) {
  if (!tab) return;
  const t = typeof window.t === 'function' ? window.t : k => k;
  if (
    typeof isFeedOnboardingBlocking === 'function' &&
    isFeedOnboardingBlocking() &&
    typeof window.forceDismissFeedOnboarding === 'function'
  ) {
    window.forceDismissFeedOnboarding();
  }
  // Не блокируем табы вторым return: класс feed-onboarding-ui мог залипнуть без карточки —
  // тогда профиль/игры «мёртвые». forceDismiss выше уже снял UI.
  if (typeof hapticLight === 'function') hapticLight();

  if (tab === 'feed') {
    closeAllMainTabs();
    document.body.classList.add('is-tab-feed');
    syncBodyFeedHiddenUnderSheet();
    const chrome = document.getElementById('app-tab-chrome-label');
    if (chrome) chrome.textContent = t('nav_feed');
    if (typeof refreshFeedCoachState === 'function') refreshFeedCoachState();
    if (typeof scheduleFeedSwipeTeaseBoredom === 'function') scheduleFeedSwipeTeaseBoredom();
    if (typeof maybeStartFeedOnboarding === 'function') requestAnimationFrame(() => maybeStartFeedOnboarding());
    setBottomNavActive(tab);
    window._activeMainTab = tab;
    document.body.classList.toggle(
      'app-main-chrome',
      tab === 'feed' || tab === 'games' || tab === 'search' || tab === 'profile' || tab === 'upload'
    );
    return;
  }

  closeAllMainTabs();
  document.body.classList.remove('is-tab-feed');
  if (typeof stopFeedSwipeTeaseForLeavingFeed === 'function') stopFeedSwipeTeaseForLeavingFeed();

  if (tab === 'search') {
    const chrome = document.getElementById('app-tab-chrome-label');
    if (chrome) chrome.textContent = t('nav_search');
    document.getElementById('search-screen')?.classList.add('open');
    if (typeof renderGenreFilter === 'function') renderGenreFilter();
    if (typeof initSearchInput === 'function') initSearchInput();
    const q = document.getElementById('searchInput')?.value || '';
    if (typeof onSearch === 'function') onSearch(q);
  } else if (tab === 'profile') {
    const chrome = document.getElementById('app-tab-chrome-label');
    if (chrome) chrome.textContent = t('nav_profile');
    const screen = document.getElementById('profile-screen');
    screen?.classList.remove('profile-edit-active');
    screen?.classList.add('open');
    void (async () => {
      if (typeof renderProfile === 'function') await renderProfile();
      if (typeof loadAdminPending === 'function') loadAdminPending();
    })();
  } else if (tab === 'games') {
    document.getElementById('games-library-screen')?.classList.add('open');
    const chrome = document.getElementById('app-tab-chrome-label');
    if (chrome) chrome.textContent = t('nav_games');
    if (typeof loadGamesLibrary === 'function') loadGamesLibrary();
  } else if (tab === 'upload') {
    const chrome = document.getElementById('app-tab-chrome-label');
    if (chrome) chrome.textContent = t('nav_upload');
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

  syncBodyFeedHiddenUnderSheet();

  setBottomNavActive(tab);
  window._activeMainTab = tab;
  document.body.classList.toggle(
    'app-main-chrome',
    tab === 'feed' || tab === 'games' || tab === 'search' || tab === 'profile' || tab === 'upload'
  );
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
window.syncBodyFeedHiddenUnderSheet = syncBodyFeedHiddenUnderSheet;
