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
  const premCard = document.getElementById('method-premium');
  const premDesc = document.getElementById('method-premium-desc');
  if (!premCard) return;
  const locked = !USER.isPremium;
  premCard.classList.toggle('method-card--premium-locked', locked);
  premCard.setAttribute('aria-disabled', 'false');
  if (premDesc) {
    premDesc.textContent = locked ? 'Смотри раздел' : 'Подписка';
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
      hint.textContent =
        'Привяжи GitHub — ниже появится поле для кода или файлов. Каждый вход с этого Telegram — отдельное подтверждение в GitHub (даже если тот же аккаунт GitHub).';
    } else if (!USER.hasGithubPublishToken) {
      hint.textContent =
        'Токен не сохранён: проверь миграцию D1 (github_access_token_enc) и снова нажми «Войти через GitHub».';
    } else {
      hint.textContent =
        'Готово — код или файлы, название, описание, затем «Создать репозиторий на GitHub». Код уходит в GitHub, не на сервер SmolGame. Карточка «Премиум» — отдельный раздел, не репозиторий.';
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
  const inline = document.getElementById('github-inline-upload');
  if (inline) {
    if (done) inline.removeAttribute('hidden');
    else inline.setAttribute('hidden', '');
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
    document.getElementById('method-premium')?.classList.add('selected');
    document.getElementById('form-url')?.classList.remove('visible');
    document.getElementById('form-github')?.classList.remove('visible');
    document.getElementById('form-premium')?.classList.add('visible');
    return;
  }
  window.selectedUploadMethod = m;
  document.getElementById('method-url')?.classList.toggle('selected', m === 'url');
  document.getElementById('method-github')?.classList.toggle('selected', m === 'github');
  document.getElementById('method-premium')?.classList.remove('selected');
  document.getElementById('form-url')?.classList.toggle('visible', m === 'url');
  document.getElementById('form-github')?.classList.toggle('visible', m === 'github');
  document.getElementById('form-premium')?.classList.remove('visible');

  if (m === 'url' && typeof setUrlUploadStep === 'function') setUrlUploadStep(1);

  if (m !== 'github' && typeof resetGhCodeWizard === 'function') {
    resetGhCodeWizard();
    const done = USER.isGithubConnected && USER.hasGithubPublishToken;
    document.getElementById('github-inline-upload')?.toggleAttribute('hidden', !done);
  }

  if (m === 'github') {
    const connect = document.getElementById('code-branch-connect');
    const gh = document.getElementById('code-branch-github');
    const inline = document.getElementById('github-inline-upload');
    const post = document.getElementById('gh-after-publish-panel');
    const done = USER.isGithubConnected && USER.hasGithubPublishToken;
    if (connect) connect.hidden = Boolean(done);
    if (inline) inline.hidden = !done;
    const postOpen = Boolean(post && !post.hasAttribute('hidden'));
    if (gh) gh.hidden = !postOpen;
  }
}

function setUrlUploadStep(step) {
  const link = document.getElementById('url-step-link');
  const meta = document.getElementById('url-step-meta');
  const ind = document.getElementById('url-step-indicator');
  if (step === 2) {
    link?.setAttribute('hidden', '');
    meta?.removeAttribute('hidden');
    if (ind) ind.textContent = 'Шаг 2 из 2';
  } else {
    meta?.setAttribute('hidden', '');
    link?.removeAttribute('hidden');
    if (ind) ind.textContent = 'Шаг 1 из 2';
  }
  window._urlUploadStep = step;
}

function urlFlowNext() {
  const rawUrl = document.getElementById('urlInput')?.value?.trim() || '';
  if (!rawUrl) {
    showToast('⚠️ Вставь ссылку на игру');
    return;
  }
  const safeUrl = normalizeToHttpsUrl(rawUrl);
  if (!safeUrl) {
    showToast('⚠️ Нужна рабочая ссылка (https://… или http://)');
    return;
  }
  setUrlUploadStep(2);
  if (typeof renderGenrePills === 'function') renderGenrePills('genrePills2', 'url');
}

function urlFlowBack() {
  setUrlUploadStep(1);
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

async function githubUploadSubmit() {
  if (typeof hasTelegramInitData === 'function' && !hasTelegramInitData()) {
    showToast('⚠️ Открой мини-апп из Telegram-бота');
    return;
  }
  const gameTitle = document.getElementById('ghCodeWizardTitle')?.value?.trim() || '';
  if (!gameTitle) {
    showToast('⚠️ Сначала укажи название игры');
    return;
  }
  const gameDescription = document.getElementById('ghCodeWizardDesc')?.value?.trim() || '';

  const files = [];
  if (_githubUploadMode === 'paste') {
    const html = document.getElementById('githubPasteHtml')?.value?.trim() || '';
    if (!validateWizardHtml(html)) return;
    files.push({ path: 'index.html', content: html });
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
    let hasIndex = false;
    for (const f of arr) {
      const lower = f.name.toLowerCase();
      if (lower === 'index.html') hasIndex = true;
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
      return;
    }
  }

  showToast('🔍 Создаём репозиторий на GitHub…');
  const resBox = document.getElementById('githubUploadResult');
  try {
    const out = await API.githubPublishGame({
      files,
      gameTitle,
      gameDescription,
    });
    showToast(out?.pagesReady ? '✅ GitHub Pages отвечает' : '✅ Репозиторий создан, Pages могут подняться через минуту');
    window._ghPublishedPlayUrl = out.pagesUrl || '';
    resetGithubInlineForm();
    if (typeof selectMethod === 'function') await selectMethod('github');
    beginGhCodeWizardAfterPublish(out);
  } catch (e) {
    const msg = e?.message || 'ошибка';
    if (resBox) {
      resBox.hidden = false;
      resBox.innerHTML = `<p>⚠️ ${esc(msg)}</p>`;
    }
    showToast('⚠️ ' + msg);
  }
}

function beginGhCodeWizardAfterPublish(apiOut) {
  const urlRaw = apiOut?.pagesUrl || window._ghPublishedPlayUrl || '';
  const inp = document.getElementById('ghCodeWizardPagesUrl');
  if (inp) inp.value = urlRaw || '';
  window._ghPublishedPlayUrl = normalizeToHttpsUrl(urlRaw) || urlRaw || '';
  document.getElementById('github-inline-upload')?.setAttribute('hidden', '');
  document.getElementById('code-branch-github')?.removeAttribute('hidden');
  document.getElementById('gh-after-publish-panel')?.removeAttribute('hidden');
  if (typeof renderGenrePills === 'function') renderGenrePills('genrePillsGhCode', 'ghCode');
  refreshGhPublishReviewBox();
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

function resetGhCodeWizard() {
  window._ghPublishedPlayUrl = '';
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
    prev.innerHTML = 'Обложка не выбрана';
    prev.classList.remove('has-image');
  }
  window.selectedGenres.ghCode = '';
  document.getElementById('gh-after-publish-panel')?.setAttribute('hidden', '');
  document.getElementById('code-branch-github')?.setAttribute('hidden', '');
  if (typeof renderGenrePills === 'function') {
    renderGenrePills('genrePillsGhCode', 'ghCode');
  }
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

function ghCodeWizardNext() {
  refreshGhPublishReviewBox();
}

function ghCodeWizardBack() {
  refreshGhPublishReviewBox();
}

function ghCodeWizardCancel() {
  resetGhCodeWizard();
  if (typeof selectMethod === 'function') selectMethod('github');
  const done = USER.isGithubConnected && USER.hasGithubPublishToken;
  document.getElementById('github-inline-upload')?.toggleAttribute('hidden', !done);
  showToast('Можно изменить код и отправить снова');
}

async function ghCodeWizardPublish() {
  if (typeof hasTelegramInitData === 'function' && !hasTelegramInitData()) {
    showToast('⚠️ Открой мини-апп из Telegram-бота');
    return;
  }
  const playUrl = normalizeToHttpsUrl(
    window._ghPublishedPlayUrl || document.getElementById('ghCodeWizardPagesUrl')?.value?.trim() || ''
  );
  if (!playUrl || !/github\.io/i.test(playUrl)) {
    showToast('⚠️ Нет ссылки игры — сначала отправь код на GitHub выше.');
    if (typeof selectMethod === 'function') selectMethod('github');
    return;
  }
  const title = document.getElementById('ghCodeWizardTitle')?.value?.trim() || '';
  if (!title) {
    showToast('⚠️ Укажи название в форме выше');
    document.getElementById('ghCodeWizardTitle')?.focus?.();
    return;
  }
  const desc = document.getElementById('ghCodeWizardDesc')?.value?.trim() || '';
  const genre = window.selectedGenres.ghCode || 'Прочее';
  const genreEmoji = typeof genreKeyForApiLabel === 'function' ? genreKeyForApiLabel(genre) : 'other';

  showToast('🔍 Отправляем…');
  try {
    const { imageUrl, error } = await resolveGhCodeWizardCover();
    if (error) return;

    await API.submit({
      title,
      description: desc,
      genre,
      genreEmoji,
      url: playUrl,
      imageUrl: imageUrl || null,
    });
    showToast('✅ Отправлено на модерацию!');
    resetGhCodeWizard();
    if (typeof closeUpload === 'function') closeUpload();
  } catch (e) {
    const m = e?.message || 'не получилось';
    console.error('ghCodeWizardPublish failed', e);
    showToast('⚠️ ' + m);
  }
}

function previewGhCodeWizardCover(input) {
  const preview = document.getElementById('ghCodeWizardCoverPreview');
  if (!preview || !input?.files?.[0]) {
    if (preview && !input?.files?.[0]) {
      preview.innerHTML = '<span>Обложка не выбрана</span>';
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
  const metaHidden = document.getElementById('url-step-meta')?.hasAttribute('hidden');
  if (metaHidden !== false) {
    showToast('⚠️ Сначала нажми «Дальше» и заполни название и жанр');
    return;
  }

  const rawUrl = document.getElementById('urlInput').value.trim();
  const name = document.getElementById('gameNameInput2').value.trim();
  const desc = document.getElementById('gameDescInput2').value.trim();
  const genreLabel = selectedGenres.url || 'Прочее';
  const genreEmoji = typeof genreKeyForApiLabel === 'function' ? genreKeyForApiLabel(genreLabel) : 'other';

  if (!rawUrl || !name) { showToast('⚠️ Заполни ссылку и название'); return; }
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
    preview.innerHTML = '<span>Обложка не выбрана</span>';
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

window.selectMethod = selectMethod;
window.refreshUploadCapabilities = refreshUploadCapabilities;
window.authGithub = authGithub;
window.submitGame = submitGame;
window.previewCover = previewCover;
window.githubUnlink = githubUnlink;
window.githubUploadSetMode = githubUploadSetMode;
window.githubUploadSubmit = githubUploadSubmit;
window.resetGhCodeWizard = resetGhCodeWizard;
window.ghCodeWizardNext = ghCodeWizardNext;
window.ghCodeWizardBack = ghCodeWizardBack;
window.ghCodeWizardCancel = ghCodeWizardCancel;
window.ghCodeWizardPublish = ghCodeWizardPublish;
window.previewGhCodeWizardCover = previewGhCodeWizardCover;
window.setUrlUploadStep = setUrlUploadStep;
window.urlFlowNext = urlFlowNext;
window.urlFlowBack = urlFlowBack;
window.refreshGhPublishReviewBox = refreshGhPublishReviewBox;

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
