/** Редактирование карточки своей игры в профиле: PATCH → pending; синхронизация ленты и поиска. */

var tf = typeof window.t === 'function' ? window.t : k => k;
var genreOtherApi = () => tf('genre_api_other');

window.gameEditorState = {
  coverFile: null,
  clearCover: false,
};

window.profileActiveEditGameId = null;

function profileEditorRoot(gameId) {
  return document.getElementById('profileGameEditor-' + gameId);
}

function profileGameRowEl(gameId) {
  const id = String(gameId ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return document.querySelector('.profile-game-row[data-profile-game-id="' + id + '"]');
}

function resetGameEditorState() {
  window.gameEditorState = { coverFile: null, clearCover: false };
  window.profileActiveEditGameId = null;
}

function previewProfileGameCover(input, gameId) {
  const root = profileEditorRoot(gameId);
  const preview = root?.querySelector('.profile-game-editor-preview');
  const file = input?.files?.[0];
  if (!preview || !root) return;
  window.gameEditorState.coverFile = file || null;
  window.gameEditorState.clearCover = false;
  if (!file) {
    const cur = root.dataset.originalImageUrl || '';
    if (cur) {
      preview.innerHTML = `<img src="${esc(cur)}" alt="">`;
      preview.classList.add('has-image');
    } else {
      preview.innerHTML = `<span>${esc(tf('no_cover'))}</span>`;
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

function gameEditorClearCover(gameId) {
  const root = profileEditorRoot(gameId);
  const input = root?.querySelector('.profile-game-editor-cover-file');
  window.gameEditorState.coverFile = null;
  window.gameEditorState.clearCover = true;
  if (input) input.value = '';
  const preview = root?.querySelector('.profile-game-editor-preview');
  if (preview) {
    preview.innerHTML = `<span>${esc(tf('no_cover'))}</span>`;
    preview.classList.remove('has-image');
  }
}

function closeAllProfileGameEditors() {
  document.querySelectorAll('.profile-game-editor').forEach(el => {
    el.hidden = true;
  });
  document.querySelectorAll('.profile-game-row').forEach(row => row.classList.remove('profile-game-row--editing'));
  resetGameEditorState();
}

function toggleProfileGameEditor(gameId) {
  if (!gameId) return;
  const row = profileGameRowEl(gameId);
  const panel = profileEditorRoot(gameId);
  if (!row || !panel) return;

  if (!panel.hidden) {
    cancelProfileGameEditor(gameId);
    return;
  }

  if (row.dataset.status === 'rejected') {
    showToast(tf('profile_editor_no_edit'));
    return;
  }

  closeAllProfileGameEditors();

  window.profileActiveEditGameId = gameId;
  const titleEl = panel.querySelector('.profile-game-editor-title');
  const descEl = panel.querySelector('.profile-game-editor-desc');
  const urlEl = panel.querySelector('.profile-game-editor-url');
  const coverUrlEl = panel.querySelector('.profile-game-editor-cover-url');
  const fileInput = panel.querySelector('.profile-game-editor-cover-file');

  if (titleEl) titleEl.value = row.dataset.title || '';
  if (descEl) descEl.value = row.dataset.description || '';
  if (urlEl) urlEl.textContent = row.dataset.url || '—';
  if (coverUrlEl) coverUrlEl.value = row.dataset.imageUrl || '';

  panel.dataset.originalImageUrl = row.dataset.imageUrl || '';

  const genre = row.dataset.genre && String(row.dataset.genre).trim() ? row.dataset.genre : genreOtherApi();
  const sk = 'edit_' + gameId;
  window.selectedGenres[sk] = genre;
  if (typeof renderGenrePills === 'function') {
    renderGenrePills('genrePillsEdit-' + gameId, sk);
  }

  const preview = panel.querySelector('.profile-game-editor-preview');
  if (preview) {
    if (row.dataset.imageUrl) {
      preview.innerHTML = `<img src="${esc(row.dataset.imageUrl)}" alt="">`;
      preview.classList.add('has-image');
    } else {
      preview.innerHTML = `<span>${esc(tf('no_cover'))}</span>`;
      preview.classList.remove('has-image');
    }
  }
  if (fileInput) fileInput.value = '';
  window.gameEditorState = { coverFile: null, clearCover: false };

  panel.hidden = false;
  row.classList.add('profile-game-row--editing');
  try {
    panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch (e) {
    panel.scrollIntoView();
  }
  setTimeout(() => {
    try {
      titleEl?.focus();
    } catch (e2) {
      /* ignore */
    }
  }, 220);
}

function cancelProfileGameEditor(gameId) {
  const panel = profileEditorRoot(gameId);
  if (panel) panel.hidden = true;
  profileGameRowEl(gameId)?.classList.remove('profile-game-row--editing');
  resetGameEditorState();
}

async function saveProfileGameEditor(gameId) {
  if (!gameId) return;
  const root = profileEditorRoot(gameId);
  if (!root) return;

  const title = root.querySelector('.profile-game-editor-title')?.value?.trim() || '';
  const description = root.querySelector('.profile-game-editor-desc')?.value?.trim() || '';
  const sk = 'edit_' + gameId;
  const genre = window.selectedGenres?.[sk] || genreOtherApi();
  const genreEmoji =
    typeof genreKeyForApiLabel === 'function' ? genreKeyForApiLabel(genre) : 'other';

  if (!title) {
    showToast(tf('profile_editor_need_title'));
    return;
  }

  let imageUrl;
  const coverUrlField = root.querySelector('.profile-game-editor-cover-url')?.value?.trim() || '';
  const file = window.gameEditorState.coverFile;

  if (file) {
    showToast(tf('profile_editor_upload_cover'));
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('kind', 'cover');
      const uploaded = await API.uploadImage(formData);
      imageUrl = uploaded?.imageUrl;
      if (!imageUrl) throw new Error(tf('err_no_url'));
    } catch (e) {
      showToast('⚠️ ' + (e?.message || tf('profile_cover_upload_fail')));
      return;
    }
  } else if (coverUrlField) {
    imageUrl = coverUrlField;
  } else if (window.gameEditorState.clearCover) {
    imageUrl = null;
  }

  const body = { title, description, genre, genreEmoji };
  if (imageUrl !== undefined) body.imageUrl = imageUrl;

  showToast(tf('profile_editor_saving'));
  try {
    const data = await API.updateGame(gameId, body);
    const game = data?.game;
    if (!game?.id) throw new Error(tf('err_empty_response'));

    if (typeof applyGamePatchToClientState === 'function') {
      const inFeed = (window.GAMES || []).some(x => x.id === game.id);
      if (inFeed) applyGamePatchToClientState(game);
      else if (typeof injectGameIntoFeed === 'function') await injectGameIntoFeed(game.id);
    }

    showToast(tf('profile_editor_sent'));
    if (typeof hapticSuccess === 'function') hapticSuccess();
    cancelProfileGameEditor(gameId);
    if (typeof renderProfile === 'function') await renderProfile();
  } catch (e) {
    showToast(typeof userFacingError === 'function' ? userFacingError(e) : (e?.message || tf('err_error')));
    if (typeof hapticWarning === 'function') hapticWarning();
  }
}

/**
 * Обновить объект игры в GAMES и визуал ленты/поиска без полного перезагруза.
 * @param {object} game — формат как у GET /api/games/:id
 */
function applyGamePatchToClientState(game) {
  if (!game?.id || !Array.isArray(window.GAMES)) return;
  const tr = typeof window.t === 'function' ? window.t : k => k;

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
          ? `<div class="slide-status-banner">${esc(tr('pending_banner'))}</div>`
          : next.status === 'rejected'
            ? `<div class="slide-status-banner slide-status-rejected">${esc(tr('rejected_banner'))}</div>`
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
    if (discTitle) discTitle.textContent = next.title || tr('game_fallback');
    const discDesc = slide.querySelector('.slide-discovery-desc');
    if (discDesc) {
      const maxD = 96;
      const raw = (next.description && String(next.description).trim()) || '';
      const descText =
        raw.length <= maxD ? raw : raw.slice(0, Math.max(0, maxD - 1)).trimEnd() + '…';
      discDesc.textContent = descText;
      discDesc.style.display = descText ? '' : 'none';
    }
    const genreLine = slide.querySelector('.slide-discovery-meta');
    if (genreLine) {
      if (next.genre) {
        const gDisp =
          typeof genreDisplayFromApi === 'function' ? genreDisplayFromApi(next.genre) : next.genre;
        genreLine.innerHTML = `<span class="slide-discovery-genre">${typeof genreIconForGame === 'function' ? genreIconForGame(next) : ''}<span>${esc(gDisp)}</span></span>`;
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

window.toggleProfileGameEditor = toggleProfileGameEditor;
window.cancelProfileGameEditor = cancelProfileGameEditor;
window.saveProfileGameEditor = saveProfileGameEditor;
window.previewProfileGameCover = previewProfileGameCover;
window.gameEditorClearCover = gameEditorClearCover;
window.applyGamePatchToClientState = applyGamePatchToClientState;
window.closeAllProfileGameEditors = closeAllProfileGameEditors;
