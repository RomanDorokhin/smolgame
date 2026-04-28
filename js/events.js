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
  'open-search':    () => openSearch(),
  'close-search':   () => closeSearch(),
  'close-games-library': () => closeGamesLibrary(),

  'toggle-like':    () => toggleLike(),
  'share-game':     () => shareGame(),
  'report-game':    () => reportGame(),

  'feed-retry':     () => { if (typeof loadGames === 'function') loadGames(); },
  'dismiss-feed-nav-tip': () => ackFeedNavTip(),
  'ack-feed-nav-tip':      () => ackFeedNavTip(),
  'close-feed-nav-tip':    () => closeFeedNavTip(),
  'search-clear-genre':    () => {
    window.selectedGenre = '';
    if (typeof renderGenreFilter === 'function') renderGenreFilter();
    const q = document.getElementById('searchInput')?.value || '';
    if (typeof onSearch === 'function') onSearch(q);
  },
  'welcome-next': () => welcomeNext(),
  'welcome-browse': () => welcomeFinishBrowse(),
  'welcome-upload': () => welcomeFinishUpload(),
  'upload-scroll-to-form': () => uploadScrollToForm(),

  'open-author':    () => openAuthorProfile(),
  'close-author':   () => closeAuthorScreen(),

  'toggle-follow':  (_el, ev) => { ev.stopPropagation(); toggleFollow(); },
  'toggle-author-follow': (el, ev) => { ev.stopPropagation(); toggleAuthorFollow(el); },

  'switch-tab':     (el) => switchTab(el.dataset.tab),
  'select-method':  (el) => selectMethod(el.dataset.method),
  'auth-github':    () => authGithub(),
  'github-unlink':  () => githubUnlink(),
  'github-upload-set-mode': (el) => githubUploadSetMode(el.dataset.mode),
  'github-upload-submit': () => githubUploadSubmit(),
  'url-flow-next': () => urlFlowNext(),
  'url-flow-back': () => urlFlowBack(),
  'submit-game':    (el) => submitGame(el.dataset.method),
  'gh-code-wizard-next': () => ghCodeWizardNext(),
  'gh-code-wizard-back': () => ghCodeWizardBack(),
  'gh-code-wizard-cancel': () => ghCodeWizardCancel(),
  'gh-code-wizard-publish': () => ghCodeWizardPublish(),

  'open-game':      (el) => openGameFromSearch(el.dataset.gameId),
  'open-game-profile': (el) => openGameFromProfile(el.dataset.gameId),
  'open-game-library': (el) => openGameFromLibrary(el.dataset.gameId),
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

  'admin-approve':  (el) => adminApproveGame(el.closest('.admin-card, .feed-moderation-card')),
  'admin-reject':   (el) => adminRejectGame (el.closest('.admin-card, .feed-moderation-card')),
  'admin-delete':   (el) => adminDeleteGame (el.closest('.admin-card, .feed-moderation-card')),
  'onboarding-next': () => onboardingNext(),
  'onboarding-finish': () => finishOnboarding(),
  'image-picker':   (el) => document.getElementById(el.dataset.target)?.click(),
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

document.addEventListener('click', handleDelegatedClick);
document.addEventListener('input', handleDelegatedInput);
