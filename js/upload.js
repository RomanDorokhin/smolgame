async function refreshUploadCapabilities() {
  try {
    const me = await API.me();
    if (me?.user) {
      USER.isGithubConnected = Boolean(me.user.isGithubConnected);
      USER.githubUsername = me.user.githubUsername || null;
      USER.hasGithubPublishToken = Boolean(me.user.hasGithubPublishToken);
      USER.isPremium = Boolean(me.user.isPremium);
    }
  } catch (e) {
    console.warn('refreshUploadCapabilities', e);
  }
  updateGithubUploadUi();
}

function syncPremiumMethodCard() {
  const premBtn = document.getElementById('upload-premium-more');
  const premDesc = document.getElementById('method-premium-desc');
  if (!premBtn) return;
  const locked = !USER.isPremium;
  premBtn.classList.toggle('upload-more-btn--locked', locked);
  if (premDesc) {
    premDesc.textContent = locked ? 'скоро' : 'доступ';
  }
}

function refreshPremiumPanelAccess() {
  const ok = document.getElementById('premium-access-active');
  const wait = document.getElementById('premium-access-waitlist');
  if (ok) ok.hidden = !USER.isPremium;
  if (wait) wait.hidden = USER.isPremium;
}

function updateGithubUploadUi() {
  syncPremiumMethodCard();
  refreshPremiumPanelAccess();
  const hint = document.getElementById('github-connect-hint');
  if (hint) {
    if (!USER.isGithubConnected) {
      hint.textContent = 'Подключи GitHub — ниже появится форма. Каждый вход из Telegram подтверждается в GitHub отдельно.';
    } else if (!USER.hasGithubPublishToken) {
      hint.textContent =
        'Доступ к GitHub не сохранился. Нажми «Войти через GitHub» ещё раз и разреши публикацию.';
    } else {
      hint.textContent =
        'Вставь код или файлы, заполни карточку и создай репозиторий. Код уходит в твой публичный GitHub.';
    }
  }
  const btnLabel = document.getElementById('btn-github-primary-label');
  if (btnLabel) {
    btnLabel.textContent = USER.isGithubConnected ? 'Сменить аккаунт GitHub' : 'Войти через GitHub';
  }
  const primary = document.getElementById('btn-github-primary');
  const done = USER.isGithubConnected && USER.hasGithubPublishToken;
  // Всегда показываем кнопку под вкладкой GitHub: вход или смена аккаунта (не прячем после привязки).
  if (primary) {
    primary.hidden = false;
  }
  const unlinkBtn = document.getElementById('btn-github-unlink');
  if (unlinkBtn) {
    unlinkBtn.hidden = !USER.isGithubConnected;
  }
  const flow = document.getElementById('github-publish-flow');
  if (flow) {
    if (done) flow.removeAttribute('hidden');
    else flow.setAttribute('hidden', '');
  }
  if (done && typeof renderGenrePills === 'function' && document.getElementById('genrePillsGhCode')) {
    if (!window.selectedGenres) window.selectedGenres = {};
    renderGenrePills('genrePillsGhCode', 'ghCode');
  }
}

async function selectMethod(m) {
  if (m === 'github' || m === 'premium') {
    await refreshUploadCapabilities();
  }
  if (m === 'premium') {
    window.selectedUploadMethod = 'premium';
    document.getElementById('method-url')?.classList.remove('selected');
    document.getElementById('method-github')?.classList.remove('selected');
    document.getElementById('form-url')?.classList.remove('visible');
    document.getElementById('form-github')?.classList.remove('visible');
    document.getElementById('form-premium')?.classList.add('visible');
    return;
  }
  window.selectedUploadMethod = m;
  document.getElementById('method-url')?.classList.toggle('selected', m === 'url');
  document.getElementById('method-github')?.classList.toggle('selected', m === 'github');
  document.getElementById('form-url')?.classList.toggle('visible', m === 'url');
  document.getElementById('form-github')?.classList.toggle('visible', m === 'github');
  document.getElementById('form-premium')?.classList.remove('visible');

  if (m === 'url') {
    if (typeof renderGenrePills === 'function' && document.getElementById('genrePills2')) {
      if (!window.selectedGenres) window.selectedGenres = {};
      renderGenrePills('genrePills2', 'url');
    }
  }

  if (m !== 'github' && typeof resetGhCodeWizard === 'function') {
    resetGhCodeWizard();
  }

  if (m === 'github') {
    const connect = document.getElementById('code-branch-connect');
    const done = USER.isGithubConnected && USER.hasGithubPublishToken;
    if (connect) connect.hidden = Boolean(done);
    if (done && typeof githubWizardShowFlow === 'function') githubWizardShowFlow();
    if (done && typeof renderGenrePills === 'function' && document.getElementById('genrePillsGhCode')) {
      if (!window.selectedGenres) window.selectedGenres = {};
      renderGenrePills('genrePillsGhCode', 'ghCode');
    }
  }
}

/** Совместимость: одна форма URL без шагов */
function setUrlUploadStep(_step) {}

function urlFlowNext() {
  const el = document.getElementById('gameNameInput2');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function urlFlowBack() {
  const el = document.getElementById('urlInput');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function githubUnlink() {
  if (typeof hasTelegramInitData === 'function' && !hasTelegramInitData()) {
    showToast('⚠️ Открой мини-апп из Telegram-бота');
    return;
  }
  try {
    await API.githubUnlink();
    await refreshUploadCapabilities();
    if (typeof selectMethod === 'function') await selectMethod('github');
    showToast('✅ GitHub отвязан');
  } catch (e) {
    showToast('⚠️ ' + (e?.message || 'не удалось'));
  }
}

async function authGithub() {
  try {
    const { url } = await API.githubOAuthStart();
    if (!url) {
      showToast('⚠️ GitHub: задай GITHUB_CLIENT_ID и GITHUB_CLIENT_SECRET в Cloudflare → Worker → Variables');
      return;
    }
    try {
      Telegram.WebApp.openLink(url);
    } catch (e) {
      window.location.href = url;
    }
  } catch (err) {
    showToast('⚠️ ' + (err.message || 'не удалось начать вход'));
  }
}

let _githubUploadMode = 'paste';

function resetGithubInlineForm() {
  githubUploadSetMode('paste');
  const ta = document.getElementById('githubPasteHtml');
  if (ta) ta.value = '';
  const fi = document.getElementById('githubMultiFiles');
  if (fi) fi.value = '';
  window._githubStagedFiles = [];
  renderGithubFilesList();
  const res = document.getElementById('githubUploadResult');
  if (res) {
    res.hidden = true;
    res.innerHTML = '';
  }
}

function githubUploadSetMode(mode) {
  _githubUploadMode = mode === 'files' ? 'files' : 'paste';
  document.querySelectorAll('.github-mode-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.mode === _githubUploadMode);
  });
  const pasteP = document.getElementById('github-upload-paste-panel');
  const filesP = document.getElementById('github-upload-files-panel');
  if (pasteP) pasteP.hidden = _githubUploadMode !== 'paste';
  if (filesP) filesP.hidden = _githubUploadMode !== 'files';
}

function onGithubMultiFilesChange(input) {
  const list = Array.from(input?.files || []);
  window._githubStagedFiles = list.slice(0, 20);
  renderGithubFilesList();
}

function renderGithubFilesList() {
  const el = document.getElementById('githubFilesList');
  if (!el) return;
  const arr = window._githubStagedFiles || [];
  if (!arr.length) {
    el.textContent = 'Файлы не выбраны';
    return;
  }
  el.innerHTML = arr.map(f => esc(f.name)).join('<br>');
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || '');
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error);
    r.readAsText(file, 'UTF-8');
  });
}

let _ghWizardStep = 1;

function ghwzFlowRoot() {
  return document.getElementById('github-publish-flow');
}

function ghwzSetStep(n) {
  _ghWizardStep = Math.max(1, Math.min(2, n));
  for (let i = 1; i <= 2; i++) {
    const p = document.getElementById('ghwz-panel-' + i);
    if (p) p.hidden = i !== _ghWizardStep;
    const d = document.getElementById('ghwz-dot-' + i);
    if (d) {
      d.classList.remove('done', 'current');
      if (i < _ghWizardStep) d.classList.add('done');
      if (i === _ghWizardStep) d.classList.add('current');
    }
  }
  const t = document.getElementById('github-publish-heading');
  const sub = document.querySelector('.github-publish-sub');
  if (t) {
    const titles = {
      1: 'Код и карточка',
      2: 'Обложка и модерация',
    };
    t.textContent = titles[_ghWizardStep] || 'GitHub';
  }
  if (sub) sub.hidden = _ghWizardStep !== 1;
}

function githubWizardShowFlow() {
  const flow = ghwzFlowRoot();
  if (flow) flow.hidden = false;
}

function githubWizardStepBack() {
  if (_ghWizardStep <= 1) return;
  ghwzSetStep(_ghWizardStep - 1);
}

async function buildGithubPublishFileList() {
  const files = [];
  if (_githubUploadMode === 'paste') {
    const html = document.getElementById('githubPasteHtml')?.value?.trim() || '';
    if (!validateWizardHtml(html)) return null;
    files.push({ path: 'index.html', content: html });
    return files;
  }
  const arr = window._githubStagedFiles || [];
  if (!arr.length) {
    showToast('⚠️ Выбери файлы');
    return null;
  }
  for (const f of arr) {
    const name = f.name || '';
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      showToast('⚠️ Имена файлов только латиница, цифры, . _ - : ' + name);
      return null;
    }
  }
  let hasIndex = false;
  for (const f of arr) {
    if (f.name.toLowerCase() === 'index.html') hasIndex = true;
    const isText =
      /\.(html?|htm|js|mjs|cjs|css|json|txt|md|svg|xml|webmanifest)$/i.test(f.name) ||
      f.type.startsWith('text/');
    if (isText) {
      const text = await readFileAsText(f);
      files.push({ path: f.name, content: text });
    } else {
      const b64 = await readFileAsBase64(f);
      files.push({ path: f.name, content: b64, contentEncoding: 'base64' });
    }
  }
  if (!hasIndex) {
    showToast('⚠️ Нужен файл index.html в корне');
    return null;
  }
  return files;
}

async function githubWizardPublishRepo() {
  if (typeof hasTelegramInitData === 'function' && !hasTelegramInitData()) {
    showToast('⚠️ Открой мини-апп из Telegram-бота');
    return;
  }
  if (_githubUploadMode === 'paste') {
    const html = document.getElementById('githubPasteHtml')?.value?.trim() || '';
    if (!validateWizardHtml(html)) return;
  } else {
    const arr = window._githubStagedFiles || [];
    if (!arr.length) {
      showToast('⚠️ Выбери файлы');
      return;
    }
    for (const f of arr) {
      const name = f.name || '';
      if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
        showToast('⚠️ Имена файлов только латиница, цифры, . _ - : ' + name);
        return;
      }
    }
    if (!arr.some(x => x.name.toLowerCase() === 'index.html')) {
      showToast('⚠️ Нужен файл index.html в корне');
      return;
    }
  }
  const title = document.getElementById('ghCodeWizardTitle')?.value?.trim() || '';
  if (!title) {
    showToast('⚠️ Укажи название игры');
    return;
  }
  if (!window.selectedGenres) window.selectedGenres = {};
  const genrePick = window.selectedGenres.ghCode;
  if (!genrePick || !String(genrePick).trim()) {
    showToast('⚠️ Выбери жанр');
    return;
  }
  const files = await buildGithubPublishFileList();
  if (!files || files.length === 0) return;

  const gameDescription = document.getElementById('ghCodeWizardDesc')?.value?.trim() || '';
  showToast('🔍 Создаём репозиторий на GitHub…');
  try {
    const out = await API.githubPublishGame({
      files,
      gameTitle: title,
      gameDescription,
    });
    window._ghPublishedPlayUrl = out.pagesUrl || '';
    const inp = document.getElementById('ghCodeWizardPagesUrl');
    if (inp) inp.value = out.pagesUrl || '';
    showToast(
      out?.pagesReady
        ? '✅ Репозиторий создан, страница открывается'
        : '✅ Репозиторий создан — Pages до 1–3 мин'
    );
    ghwzSetStep(2);
    refreshGhPublishReviewBox();
  } catch (e) {
    showToast('⚠️ ' + (e?.message || 'ошибка'));
  }
}

async function githubWizardSubmitModeration() {
  if (typeof hasTelegramInitData === 'function' && !hasTelegramInitData()) {
    showToast('⚠️ Открой мини-апп из Telegram-бота');
    return;
  }
  const playUrl = normalizeToHttpsUrl(
    window._ghPublishedPlayUrl || document.getElementById('ghCodeWizardPagesUrl')?.value?.trim() || ''
  );
  if (!playUrl || !/github\.io/i.test(playUrl)) {
    showToast('⚠️ Сначала создай репозиторий');
    ghwzSetStep(1);
    return;
  }
  const title = document.getElementById('ghCodeWizardTitle')?.value?.trim() || '';
  if (!title) {
    showToast('⚠️ Укажи название');
    ghwzSetStep(1);
    return;
  }
  const desc = document.getElementById('ghCodeWizardDesc')?.value?.trim() || '';
  showToast('🔍 Отправляем на модерацию…');
  try {
    const { imageUrl, error } = await resolveGhCodeWizardCover();
    if (error) return;
    await performGithubPathSubmit({
      playUrl,
      title,
      description: desc,
      imageUrl: imageUrl || null,
    });
    showToast('✅ Игра отправлена на модерацию');
    resetGhCodeWizard();
    if (typeof loadAdminPending === 'function') loadAdminPending();
    if (typeof closeUpload === 'function') closeUpload();
  } catch (e) {
    showToast('⚠️ ' + (e?.message || 'не получилось'));
  }
}

/** Общая отправка карточки игры (pending) по сценарию GitHub */
async function performGithubPathSubmit({ playUrl, title, description, imageUrl }) {
  const u = normalizeToHttpsUrl(String(playUrl || '').trim()) || String(playUrl || '').trim();
  if (!u || !/github\.io/i.test(u)) {
    throw new Error('Некорректная ссылка GitHub Pages');
  }
  const t = String(title || '').trim();
  if (!t) throw new Error('Укажи название игры');
  const genre = window.selectedGenres.ghCode || 'Прочее';
  const genreEmoji = typeof genreKeyForApiLabel === 'function' ? genreKeyForApiLabel(genre) : 'other';
  await API.submit({
    title: t,
    description: String(description || '').trim(),
    genre,
    genreEmoji,
    url: u,
    imageUrl: imageUrl || null,
  });
}

function refreshGhPublishReviewBox() {
  const playUrl = window._ghPublishedPlayUrl || document.getElementById('ghCodeWizardPagesUrl')?.value?.trim() || '';
  const title = document.getElementById('ghCodeWizardTitle')?.value?.trim() || '';
  const desc = document.getElementById('ghCodeWizardDesc')?.value?.trim() || '';
  const genre = window.selectedGenres.ghCode || 'Прочее';
  const gIcon =
    typeof genreIconSvg === 'function' && typeof genreIconKeyFromLabel === 'function'
      ? genreIconSvg(genreIconKeyFromLabel(genre), 'sg-genre-ic--inline')
      : '';
  const coverUrl = document.getElementById('ghCodeWizardCoverUrl')?.value?.trim() || '';
  const hasFile = Boolean(document.getElementById('ghCodeWizardCoverFile')?.files?.[0]);
  const coverLine = coverUrl ? esc(coverUrl) : hasFile ? 'файл (загрузится при отправке)' : 'нет';
  const box = document.getElementById('ghCodeWizardReview');
  if (box) {
    box.innerHTML = `
      <p><strong>Ссылка на игру:</strong> ${esc(playUrl || '')}</p>
      <p><strong>Название:</strong> ${esc(title)}</p>
      <p><strong>Описание:</strong> ${esc(desc || '—')}</p>
      <p class="upload-genre-line"><strong>Жанр:</strong>${gIcon}<span>${esc(genre)}</span></p>
      <p><strong>Обложка:</strong> ${coverLine}</p>
    `;
  }
}

function resetGhCodeWizardFormOnly() {
  window._ghPublishedPlayUrl = '';
  _ghWizardStep = 1;
  const u = document.getElementById('ghCodeWizardPagesUrl');
  if (u) u.value = '';
  const t = document.getElementById('ghCodeWizardTitle');
  if (t) t.value = '';
  const d = document.getElementById('ghCodeWizardDesc');
  if (d) d.value = '';
  const cu = document.getElementById('ghCodeWizardCoverUrl');
  if (cu) cu.value = '';
  const cf = document.getElementById('ghCodeWizardCoverFile');
  if (cf) cf.value = '';
  const prev = document.getElementById('ghCodeWizardCoverPreview');
  if (prev) {
    prev.innerHTML = 'Нет обложки';
    prev.classList.remove('has-image');
  }
  if (!window.selectedGenres) window.selectedGenres = {};
  window.selectedGenres.ghCode = '';
  resetGithubInlineForm();
  ghwzSetStep(1);
  if (typeof renderGenrePills === 'function') {
    renderGenrePills('genrePillsGhCode', 'ghCode');
  }
}

function resetGhCodeWizard() {
  resetGhCodeWizardFormOnly();
  githubWizardDismissUi();
}

function ghCodeWizardCancel() {
  resetGhCodeWizard();
  showToast('Загрузку можно начать снова');
}

async function resolveGhCodeWizardCover() {
  const urlRaw = document.getElementById('ghCodeWizardCoverUrl')?.value?.trim() || '';
  if (urlRaw) {
    const u = normalizeToHttpsUrl(urlRaw);
    if (!u) {
      showToast('⚠️ Некорректная ссылка на обложку');
      return { error: true };
    }
    return { imageUrl: u };
  }
  const file = document.getElementById('ghCodeWizardCoverFile')?.files?.[0];
  if (!file) return { imageUrl: null };
  try {
    const formData = new FormData();
    formData.append('image', file);
    const uploaded = await API.uploadImage(formData);
    return { imageUrl: uploaded?.imageUrl || null };
  } catch (e) {
    if (isStorageUnavailableError(e)) {
      showToast('⚠️ Загрузка файла недоступна — укажи URL обложки или без обложки');
      return { imageUrl: null };
    }
    throw e;
  }
}

function previewGhCodeWizardCover(input) {
  const preview = document.getElementById('ghCodeWizardCoverPreview');
  if (!preview || !input?.files?.[0]) {
    if (preview && !input?.files?.[0]) {
      preview.innerHTML = '<span>Нет обложки</span>';
      preview.classList.remove('has-image');
    }
    return;
  }
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    preview.innerHTML = `<img src="${esc(reader.result)}" alt="">`;
    preview.classList.add('has-image');
  };
  reader.readAsDataURL(file);
}

function isStorageUnavailableError(e) {
  const m = String(e?.message || '').toLowerCase();
  return m.includes('storage') || m.includes('501') || m.includes('not configured');
}

async function resolveCoverImageUrl() {
  const coverUrlRaw = document.getElementById('coverUrlInput')?.value?.trim() || '';
  if (coverUrlRaw) {
    const u = normalizeToHttpsUrl(coverUrlRaw);
    if (!u) {
      showToast('⚠️ Некорректная ссылка на обложку (нужен https или http)');
      return { error: true };
    }
    return { imageUrl: u };
  }

  const coverInput = document.getElementById('gameImageInput');
  const file = coverInput?.files?.[0];
  if (!file) return { imageUrl: null };

  try {
    const formData = new FormData();
    formData.append('image', file);
    const uploaded = await API.uploadImage(formData);
    return { imageUrl: uploaded?.imageUrl || null };
  } catch (e) {
    if (isStorageUnavailableError(e)) {
      showToast('⚠️ Файл недоступен — укажи URL обложки или без неё');
      return { imageUrl: null };
    }
    throw e;
  }
}

function validateWizardHtml(html) {
  const s = String(html || '').trim();
  if (!s) {
    showToast('⚠️ Вставь HTML-код игры');
    return false;
  }
  const low = s.slice(0, 6000).toLowerCase();
  if (!low.includes('<!doctype') && !low.includes('<html')) {
    showToast('⚠️ Нужен полный HTML-документ (с <!DOCTYPE html> или <html>)');
    return false;
  }
  if (s.length > 1_900_000) {
    showToast('⚠️ Файл слишком большой');
    return false;
  }
  return true;
}

async function submitGame(method) {
  const rawUrl = document.getElementById('urlInput').value.trim();
  const name = document.getElementById('gameNameInput2').value.trim();
  const desc = document.getElementById('gameDescInput2').value.trim();
  const genreLabel = selectedGenres.url || 'Прочее';
  const genreEmoji = typeof genreKeyForApiLabel === 'function' ? genreKeyForApiLabel(genreLabel) : 'other';

  if (!rawUrl || !name) { showToast('⚠️ Заполни ссылку и название'); return; }
  if (!selectedGenres.url || !String(selectedGenres.url).trim()) {
    showToast('⚠️ Выбери жанр');
    return;
  }
  const safeUrl = normalizeToHttpsUrl(rawUrl);
  if (!safeUrl) {
    showToast('⚠️ Нужна рабочая ссылка (https://… или http:// — превратим в https)');
    return;
  }

  if (typeof hasTelegramInitData === 'function' && !hasTelegramInitData()) {
    showToast('⚠️ Открой мини-апп из Telegram-бота — иначе сервер не узнает тебя и не примет игру.');
    return;
  }

  showToast('🔍 Отправляем...');
  try {
    const { imageUrl, error } = await resolveCoverImageUrl();
    if (error) return;

    await API.submit({
      title: name,
      description: desc,
      genre: genreLabel,
      genreEmoji: genreEmoji,
      url: safeUrl,
      imageUrl,
    });
    showToast('✅ Отправлено на модерацию!');
    closeUpload();
  } catch (e) {
    const m = e?.message || 'не получилось';
    console.error('submitGame failed', e);
    showToast('⚠️ ' + m);
  }
}

function previewCover(input) {
  const preview = document.getElementById('imagePreview');
  const file = input?.files?.[0];
  if (!preview) return;
  if (!file) {
    preview.innerHTML = '<span>Нет обложки</span>';
    preview.classList.remove('has-image');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    preview.innerHTML = `<img src="${esc(reader.result)}" alt="">`;
    preview.classList.add('has-image');
  };
  reader.readAsDataURL(file);
}

async function uploadShowPremium() {
  if (typeof selectMethod === 'function') await selectMethod('premium');
  document.getElementById('form-premium')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.githubWizardStepBack = githubWizardStepBack;
window.githubWizardPublishRepo = githubWizardPublishRepo;
window.githubWizardSubmitModeration = githubWizardSubmitModeration;
window.selectMethod = selectMethod;
window.refreshUploadCapabilities = refreshUploadCapabilities;
window.authGithub = authGithub;
window.submitGame = submitGame;
window.previewCover = previewCover;
window.githubUnlink = githubUnlink;
window.githubUploadSetMode = githubUploadSetMode;
window.resetGhCodeWizard = resetGhCodeWizard;
window.ghCodeWizardCancel = ghCodeWizardCancel;
window.previewGhCodeWizardCover = previewGhCodeWizardCover;
window.setUrlUploadStep = setUrlUploadStep;
window.urlFlowNext = urlFlowNext;
window.urlFlowBack = urlFlowBack;
window.refreshGhPublishReviewBox = refreshGhPublishReviewBox;
window.uploadShowPremium = uploadShowPremium;

document.addEventListener('change', (ev) => {
  if (ev.target?.id === 'gameImageInput') previewCover(ev.target);
  if (ev.target?.id === 'ghCodeWizardCoverFile') previewGhCodeWizardCover(ev.target);
  if (ev.target?.id === 'githubMultiFiles') onGithubMultiFilesChange(ev.target);
});

document.getElementById('upload-screen')?.addEventListener('click', ev => {
  if (ev.target.closest('#genrePillsGhCode .genre-pill') && typeof refreshGhPublishReviewBox === 'function') {
    setTimeout(() => refreshGhPublishReviewBox(), 0);
  }
});

/** После OAuth в браузере возврат в мини-апп — подтянуть /api/me и обновить вкладку GitHub. */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  try {
    if (!document.getElementById('upload-screen')?.classList.contains('open')) return;
  } catch (e) {
    return;
  }
  if (typeof refreshUploadCapabilities !== 'function') return;
  refreshUploadCapabilities().then(() => {
    const m = window.selectedUploadMethod;
    if (m === 'github' && typeof selectMethod === 'function') selectMethod('github');
  });
});
