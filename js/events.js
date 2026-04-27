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

  'toggle-like':    () => toggleLike(),
  'share-game':     () => shareGame(),
  'report-game':    () => reportGame(),

  'feed-nav-prev':  () => feedNavPrev(),
  'feed-nav-next':  () => feedNavNext(),
  'dismiss-feed-nav-tip': () => dismissFeedNavTip(),
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
  'open-github-upload-modal': () => openGithubUploadModal(),
  'close-github-upload-modal': () => closeGithubUploadModal(),
  'github-upload-set-mode': (el) => githubUploadSetMode(el.dataset.mode),
  'github-upload-submit': () => githubUploadSubmit(),
  'submit-game':    (el) => submitGame(el.dataset.method),
  'code-wizard-next': () => codeWizardNext(),
  'code-wizard-back': () => codeWizardBack(),
  'code-wizard-cancel': () => codeWizardCancel(),
  'code-wizard-publish': () => codeWizardPublish(),
  'gh-code-wizard-next': () => ghCodeWizardNext(),
  'gh-code-wizard-back': () => ghCodeWizardBack(),
  'gh-code-wizard-cancel': () => ghCodeWizardCancel(),
  'gh-code-wizard-publish': () => ghCodeWizardPublish(),

  'open-game':      (el) => openGameFromSearch(el.dataset.gameId),
  'open-game-profile': (el) => openGameFromProfile(el.dataset.gameId),
  'delete-game':    (el, ev) => { ev.stopPropagation(); deleteGame(el.dataset.gameId); },
  'save-profile':   () => saveProfile(),
  'reset-profile-photo': () => resetProfilePhoto(),
  'profile-start-edit': () => startProfileEdit(),
  'profile-cancel-edit': () => cancelProfileEdit(),

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
}

document.addEventListener('click', handleDelegatedClick);
document.addEventListener('input', handleDelegatedInput);
