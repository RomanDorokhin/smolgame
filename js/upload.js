function selectMethod(m) {
  window.selectedUploadMethod = m;
  document.getElementById('method-code').classList.toggle('selected', m === 'code');
  document.getElementById('method-url').classList.toggle('selected', m === 'url');
  document.getElementById('form-code').classList.toggle('visible', m === 'code');
  document.getElementById('form-url').classList.toggle('visible', m === 'url');
  if (m === 'code' && typeof resetCodeWizard === 'function') resetCodeWizard();
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
  if (method === 'code') {
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
window.authGithub = authGithub;
window.submitGame = submitGame;
window.previewCover = previewCover;
window.resetCodeWizard = resetCodeWizard;
window.codeWizardNext = codeWizardNext;
window.codeWizardBack = codeWizardBack;
window.codeWizardCancel = codeWizardCancel;
window.codeWizardPublish = codeWizardPublish;

document.addEventListener('change', (ev) => {
  if (ev.target?.id === 'gameImageInput') previewCover(ev.target);
  if (ev.target?.id === 'codeWizardCoverFile') previewCodeWizardCover(ev.target);
});
