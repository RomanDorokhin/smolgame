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

function updateGithubUploadUi() {
  const premCard = document.getElementById('method-premium');
  if (premCard) {
    premCard.hidden = !USER.isPremium;
  }
  const hint = document.getElementById('github-connect-hint');
  if (hint) {
    if (!USER.isGithubConnected) {
      hint.textContent = 'Привяжи GitHub — ниже появится поле для кода или файлов.';
    } else if (!USER.hasGithubPublishToken) {
      hint.textContent =
        'Токен не сохранён: проверь миграцию D1 (github_access_token_enc) и снова нажми «Войти через GitHub».';
    } else {
      hint.textContent = 'Готово — вставь HTML или выбери файлы и отправь на GitHub.';
    }
  }
  const btnLabel = document.getElementById('btn-github-primary-label');
  if (btnLabel) {
    btnLabel.textContent = USER.isGithubConnected ? 'Сменить аккаунт GitHub' : 'Войти через GitHub';
  }
  const primary = document.getElementById('btn-github-primary');
  const done = USER.isGithubConnected && USER.hasGithubPublishToken;
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
  if (m === 'premium' && !USER.isPremium) {
    showToast('⚠️ Вкладка «Премиум» только для премиум-аккаунта');
    m = 'url';
  }
  window.selectedUploadMethod = m;
  document.getElementById('method-url')?.classList.toggle('selected', m === 'url');
  document.getElementById('method-github')?.classList.toggle('selected', m === 'github');
  document.getElementById('method-premium')?.classList.toggle('selected', m === 'premium');
  document.getElementById('form-url')?.classList.toggle('visible', m === 'url');
  document.getElementById('form-github')?.classList.toggle('visible', m === 'github');
  document.getElementById('form-premium')?.classList.toggle('visible', m === 'premium');

  if (m === 'github') {
    const connect = document.getElementById('code-branch-connect');
    const gh = document.getElementById('code-branch-github');
    const done = USER.isGithubConnected && USER.hasGithubPublishToken;
    if (connect) connect.hidden = Boolean(done);
    if (gh) gh.hidden = !done;
    if (done && typeof resetGhCodeWizard === 'function') resetGhCodeWizard();
  }
  if (m === 'premium' && USER.isPremium && typeof resetCodeWizard === 'function') {
    resetCodeWizard();
    if (typeof renderGenrePills === 'function') renderGenrePills('genrePillsCodeOnly', 'codeOnly');
  }
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
    const out = await API.githubPublishGame({ files });
    showToast(out?.pagesReady ? '✅ GitHub Pages отвечает' : '✅ Репозиторий создан, Pages могут подняться через минуту');
    window._ghPublishedPlayUrl = out.pagesUrl || '';
    resetGithubInlineForm();
    if (typeof selectMethod === 'function') await selectMethod('github');
    if (!USER.isPremium) beginGhCodeWizardAfterPublish(out);
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
  const url = apiOut?.pagesUrl || window._ghPublishedPlayUrl || '';
  const inp = document.getElementById('ghCodeWizardPagesUrl');
  if (inp) inp.value = url;
  const hint = document.getElementById('gh-code-wizard-step1-hint');
  if (hint) {
    const ready = apiOut?.pagesReady;
    hint.innerHTML = ready
      ? 'Шаг 1 из 5 — <strong>страница открывается</strong>. Дальше — название и описание.'
      : 'Шаг 1 из 5 — репозиторий создан. Pages иногда открываются с задержкой; ссылку можно проверить позже.';
  }
  setGhCodeWizardStep(1);
}

function setGhCodeWizardStep(n) {
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('gh-code-wizard-step' + i);
    if (el) el.hidden = i !== n;
  }
  window._ghCodeWizardStep = n;
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
  if (typeof renderGenrePills === 'function') {
    renderGenrePills('genrePillsGhCode', 'ghCode');
  }
  setGhCodeWizardStep(1);
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
  const step = window._ghCodeWizardStep || 1;
  if (step === 1) {
    const playUrl = document.getElementById('ghCodeWizardPagesUrl')?.value?.trim() || '';
    const u = normalizeToHttpsUrl(playUrl);
    if (!u || !/github\.io/i.test(u)) {
      showToast('⚠️ Сначала отправь код на GitHub (форма выше)');
      return;
    }
    window._ghPublishedPlayUrl = u;
    setGhCodeWizardStep(2);
    return;
  }
  if (step === 2) {
    const title = document.getElementById('ghCodeWizardTitle')?.value?.trim() || '';
    if (!title) {
      showToast('⚠️ Укажи название игры');
      return;
    }
    setGhCodeWizardStep(3);
    return;
  }
  if (step === 3) {
    setGhCodeWizardStep(4);
    if (typeof renderGenrePills === 'function') {
      renderGenrePills('genrePillsGhCode', 'ghCode');
    }
    return;
  }
  if (step === 4) {
    setGhCodeWizardStep(5);
    const playUrl = window._ghPublishedPlayUrl || document.getElementById('ghCodeWizardPagesUrl')?.value?.trim() || '';
    const title = document.getElementById('ghCodeWizardTitle')?.value?.trim() || '';
    const desc = document.getElementById('ghCodeWizardDesc')?.value?.trim() || '';
    const genre = window.selectedGenres.ghCode || 'Прочее';
    const emoji = (GENRES.find(x => x.label === genre)?.emoji) || '🎮';
    const coverUrl = document.getElementById('ghCodeWizardCoverUrl')?.value?.trim() || '';
    const hasFile = Boolean(document.getElementById('ghCodeWizardCoverFile')?.files?.[0]);
    const coverLine = coverUrl ? esc(coverUrl) : hasFile ? 'файл (загрузится при отправке)' : 'нет';
    const box = document.getElementById('ghCodeWizardReview');
    if (box) {
      box.innerHTML = `
        <p><strong>Ссылка на игру:</strong> ${esc(playUrl)}</p>
        <p><strong>Название:</strong> ${esc(title)}</p>
        <p><strong>Описание:</strong> ${esc(desc || '—')}</p>
        <p><strong>Жанр:</strong> ${esc(emoji + ' ' + genre)}</p>
        <p><strong>Обложка:</strong> ${coverLine}</p>
      `;
    }
  }
}

function ghCodeWizardBack() {
  const step = window._ghCodeWizardStep || 1;
  if (step <= 1) return;
  setGhCodeWizardStep(step - 1);
}

function ghCodeWizardCancel() {
  resetGhCodeWizard();
  if (typeof selectMethod === 'function') selectMethod('url');
  showToast('Черновик сброшен');
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
    showToast('⚠️ Нет ссылки GitHub Pages');
    setGhCodeWizardStep(1);
    return;
  }
  const title = document.getElementById('ghCodeWizardTitle')?.value?.trim() || '';
  if (!title) {
    showToast('⚠️ Укажи название');
    setGhCodeWizardStep(2);
    return;
  }
  const desc = document.getElementById('ghCodeWizardDesc')?.value?.trim() || '';
  const genre = window.selectedGenres.ghCode || 'Прочее';
  const genreEmoji = (GENRES.find(x => x.label === genre)?.emoji) || '🎮';

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

/** Обложка для мастера «вставить код» */
async function resolveCodeWizardCover() {
  const urlRaw = document.getElementById('codeWizardCoverUrl')?.value?.trim() || '';
  if (urlRaw) {
    const u = normalizeToHttpsUrl(urlRaw);
    if (!u) {
      showToast('⚠️ Некорректная ссылка на обложку');
      return { error: true };
    }
    return { imageUrl: u };
  }
  const file = document.getElementById('codeWizardCoverFile')?.files?.[0];
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

function setCodeWizardStep(n) {
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('code-wizard-step' + i);
    if (el) el.hidden = i !== n;
  }
  window._codeWizardStep = n;
}

function resetCodeWizard() {
  const ta = document.getElementById('codeInputWizard');
  if (ta) ta.value = '';
  const t = document.getElementById('codeWizardTitle');
  if (t) t.value = '';
  const d = document.getElementById('codeWizardDesc');
  if (d) d.value = '';
  const cu = document.getElementById('codeWizardCoverUrl');
  if (cu) cu.value = '';
  const cf = document.getElementById('codeWizardCoverFile');
  if (cf) cf.value = '';
  const prev = document.getElementById('codeWizardCoverPreview');
  if (prev) {
    prev.innerHTML = 'Обложка не выбрана';
    prev.classList.remove('has-image');
  }
  window.selectedGenres.codeOnly = '';
  if (typeof renderGenrePills === 'function') {
    renderGenrePills('genrePillsCodeOnly', 'codeOnly');
  }
  setCodeWizardStep(1);
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

function codeWizardNext() {
  const step = window._codeWizardStep || 1;
  if (step === 1) {
    const html = document.getElementById('codeInputWizard')?.value || '';
    if (!validateWizardHtml(html)) return;
    setCodeWizardStep(2);
    return;
  }
  if (step === 2) {
    const title = document.getElementById('codeWizardTitle')?.value?.trim() || '';
    if (!title) {
      showToast('⚠️ Укажи название игры');
      return;
    }
    setCodeWizardStep(3);
    return;
  }
  if (step === 3) {
    setCodeWizardStep(4);
    if (typeof renderGenrePills === 'function') {
      renderGenrePills('genrePillsCodeOnly', 'codeOnly');
    }
    return;
  }
  if (step === 4) {
    setCodeWizardStep(5);
    const html = document.getElementById('codeInputWizard')?.value?.trim() || '';
    const title = document.getElementById('codeWizardTitle')?.value?.trim() || '';
    const desc = document.getElementById('codeWizardDesc')?.value?.trim() || '';
    const genre = window.selectedGenres.codeOnly || 'Прочее';
    const emoji = (GENRES.find(x => x.label === genre)?.emoji) || '🎮';
    const coverUrl = document.getElementById('codeWizardCoverUrl')?.value?.trim() || '';
    const hasFile = Boolean(document.getElementById('codeWizardCoverFile')?.files?.[0]);
    const coverLine = coverUrl
      ? esc(coverUrl)
      : hasFile
        ? 'файл (загрузится при отправке)'
        : 'нет';
    const box = document.getElementById('codeWizardReview');
    if (box) {
      box.innerHTML = `
        <p><strong>Название:</strong> ${esc(title)}</p>
        <p><strong>Описание:</strong> ${esc(desc || '—')}</p>
        <p><strong>Жанр:</strong> ${esc(emoji + ' ' + genre)}</p>
        <p><strong>Обложка:</strong> ${coverLine}</p>
        <p><strong>Код:</strong> ${esc(String(html.length))} символов</p>
      `;
    }
    return;
  }
}

function codeWizardBack() {
  const step = window._codeWizardStep || 1;
  if (step <= 1) return;
  setCodeWizardStep(step - 1);
}

function codeWizardCancel() {
  resetCodeWizard();
  if (typeof selectMethod === 'function') selectMethod('url');
  showToast('Черновик сброшен');
}

async function codeWizardPublish() {
  await refreshUploadCapabilities();
  if (!USER.isPremium) {
    showToast('⚠️ Хостинг кода на SmolGame только для премиум. Используй вкладку «Ссылка».');
    resetCodeWizard();
    selectMethod('url');
    return;
  }
  if (typeof hasTelegramInitData === 'function' && !hasTelegramInitData()) {
    showToast('⚠️ Открой мини-апп из Telegram-бота');
    return;
  }
  const html = document.getElementById('codeInputWizard')?.value?.trim() || '';
  if (!validateWizardHtml(html)) {
    setCodeWizardStep(1);
    return;
  }
  const title = document.getElementById('codeWizardTitle')?.value?.trim() || '';
  if (!title) {
    showToast('⚠️ Укажи название');
    setCodeWizardStep(2);
    return;
  }
  const desc = document.getElementById('codeWizardDesc')?.value?.trim() || '';
  const genre = window.selectedGenres.codeOnly || 'Прочее';
  const genreEmoji = (GENRES.find(x => x.label === genre)?.emoji) || '🎮';

  showToast('🔍 Отправляем…');
  try {
    const { imageUrl, error } = await resolveCodeWizardCover();
    if (error) return;

    await API.submitHtmlGame({
      html,
      title,
      description: desc,
      genre,
      genreEmoji,
      imageUrl: imageUrl || null,
    });
    showToast('✅ Отправлено на модерацию!');
    resetCodeWizard();
    if (typeof closeUpload === 'function') closeUpload();
  } catch (e) {
    const m = e?.message || 'не получилось';
    console.error('submitHtmlGame failed', e);
    showToast('⚠️ ' + m);
  }
}

function previewCodeWizardCover(input) {
  const preview = document.getElementById('codeWizardCoverPreview');
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

async function submitGame(method) {
  if (method === 'premium') {
    await refreshUploadCapabilities();
    if (!USER.isPremium) {
      showToast('⚠️ Только для премиум');
      return;
    }
    if (typeof codeWizardNext === 'function') codeWizardNext();
    return;
  }

  const rawUrl = document.getElementById('urlInput').value.trim();
  const name = document.getElementById('gameNameInput2').value.trim();
  const desc = document.getElementById('gameDescInput2').value.trim();
  const genreLabel = selectedGenres.url || 'Прочее';
  const genreEmoji = (GENRES.find(x => x.label === genreLabel)?.emoji) || '🎮';

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
window.resetCodeWizard = resetCodeWizard;
window.codeWizardNext = codeWizardNext;
window.codeWizardBack = codeWizardBack;
window.codeWizardCancel = codeWizardCancel;
window.codeWizardPublish = codeWizardPublish;
window.githubUnlink = githubUnlink;
window.githubUploadSetMode = githubUploadSetMode;
window.githubUploadSubmit = githubUploadSubmit;
window.resetGhCodeWizard = resetGhCodeWizard;
window.ghCodeWizardNext = ghCodeWizardNext;
window.ghCodeWizardBack = ghCodeWizardBack;
window.ghCodeWizardCancel = ghCodeWizardCancel;
window.ghCodeWizardPublish = ghCodeWizardPublish;
window.previewGhCodeWizardCover = previewGhCodeWizardCover;

document.addEventListener('change', (ev) => {
  if (ev.target?.id === 'gameImageInput') previewCover(ev.target);
  if (ev.target?.id === 'codeWizardCoverFile') previewCodeWizardCover(ev.target);
  if (ev.target?.id === 'ghCodeWizardCoverFile') previewGhCodeWizardCover(ev.target);
  if (ev.target?.id === 'githubMultiFiles') onGithubMultiFilesChange(ev.target);
});
