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

  'open-author':    () => openAuthorProfile(),

  'toggle-follow':  (_el, ev) => { ev.stopPropagation(); toggleFollow(); },

  'switch-tab':     (el) => switchTab(el.dataset.tab),
  'select-method':  (el) => selectMethod(el.dataset.method),
  'auth-github':    () => authGithub(),
  'submit-game':    (el) => submitGame(el.dataset.method),

  'open-game':      (el) => openGameFromSearch(el.dataset.gameId),

  'admin-approve':  (el) => adminApproveGame(el.closest('.admin-card')),
  'admin-reject':   (el) => adminRejectGame (el.closest('.admin-card')),
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
}

document.addEventListener('click', handleDelegatedClick);
document.addEventListener('input', handleDelegatedInput);
