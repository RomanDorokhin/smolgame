function setBottomNavActive(tab) {
  document.querySelectorAll('#bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('nav-' + tab)?.classList.add('active');
}

/** Скрыть ленту/iframe под шитами: в части WebView (Telegram) iframe композится поверх div. */
function syncBodyFeedHiddenUnderSheet() {
  const screens = [
    'profile-screen',
    'search-screen',
    'games-library-screen',
    'upload-screen',
    'author-screen'
  ];
  const anyScreenOpen = screens.some(id => document.getElementById(id)?.classList.contains('open'));
  const gameDetailOpen = document.body.classList.contains('game-detail-open');
  
  const feedHidden = anyScreenOpen || gameDetailOpen;
  document.body.classList.toggle('app-feed-hidden-under-sheet', feedHidden);
}

/** Закрыть основные вкладки и оверлей автора (нижний таб не должен «застревать» под #author-screen). */
function closeAllMainTabs() {
  if (typeof clearFeedSwipeTeaseTimers === 'function') clearFeedSwipeTeaseTimers();
  document.getElementById('feed-exit-focus')?.setAttribute('hidden', '');
  // Закрыть карточку игры, если открыта (иначе «зомби»-слой после переключения вкладки)
  const gd = document.getElementById('game-detail-screen');
  if (gd) gd.hidden = true;
  document.body.classList.remove('game-detail-open');
  window._gameDetailReturnTab = null;
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
  document.body.classList.add('author-screen-active');
  if (typeof stopFeedSwipeTeaseForLeavingFeed === 'function') stopFeedSwipeTeaseForLeavingFeed();
  document.getElementById('author-screen').classList.add('open');
  syncBodyFeedHiddenUnderSheet();
  loadAuthorProfile(authorId);
}
function closeAuthorScreen() {
  document.getElementById('author-screen').classList.remove('open');
  document.body.classList.remove('author-screen-active');
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
    
    // ТРЮК: Если мы зашли в свой профиль через ленту (как автор), 
    // и наш USER еще пустой ("Гость"), наполним его данными отсюда.
    if (user.id && (USER.id === String(user.id) || !USER.id)) {
        if (!USER.id) {
            USER.id = String(user.id);
            USER.tgId = String(user.id);
        }
        if (!USER.name || USER.name === t('author_anon') || USER.name === 'Гость') {
            USER.name = user.name || user.displayName || user.telegramName;
        }
        if (!USER.avatar || USER.avatar === '?') {
            USER.avatar = user.avatar;
        }
        USER.siteHandle = user.siteHandle || USER.siteHandle;
        USER.bio = user.bio || USER.bio;
        // Сохраняем в localStorage для надежности (state.js подхватит при следующем запуске)
        try { localStorage.setItem('smolgame:persisted_id:v1', USER.id); } catch(e) {}
    }

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
    if (typeof loadUserPosts === 'function') await loadUserPosts(authorId, 'authorPostList');
  } catch (e) {
    document.getElementById('authorProfileName').textContent = t('author_load_fail');
    showToast('⚠️ ' + (e.message || t('profile_err')));
  }
}
function switchTab(tab) {
  if (typeof hapticLight === 'function') hapticLight();

  // Consolidated Header Title & Nav Update
  const keyMap = {
    'feed': 'nav_feed',
    'games': 'nav_games',
    'upload': 'nav_upload',
    'search': 'nav_search',
    'profile': 'nav_profile'
  };
  const titleText = keyMap[tab] ? t(keyMap[tab]) : '';

  setBottomNavActive(tab);
  window._activeMainTab = tab;
  window.currentTab = tab;

  if (tab === 'feed') {
    closeAllMainTabs();
    document.body.classList.add('is-tab-feed');
    syncBodyFeedHiddenUnderSheet();
    if (typeof refreshFeedCoachState === 'function') refreshFeedCoachState();
    if (typeof scheduleFeedSwipeTeaseBoredom === 'function') scheduleFeedSwipeTeaseBoredom();
    if (typeof maybeStartFeedOnboarding === 'function') requestAnimationFrame(() => maybeStartFeedOnboarding());
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
    document.getElementById('search-screen')?.classList.add('open');
    if (typeof renderGenreFilter === 'function') renderGenreFilter();
    if (typeof initSearchInput === 'function') initSearchInput();
    const q = document.getElementById('searchInput')?.value || '';
    if (typeof onSearch === 'function') onSearch(q);
  } else if (tab === 'profile') {
    const screen = document.getElementById('profile-screen');
    screen?.classList.remove('profile-edit-active');
    screen?.classList.add('open');
    void (async () => {
      if (typeof renderProfile === 'function') await renderProfile();
      if (typeof loadAdminPending === 'function') loadAdminPending();
      if (typeof loadUserPosts === 'function' && window.USER?.id) {
        await loadUserPosts(window.USER.id, 'profilePostList');
      }
    })();
  } else if (tab === 'games') {
    document.getElementById('games-library-screen')?.classList.add('open');
    if (typeof loadGamesLibrary === 'function') loadGamesLibrary();
  } else if (tab === 'upload') {
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

    // ── Lazy-load React agent on first open ─────────────────────────────
    // The screen is display:none until here → React would mount into a
    // zero-size container and render blank.  We inject the script AFTER
    // the screen becomes display:flex so layout is correct.
    if (!window._agentScriptLoaded) {
      window._agentScriptLoaded = true;

      // Inject CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.crossOrigin = 'anonymous';
      link.href = '/smolgame/agent-v3/assets/index.css?v=30280';
      document.head.appendChild(link);

      const agentRoot = document.getElementById('agent-root');
      if (!agentRoot) return;

      if (!agentRoot.hasChildNodes()) {
        agentRoot.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted,#888);font-size:14px;gap:8px;"><span style="width:18px;height:18px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block;"></span>Загрузка архитектора v4...</div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
      }

      // Inject JS module
      const script = document.createElement('script');
      script.type = 'module';
      script.crossOrigin = 'anonymous';
      script.src = '/smolgame/agent-v3/assets/index.js?v=30280';
      document.head.appendChild(script);
      
      script.onload = () => {
        console.log('[Agent] Script loaded successfully');
      };

      script.onerror = () => {
        const r = document.getElementById('agent-root');
        if (r) r.innerHTML = '<div style="padding:20px;color:#f87171;text-align:center;">❌ Не удалось загрузить агент. Попробуйте перезагрузить страницу.</div>';
      };
      document.body.appendChild(script);
    } else {
      // On subsequent opens, just trigger resize so React recalculates layout
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
    // ───────────────────────────────────────────────────────────────────
  }

  syncBodyFeedHiddenUnderSheet();

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
