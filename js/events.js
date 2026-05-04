// ══════════════════════════════════════════════════════════════════════
// Делегированные обработчики событий.
// Вместо onclick="..." в HTML используем data-action="...".
// Плюсы: HTML чище, все хендлеры в одном месте, совместимо с CSP
// (strict-dynamic / без 'unsafe-inline').
// ══════════════════════════════════════════════════════════════════════

const CLICK_ACTIONS = {
  'open-upload':    () => openUpload(),
  'close-upload':   () => closeUpload(),
  'open-profile':   () => openProfile(),
  'close-profile':  () => closeProfile(),
  'delete-account': () => { if (typeof deleteAccountAction === 'function') deleteAccountAction(); },
  'open-search':    () => openSearch(),
  'close-search':   () => closeSearch(),
  'close-games-library': () => closeGamesLibrary(),

  'toggle-like':    (_el, ev) => { if (ev) ev.stopPropagation(); toggleLike(); },
  'share-game':     (_el, ev) => { if (ev) ev.stopPropagation(); shareGame(); },
  'report-game':    (_el, ev) => { if (ev) ev.stopPropagation(); closeSideActionPopup(); reportGame(); },

  'feed-retry':     () => { if (typeof loadGames === 'function') loadGames(); },
  'dismiss-feed-nav-tip': () => ackFeedNavTip(),
  'ack-feed-nav-tip':      () => ackFeedNavTip(),
  'close-feed-nav-tip':    () => closeFeedNavTip(),
  'open-feed-help-full':   () => {
    if (typeof openFeedHelpFull === 'function') openFeedHelpFull();
  },
  'leave-feed-help-detail': () => {
    if (typeof leaveFeedHelpDetail === 'function') leaveFeedHelpDetail();
  },
  'search-clear-genre':    () => {
    window.selectedGenre = '';
    if (typeof renderGenreFilter === 'function') renderGenreFilter();
    const q = document.getElementById('searchInput')?.value || '';
    if (typeof onSearch === 'function') onSearch(q);
  },
  'welcome-next': () => welcomeNext(),
  'welcome-browse': () => welcomeFinishBrowse(),
  'welcome-upload': () => welcomeFinishUpload(),
  'feed-onboarding-welcome-cta': () => {
    if (typeof onFeedOnboardingWelcomeCta === 'function') onFeedOnboardingWelcomeCta();
  },
  'upload-scroll-to-form': () => uploadScrollToForm(),
  'upload-show-premium': () => {
    if (typeof uploadShowPremium === 'function') uploadShowPremium();
  },

  'open-author':    () => openAuthorProfile(),
  'close-author':   () => closeAuthorScreen(),

  'toggle-follow':  (_el, ev) => { ev.stopPropagation(); toggleFollow(); },
  'toggle-author-follow': (el, ev) => { ev.stopPropagation(); toggleAuthorFollow(el); },

  'switch-tab': (el) => {
    const tab = el.dataset.tab;
    switchTab(tab);
    if (tab === 'profile' && typeof window.refreshActivity === 'function') {
      window.refreshActivity();
    }
  },
  'set-lang-ru':    () => { if (typeof setLang === 'function') setLang('ru'); },
  'set-lang-en':    () => { if (typeof setLang === 'function') setLang('en'); },
  'select-method':  (el) => selectMethod(el.dataset.method),
  'auth-github':    () => authGithub(),
  'github-unlink':  () => githubUnlink(),
  'github-upload-set-mode': (el) => githubUploadSetMode(el.dataset.mode),
  'github-wizard-step-back': () => {
    if (typeof githubWizardStepBack === 'function') githubWizardStepBack();
  },
  'github-wizard-publish-repo': () => {
    if (typeof githubWizardPublishRepo === 'function') githubWizardPublishRepo();
  },
  'github-wizard-submit-moderation': () => {
    if (typeof githubWizardSubmitModeration === 'function') githubWizardSubmitModeration();
  },
  'url-flow-next': () => urlFlowNext(),
  'url-flow-back': () => urlFlowBack(),
  'submit-game':    (el) => submitGame(el.dataset.method),

  'open-game':      (el) => openGameFromSearch(el.dataset.gameId),
  'open-game-profile': (el) => openGameFromProfile(el.dataset.gameId),
  'open-game-in-feed': (el) => {
    if (typeof openGameInFeedFromProfile === 'function') openGameInFeedFromProfile(el.dataset.gameId);
  },
  'open-game-detail': (el) => {
    if (typeof openGameDetail === 'function') openGameDetail(el.dataset.gameId);
  },
  'open-game-library': (el) => openGameFromLibrary(el.dataset.gameId),
  'close-game-detail': () => {
    if (typeof closeGameDetail === 'function') closeGameDetail();
  },
  'game-detail-play': () => {
    if (typeof gameDetailPlay === 'function') gameDetailPlay();
  },
  'game-detail-submit-review': () => {
    if (typeof gameDetailSubmitReview === 'function') gameDetailSubmitReview();
  },
  'game-detail-follow': (el, ev) => {
    ev.stopPropagation();
    if (typeof gameDetailToggleFollow === 'function') gameDetailToggleFollow(el);
  },
  'game-detail-owner-edit': (el) => {
    if (typeof gameDetailOwnerEdit === 'function') gameDetailOwnerEdit(el.dataset.gameId);
  },
  'game-detail-owner-feed': (el) => {
    if (typeof gameDetailOwnerFeed === 'function') gameDetailOwnerFeed(el.dataset.gameId);
  },
  'game-detail-owner-delete': (el, ev) => {
    ev.stopPropagation();
    if (typeof gameDetailOwnerDelete === 'function') {
      gameDetailOwnerDelete(el.dataset.gameId, el.dataset.gameTitle, el.dataset.gameUrl);
    }
  },
  'toggle-feed-reviews': (el, ev) => {
    if (ev) ev.stopPropagation();
    if (typeof openFeedReviewsDrawer === 'function') openFeedReviewsDrawer();
  },
  'close-feed-reviews': () => {
    if (typeof hapticLight === 'function') hapticLight();
    if (typeof closeFeedReviewsDrawer === 'function') closeFeedReviewsDrawer();
  },
  'submit-feed-review': () => {
    if (typeof submitFeedReview === 'function') submitFeedReview();
  },
  'cancel-review-action': () => {
    if (typeof cancelReviewAction === 'function') cancelReviewAction();
  },
  'review-reply': (el) => {
    if (typeof setReviewReply === 'function') {
      setReviewReply(el.dataset.reviewId, el.dataset.reviewAuthor || '');
    }
  },
  'review-edit': (el) => {
    if (typeof setReviewEdit === 'function') {
      setReviewEdit(el.dataset.reviewId, el.dataset.reviewBody || '');
    }
  },
  'review-delete': (el) => {
    if (typeof deleteFeedReview === 'function') deleteFeedReview(el.dataset.reviewId);
  },
  'delete-profile-post': (el) => {
    if (typeof deleteProfilePost === 'function') {
      deleteProfilePost(el.dataset.postId, el.dataset.userId, el.dataset.containerId);
    }
  },
  'feed-enter-focus': () => {
    if (typeof enterGameFocusMode === 'function') enterGameFocusMode();
    document.getElementById('feed-exit-focus')?.removeAttribute('hidden');
  },
  'feed-exit-focus': () => {
    if (typeof exitGameFocusMode === 'function') exitGameFocusMode();
    document.getElementById('feed-exit-focus')?.setAttribute('hidden', '');
  },
  'delete-game':    (el, ev) => {
    ev.stopPropagation();
    if (typeof deleteGame === 'function') deleteGame(el.dataset.gameId, el.dataset.gameTitle);
  },
  'toggle-profile-game-editor': (el, ev) => {
    ev.stopPropagation();
    if (typeof toggleProfileGameEditor === 'function') toggleProfileGameEditor(el.dataset.gameId);
  },
  'profile-game-editor-save': (el, ev) => {
    ev.stopPropagation();
    if (typeof saveProfileGameEditor === 'function') saveProfileGameEditor(el.dataset.gameId);
  },
  'profile-game-editor-cancel': (el, ev) => {
    ev.stopPropagation();
    if (typeof cancelProfileGameEditor === 'function') cancelProfileGameEditor(el.dataset.gameId);
  },
  'game-editor-clear-cover': (el, ev) => {
    ev.stopPropagation();
    if (typeof gameEditorClearCover === 'function') gameEditorClearCover(el.dataset.gameId);
  },
  'save-profile':   () => saveProfile(),
  'reset-profile-photo': () => resetProfilePhoto(),
  'profile-start-edit': () => startProfileEdit(),
  'profile-cancel-edit': () => cancelProfileEdit(),
  'profile-finish-edit': () => {
    if (typeof finishProfileEdit === 'function') finishProfileEdit();
  },
  'profile-discard-edit': () => {
    if (typeof discardProfileEdit === 'function') discardProfileEdit();
  },
  'set-profile-tab': (el) => {
    const tab = el.dataset.tab;
    document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.toggle('active', c.id === 'profile-tab-' + tab));
    if (tab === 'activity' && typeof window.markNotificationsRead === 'function') {
      window.markNotificationsRead();
    }
  },
  'open-activity': (el) => {
    const gameId = el.dataset.gameId;
    if (gameId && typeof openGameDetail === 'function') {
      openGameDetail(gameId);
    }
  },
  'profile-retry-me': () => {
    if (typeof renderProfile === 'function') renderProfile();
  },
  'profile-reload-miniapp': () => {
    try {
      const tg = Telegram?.WebApp;
      if (tg && typeof tg.ready === 'function') tg.ready();
      if (tg && typeof tg.expand === 'function') tg.expand();
      const url = new URL(window.location.href);
      url.searchParams.set('_tg', String(Date.now()));
      window.location.replace(url.toString());
      return;
    } catch (e) { /* ignore */ }
    window.location.reload();
  },

  'admin-approve':  (el) => adminApproveGame(el.closest('.admin-card, .feed-moderation-card')),
  'admin-reject':   (el) => adminRejectGame (el.closest('.admin-card, .feed-moderation-card')),
  'admin-delete':   (el) => adminDeleteGame (el.closest('.admin-card, .feed-moderation-card')),
  'debug-clear-cache': () => {
    if (typeof debugClearCache === 'function') debugClearCache();
  },
  'onboarding-next': () => onboardingNext(),
  'onboarding-finish': () => finishOnboarding(),
  'image-picker':   (el) => document.getElementById(el.dataset.target)?.click(),
  'submit-profile-post': () => {
    if (typeof submitProfilePost === 'function') submitProfilePost();
  },
};

function handleDelegatedClick(ev) {
  // Ищем ближайшего предка с data-action (чтобы клик по ребёнку тоже работал).
  const target = ev.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const fn = CLICK_ACTIONS[action];
  if (!fn) return;
  fn(target, ev);
}

function handleDelegatedInput(ev) {
  const target = ev.target.closest('[data-input]');
  if (!target) return;
  const kind = target.dataset.input;
  if (kind === 'search') onSearch(target.value);
  if (kind === 'cover') previewCover(target);
  if (kind === 'cover-profile' && typeof previewProfileGameCover === 'function') {
    previewProfileGameCover(target, target.dataset.gameId);
  }
}

/** Файловые input во многих WebView (Telegram и др.) шлют change, а не input — без этого превью и coverFile в редакторе игры не обновляются. */
function handleDelegatedFileChange(ev) {
  if (ev.target?.type !== 'file') return;
  const target = ev.target.closest('[data-input]');
  if (!target) return;
  const kind = target.dataset.input;
  if (kind === 'cover') previewCover(target);
  if (kind === 'cover-profile' && typeof previewProfileGameCover === 'function') {
    previewProfileGameCover(target, target.dataset.gameId);
  }
}

document.addEventListener('click', handleDelegatedClick);
document.addEventListener('input', handleDelegatedInput);
document.addEventListener('change', handleDelegatedFileChange);

// ── Попап "три точки" в боковой панели ──
function closeSideActionPopup() {
  const p = document.getElementById('sideActionPopup');
  if (p) p.hidden = true;
}

(function initSideActionMore() {
  const btn = document.getElementById('sideActionMore');
  const popup = document.getElementById('sideActionPopup');
  if (!btn || !popup) return;

  btn.querySelector('.action-icon')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    popup.hidden = !popup.hidden;
  });

  document.addEventListener('click', (ev) => {
    if (popup.hidden) return;
    if (!popup.contains(ev.target) && !btn.contains(ev.target)) {
      popup.hidden = true;
    }
  });
})();
