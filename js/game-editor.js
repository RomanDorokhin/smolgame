/** Редактирование карточки своей игры: PATCH → pending; синхронизация ленты и поиска. */

window.gameEditorState = {
  gameId: null,
  originalImageUrl: null,
  coverFile: null,
  clearCover: false,
};

function gameEditorPanel() {
  return document.getElementById('game-editor-panel');
}

function uploadDefaultSections() {
  return document.querySelectorAll(
    '#upload-welcome-block, #form-github, #form-url, #form-premium, #upload-guide-block'
  );
}

function setUploadEditorMode(on) {
  const panel = gameEditorPanel();
  const methods = document.getElementById('upload-methods-anchor');
  const title = document.getElementById('uploadScreenTitle');
  if (panel) panel.hidden = !on;
  if (methods) methods.hidden = on;
  if (title) title.textContent = on ? 'Редактировать игру' : 'Загрузить игру';
  uploadDefaultSections().forEach(el => {
    if (!el) return;
    if (on) el.setAttribute('hidden', '');
    else el.removeAttribute('hidden');
  });
}

function resetGameEditorForm() {
  window.gameEditorState = {
    gameId: null,
    originalImageUrl: null,
    coverFile: null,
    clearCover: false,
  };
  const f = document.getElementById('gameEditorCoverFile');
  if (f) f.value = '';
}

function previewGameEditorCover(input) {
  const preview = document.getElementById('gameEditorCoverPreview');
  const file = input?.files?.[0];
  if (!preview) return;
  window.gameEditorState.coverFile = file || null;
  window.gameEditorState.clearCover = false;
  if (!file) {
    const cur = window.gameEditorState.originalImageUrl;
    if (cur) {
      preview.innerHTML = `<img src="${esc(cur)}" alt="">`;
      preview.classList.add('has-image');
    } else {
      preview.innerHTML = '<span>Без обложки</span>';
      preview.classList.remove('has-image');
    }
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    preview.innerHTML = `<img src="${esc(reader.result)}" alt="">`;
    preview.classList.add('has-image');
  };
  reader.readAsDataURL(file);
}

function gameEditorClearCover() {
  window.gameEditorState.coverFile = null;
  window.gameEditorState.clearCover = true;
  const input = document.getElementById('gameEditorCoverFile');
  if (input) input.value = '';
  const preview = document.getElementById('gameEditorCoverPreview');
  if (preview) {
    preview.innerHTML = '<span>Без обложки</span>';
    preview.classList.remove('has-image');
  }
}

async function openGameEditor(gameId) {
  if (!gameId) return;
  let g = (window.GAMES || []).find(x => x.id === gameId);
  if (!g) {
    try {
      const data = await API.game(gameId);
      g = data?.game;
    } catch (e) {
      showToast('⚠️ ' + (e?.message || 'не удалось загрузить игру'));
      return;
    }
  }
  if (!g) {
    showToast('⚠️ Игра не найдена');
    return;
  }
  if (!USER?.id || g.authorId !== USER.id) {
    showToast('⚠️ Редактировать можно только свои игры');
    return;
  }
  if (g.status === 'rejected') {
    showToast('⚠️ Отклонённые игры не редактируются — загрузи новую');
    return;
  }

  resetGameEditorForm();
  window.gameEditorState.gameId = gameId;
  window.gameEditorState.originalImageUrl = g.imageUrl || null;

  document.getElementById('gameEditorTitle').value = g.title || '';
  document.getElementById('gameEditorDesc').value = g.description || '';
  const urlEl = document.getElementById('gameEditorUrlReadonly');
  if (urlEl) urlEl.textContent = g.url || '—';

  const genre = g.genre && String(g.genre).trim() ? g.genre : 'Прочее';
  window.selectedGenres.edit = genre;
  if (typeof renderGenrePills === 'function') renderGenrePills('genrePillsEdit', 'edit');

  const preview = document.getElementById('gameEditorCoverPreview');
  if (preview) {
    if (g.imageUrl) {
      preview.innerHTML = `<img src="${esc(g.imageUrl)}" alt="">`;
      preview.classList.add('has-image');
    } else {
      preview.innerHTML = '<span>Без обложки</span>';
      preview.classList.remove('has-image');
    }
  }
  document.getElementById('gameEditorCoverUrl').value = g.imageUrl || '';

  setUploadEditorMode(true);
  if (typeof openUpload === 'function') openUpload();
}

function closeGameEditorUi() {
  setUploadEditorMode(false);
  resetGameEditorForm();
}

function cancelGameEditor() {
  closeGameEditorUi();
  if (typeof closeUpload === 'function') closeUpload();
}

async function saveGameEditor() {
  const gameId = window.gameEditorState.gameId;
  if (!gameId) return;

  const title = document.getElementById('gameEditorTitle')?.value?.trim() || '';
  const description = document.getElementById('gameEditorDesc')?.value?.trim() || '';
  const genre = window.selectedGenres?.edit || 'Прочее';
  const genreEmoji =
    typeof genreKeyForApiLabel === 'function' ? genreKeyForApiLabel(genre) : 'other';

  if (!title) {
    showToast('⚠️ Укажи название');
    return;
  }

  let imageUrl;
  const coverUrlField = document.getElementById('gameEditorCoverUrl')?.value?.trim() || '';
  const file = window.gameEditorState.coverFile;

  if (file) {
    showToast('⏳ Загружаем обложку…');
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('kind', 'cover');
      const uploaded = await API.uploadImage(formData);
      imageUrl = uploaded?.imageUrl;
      if (!imageUrl) throw new Error('нет URL');
    } catch (e) {
      showToast('⚠️ ' + (e?.message || 'обложка не загрузилась'));
      return;
    }
  } else if (coverUrlField) {
    imageUrl = coverUrlField;
  } else if (window.gameEditorState.clearCover) {
    imageUrl = null;
  }

  const body = { title, description, genre, genreEmoji };
  if (imageUrl !== undefined) body.imageUrl = imageUrl;

  showToast('⏳ Сохраняем…');
  try {
    const data = await API.updateGame(gameId, body);
    const game = data?.game;
    if (!game?.id) throw new Error('пустой ответ');

    if (typeof applyGamePatchToClientState === 'function') {
      const inFeed = (window.GAMES || []).some(x => x.id === game.id);
      if (inFeed) applyGamePatchToClientState(game);
      else if (typeof injectGameIntoFeed === 'function') await injectGameIntoFeed(game.id);
    }

    showToast('✅ Отправлено на модерацию');
    if (typeof hapticSuccess === 'function') hapticSuccess();
    cancelGameEditor();
    if (typeof renderProfile === 'function') renderProfile();
  } catch (e) {
    showToast(typeof userFacingError === 'function' ? userFacingError(e) : (e?.message || 'ошибка'));
    if (typeof hapticWarning === 'function') hapticWarning();
  }
}

/**
 * Обновить объект игры в GAMES и визуал ленты/поиска без полного перезагруза.
 * @param {object} game — формат как у GET /api/games/:id
 */
function applyGamePatchToClientState(game) {
  if (!game?.id || !Array.isArray(window.GAMES)) return;

  const idx = window.GAMES.findIndex(g => g.id === game.id);
  if (idx < 0) return;

  const prev = window.GAMES[idx];
  const next = {
    ...prev,
    title: game.title,
    description: game.description,
    genre: game.genre,
    genreEmoji: game.genreEmoji,
    imageUrl: game.imageUrl,
    status: game.status,
    likes: game.likes ?? prev.likes,
    plays: game.plays ?? prev.plays,
  };
  if (prev.isModerationQueue) next.isModerationQueue = true;
  window.GAMES[idx] = next;

  const searchOpen = document.getElementById('search-screen')?.classList.contains('open');
  if (searchOpen && typeof onSearch === 'function') {
    const q = document.getElementById('searchInput')?.value || '';
    onSearch(q);
  }

  const slide = window.slides?.[idx];
  if (slide) {
    const ph = slide.querySelector('.slide-placeholder');
    if (ph) {
      const thumbHtml = next.imageUrl
        ? `<img src="${esc(next.imageUrl)}" class="slide-cover" alt="">`
        : `<div class="placeholder-icon sg-placeholder-genre">${typeof genreIconForGame === 'function' ? genreIconForGame(next) : ''}</div>`;
      const statusBanner =
        next.status === 'pending'
          ? '<div class="slide-status-banner">На модерации</div>'
          : next.status === 'rejected'
            ? '<div class="slide-status-banner slide-status-rejected">Не прошла модерацию</div>'
            : '';
      const titleEl = ph.querySelector('.placeholder-title');
      if (titleEl) titleEl.textContent = next.title || '';
      ph.querySelectorAll('.slide-status-banner').forEach(el => el.remove());
      const oldThumb = ph.querySelector('.slide-cover, .placeholder-icon.sg-placeholder-genre');
      if (oldThumb) oldThumb.outerHTML = thumbHtml;
      else ph.insertAdjacentHTML('beforeend', thumbHtml);
      if (statusBanner) ph.insertAdjacentHTML('afterbegin', statusBanner);
    }
    const discTitle = slide.querySelector('.slide-discovery-title');
    if (discTitle) discTitle.textContent = next.title || 'Игра';
    const discDesc = slide.querySelector('.slide-discovery-desc');
    if (discDesc) {
      const maxD = 96;
      const raw = (next.description && String(next.description).trim()) || '';
      const t =
        raw.length <= maxD ? raw : raw.slice(0, Math.max(0, maxD - 1)).trimEnd() + '…';
      discDesc.textContent = t;
      discDesc.style.display = t ? '' : 'none';
    }
    const genreLine = slide.querySelector('.slide-discovery-meta');
    if (genreLine) {
      if (next.genre) {
        genreLine.innerHTML = `<span class="slide-discovery-genre">${typeof genreIconForGame === 'function' ? genreIconForGame(next) : ''}<span>${esc(next.genre)}</span></span>`;
        genreLine.style.display = '';
      } else {
        genreLine.innerHTML = '';
        genreLine.style.display = 'none';
      }
    }
  }

  if (idx === window.currentIdx && typeof updateOverlay === 'function') {
    updateOverlay();
  }
}

window.openGameEditor = openGameEditor;
window.cancelGameEditor = cancelGameEditor;
window.saveGameEditor = saveGameEditor;
window.previewGameEditorCover = previewGameEditorCover;
window.gameEditorClearCover = gameEditorClearCover;
window.applyGamePatchToClientState = applyGamePatchToClientState;
window.closeGameEditorUi = closeGameEditorUi;
