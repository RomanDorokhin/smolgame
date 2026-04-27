function selectMethod(m) {
  window.selectedUploadMethod = m;
  document.getElementById('method-code').classList.toggle('selected', m === 'code');
  document.getElementById('method-url').classList.toggle('selected', m === 'url');
  document.getElementById('form-code').classList.toggle('visible', m === 'code');
  document.getElementById('form-url').classList.toggle('visible', m === 'url');
}

async function authGithub() {
  try {
    const { url } = await API.githubOAuthStart();
    if (!url) {
      showToast('⚠️ GitHub OAuth не настроен');
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

async function submitGame(method) {
  if (method === 'code') {
    showToast('⚠️ Загрузка по ссылке — вкладка «Ссылка» справа. «Вставить код» пока не отправляется.');
    if (typeof selectMethod === 'function') selectMethod('url');
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
    showToast('⚠️ ' + (e.message || 'не получилось'));
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

document.addEventListener('change', (ev) => {
  if (ev.target?.id === 'gameImageInput') previewCover(ev.target);
});
