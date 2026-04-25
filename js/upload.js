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
    const name = document.getElementById('gameNameInput').value.trim();
    const code = document.getElementById('codeInput').value.trim();
    if (!name || !code) { showToast('⚠️ Заполни название и код'); return; }
    if (!USER.isGithubConnected) { showToast('⚠️ Сначала войди через GitHub'); return; }

    showToast('🚀 Публикуем...');
    // TODO: POST /api/games/deploy — бэкенд создаёт реп, пушит index.html,
    // включает GitHub Pages, сохраняет URL и возвращает { gameId, url }.
    setTimeout(() => {
      showToast('✅ Игра отправлена на модерацию!');
      closeUpload();
    }, 1500);

  } else {
    const rawUrl = document.getElementById('urlInput').value.trim();
    const name = document.getElementById('gameNameInput2').value.trim();
    if (!rawUrl || !name) { showToast('⚠️ Заполни ссылку и название'); return; }
    const safeUrl = safeHttpUrl(rawUrl);
    if (!safeUrl || !safeUrl.startsWith('https://')) {
      showToast('⚠️ Нужна корректная HTTPS-ссылка');
      return;
    }

    showToast('🔍 Проверяем ссылку...');
    // TODO: POST /api/games/submit — бэкенд проверяет URL и кладёт в очередь модерации.
    setTimeout(() => {
      showToast('✅ Отправлено на модерацию!');
      closeUpload();
    }, 1500);
  }
}

window.selectMethod = selectMethod;
window.authGithub = authGithub;
window.submitGame = submitGame;
