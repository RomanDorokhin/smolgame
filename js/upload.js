function selectMethod(m) {
  window.selectedUploadMethod = m;
  document.getElementById('method-code').classList.toggle('selected', m === 'code');
  document.getElementById('method-url').classList.toggle('selected', m === 'url');
  document.getElementById('form-code').classList.toggle('visible', m === 'code');
  document.getElementById('form-url').classList.toggle('visible', m === 'url');
}

function authGithub() {
  // TODO: OAuth redirect
  // window.location.href = 'https://api.smolgame.io/auth/github?user_id=' + USER.id;
  showToast('GitHub OAuth — подключается');
  USER.isGithubConnected = true;
  USER.githubUsername = 'your-github';
  document.getElementById('devBadge').style.display = '';
}

async function submitGame(method) {
  if (method === 'code') {
    // В текущей итерации принимаем только готовые URL. Деплой кода
    // появится позже (отдельная итерация — GitHub App + деплой репозитория).
    showToast('⏳ Пока шли ссылку. Код приму позже.');
    return;
  }

  const rawUrl = document.getElementById('urlInput').value.trim();
  const name = document.getElementById('gameNameInput2').value.trim();
  const desc = document.getElementById('gameDescInput2').value.trim();
  const genreLabel = selectedGenres.url || 'Прочее';
  const genreEmoji = (GENRES.find(x => x.label === genreLabel)?.emoji) || '🎮';

  if (!rawUrl || !name) { showToast('⚠️ Заполни ссылку и название'); return; }
  const safeUrl = safeHttpUrl(rawUrl);
  if (!safeUrl || !safeUrl.startsWith('https://')) {
    showToast('⚠️ Нужна корректная HTTPS-ссылка');
    return;
  }

  showToast('🔍 Отправляем...');
  try {
    const coverInput = document.getElementById('gameImageInput');
    let imageUrl = null;
    if (coverInput?.files?.[0]) {
      const formData = new FormData();
      formData.append('image', coverInput.files[0]);
      const uploaded = await API.uploadImage(formData);
      imageUrl = uploaded?.imageUrl || null;
    }

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
