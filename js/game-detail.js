/** Полноэкранная карточка игры + отзывы в ленте (чип / drawer).
 * Единственная каноническая реализация — game-reviews-fix.js удалён.
 * Использует window.t() из i18n.js, data-action вместо onclick.
 */

let _gameDetailId = null;
let _feedReviewsOpen = false;
let _replyingToId = null;
let _editingReviewId = null;

// ── Вспомогательные функции ──────────────────────────────────────────────────

function formatGameDate(ts) {
  if (ts == null || !Number.isFinite(Number(ts))) return '—';
  try {
    const d = new Date(Number(ts) * 1000);
    const loc = typeof window.getLang === 'function' && window.getLang() === 'en' ? 'en-US' : 'ru-RU';
    return d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return '—';
  }
}

function _isMe(authorId) {
  if (!authorId || !window.USER?.id) return false;
  if (typeof window.sameTelegramUserId === 'function') {
    return window.sameTelegramUserId(authorId, window.USER.id);
  }
  return String(authorId) === String(window.USER.id);
}

// ── Работа с отзывами ────────────────────────────────────────────────────────

async function fetchGameReviews(gameId) {
  try {
    const data = await API.gameReviews(gameId);
    return Array.isArray(data?.reviews) ? data.reviews : [];
  } catch (e) {
    if (window.SMOLGAME_DEBUG) console.warn('[GameDetail] Fetch reviews fail:', e.message || e);
    return null;
  }
}

async function loadFeedReviewCount() {
  const chip = document.getElementById('feedReviewCount');
  if (!chip || !Array.isArray(window.GAMES) || window.GAMES.length === 0) return;
  const g = window.GAMES[window.currentIdx];
  if (!g?.id) return;
  try {
    const list = await fetchGameReviews(g.id);
    if (Array.isArray(list)) chip.textContent = String(list.length);
  } catch (e) {
    // Тихо игнорируем ошибки счётчика
  }
}

/** Рендеринг одного отзыва с data-action вместо onclick */
function renderReviewItem(r, isReply = false) {
  if (!r) return '';
  const author = esc(r.authorName || t('gd_player'));
  const firstChar = author.charAt(0).toUpperCase() || '?';
  const date = esc(formatGameDate(r.createdAt));
  const body = esc(r.body || '');
  if (!body && !r.authorId) return '';

  const isMy = _isMe(r.authorId);
  const isAdmin = typeof window.USER_IS_ADMIN !== 'undefined' ? window.USER_IS_ADMIN : false;
  const rId = esc(String(r.id));
  const authorSafe = author.replace(/'/g, '&#039;');
  const bodySafe = body.replace(/'/g, '&#039;');

  return `
    <div class="feed-review-item ${isReply ? 'feed-review-item--reply' : ''}" id="review-${rId}">
      <div class="feed-review-avatar">${firstChar}</div>
      <div class="feed-review-content">
        <div class="feed-review-header">
          <span class="feed-review-author">${author}</span>
          <span class="feed-review-date">${date}</span>
        </div>
        <p class="feed-review-body">${body}</p>
        <div class="feed-review-actions">
          <button type="button" class="feed-review-action"
            data-action="review-reply"
            data-review-id="${rId}"
            data-review-author="${authorSafe}">${t('review_reply')}</button>
          ${isMy ? `<button type="button" class="feed-review-action"
            data-action="review-edit"
            data-review-id="${rId}"
            data-review-body="${bodySafe}">${t('review_edit')}</button>` : ''}
          ${isMy || isAdmin ? `<button type="button" class="feed-review-action feed-review-action--danger"
            data-action="review-delete"
            data-review-id="${rId}">${t('review_delete')}</button>` : ''}
        </div>
      </div>
    </div>`;
}

function renderGameDetailReviews(container, reviews) {
  if (!container) return;
  if (!reviews || !reviews.length) {
    container.innerHTML = `<p class="game-detail-reviews-empty">${esc(t('gd_reviews_empty_page'))}</p>`;
    return;
  }
  container.innerHTML = reviews
    .map(r => `
    <div class="game-detail-review">
      <div class="game-detail-review-meta">
        <span>${esc(r.authorName || t('gd_player'))}</span>
        <span>${esc(formatGameDate(r.createdAt))}</span>
      </div>
      <p>${esc(r.body || '')}</p>
    </div>`)
    .join('');
}

// ── Drawer отзывов ленты ─────────────────────────────────────────────────────

function openFeedReviewsDrawer() {
  const drawer = document.getElementById('feed-reviews-drawer');
  const backdrop = document.getElementById('feed-reviews-backdrop');
  const listEl = document.getElementById('feedReviewsDrawerList');
  const input = document.getElementById('feedReviewInput');
  if (!drawer || !listEl) return;

  if (_feedReviewsOpen) return;
  _feedReviewsOpen = true;

  drawer.hidden = false;
  drawer.style.display = 'flex';
  void drawer.offsetHeight; // Force reflow для анимации
  drawer.setAttribute('aria-hidden', 'false');

  listEl.innerHTML = '';
  listEl.scrollTop = 0;
  if (input) input.value = '';

  if (backdrop) {
    backdrop.hidden = false;
    backdrop.setAttribute('data-action', 'close-feed-reviews');
  }

  if (typeof syncBackButton === 'function') syncBackButton();

  setTimeout(() => {
    if (_feedReviewsOpen) drawer.classList.add('is-stable');
  }, 300);

  _loadFeedReviewsData(listEl);
}

async function _loadFeedReviewsData(listEl) {
  let g = Array.isArray(window.GAMES) ? window.GAMES[window.currentIdx] : null;

  if (!g && window.location.hash.includes('game/')) {
    const parts = window.location.hash.split('game/');
    const id = parts[parts.length - 1];
    if (id && Array.isArray(window.GAMES)) {
      g = window.GAMES.find(x => String(x.id) === String(id));
    }
  }

  if (!g?.id) {
    listEl.innerHTML = `<div class="feed-reviews-empty">${esc(t('gd_no_data'))}</div>`;
    return;
  }

  listEl.innerHTML = `<div class="feed-reviews-loading">${esc(t('gd_reviews_loading'))}</div>`;

  try {
    const all = await fetchGameReviews(g.id);
    if (all === null) {
      listEl.innerHTML = `<div class="feed-reviews-empty">${esc(t('err_load'))}</div>`;
      return;
    }

    const chipNum = document.getElementById('feedReviewCount');
    if (chipNum) chipNum.textContent = String(all.length);

    if (all.length === 0) {
      listEl.innerHTML = `<div class="feed-reviews-empty">${esc(t('gd_reviews_empty_drawer'))}</div>`;
    } else {
      const roots = all.filter(r => !r.parentId);
      const replies = all.filter(r => r.parentId);

      let html = '';
      roots.forEach(root => {
        html += renderReviewItem(root, false);
        const childs = replies.filter(rep => String(rep.parentId) === String(root.id));
        childs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).forEach(child => {
          html += renderReviewItem(child, true);
        });
      });

      listEl.innerHTML = html || `<div class="feed-reviews-empty">${esc(t('gd_reviews_empty_drawer'))}</div>`;
    }
  } catch (err) {
    if (window.SMOLGAME_DEBUG) console.error('[GameDetail] Render reviews fail:', err);
    listEl.innerHTML = `<div class="feed-reviews-empty">${esc(t('err_load'))}</div>`;
  }
}

function closeFeedReviewsDrawer() {
  const drawer = document.getElementById('feed-reviews-drawer');
  const backdrop = document.getElementById('feed-reviews-backdrop');
  if (!drawer) return;
  const input = document.getElementById('feedReviewInput');
  if (input) {
    input.blur();
    input.value = '';
  }
  _feedReviewsOpen = false;
  drawer.classList.remove('is-stable');
  drawer.hidden = true;
  drawer.setAttribute('aria-hidden', 'true');
  if (backdrop) backdrop.hidden = true;
  cancelReviewAction();
  if (typeof syncBackButton === 'function') syncBackButton();
}

function setReviewReply(id, name) {
  _replyingToId = id;
  _editingReviewId = null;
  const bar = document.getElementById('feedReviewActionBar');
  const txt = document.getElementById('feedReviewActionText');
  const input = document.getElementById('feedReviewInput');
  if (bar && txt) {
    txt.textContent = t('review_replying_to', { name });
    bar.hidden = false;
  }
  if (input) {
    input.value = '';
    input.placeholder = `@${name}, ...`;
    input.focus();
  }
}

function setReviewEdit(id, currentText) {
  _editingReviewId = id;
  _replyingToId = null;
  const bar = document.getElementById('feedReviewActionBar');
  const txt = document.getElementById('feedReviewActionText');
  const input = document.getElementById('feedReviewInput');
  if (bar && txt) {
    txt.textContent = t('review_editing');
    bar.hidden = false;
  }
  if (input) {
    input.value = currentText;
    input.placeholder = '';
    input.focus();
  }
}

function cancelReviewAction() {
  _replyingToId = null;
  _editingReviewId = null;
  const bar = document.getElementById('feedReviewActionBar');
  const input = document.getElementById('feedReviewInput');
  if (bar) bar.hidden = true;
  if (input) {
    input.placeholder = t('review_short_placeholder');
    input.value = '';
  }
}

async function submitFeedReview() {
  const ta = document.getElementById('feedReviewInput');
  const text = ta?.value?.trim() || '';
  if (!text) {
    showToast(t('gd_review_empty'));
    return;
  }
  const g = Array.isArray(window.GAMES) ? window.GAMES[window.currentIdx] : null;
  if (!g?.id) return;

  const editingId = _editingReviewId;
  const replyingId = _replyingToId;

  // Оптимистичное обновление (только для новых отзывов)
  const listEl = document.getElementById('feedReviewsDrawerList');
  if (listEl && !editingId) {
    const author = esc(window.USER?.display_name || window.USER?.first_name || t('gd_player'));
    const firstChar = author.charAt(0).toUpperCase() || '?';
    const dateText = typeof window.getLang === 'function' && window.getLang() === 'en' ? 'Just now' : 'Только что';

    const newReviewHtml = `
      <div class="feed-review-item optimistic ${replyingId ? 'feed-review-item--reply' : ''}" style="opacity: 0.7;">
        <div class="feed-review-avatar">${firstChar}</div>
        <div class="feed-review-content">
          <div class="feed-review-header">
            <span class="feed-review-author">${author}</span>
            <span class="feed-review-date">${dateText}</span>
          </div>
          <p class="feed-review-body">${esc(text)}</p>
        </div>
      </div>`;

    if (listEl.querySelector('.feed-reviews-empty')) {
      listEl.innerHTML = newReviewHtml;
    } else {
      if (replyingId) {
        const parentEl = document.getElementById(`review-${replyingId}`);
        if (parentEl) parentEl.insertAdjacentHTML('afterend', newReviewHtml);
        else listEl.insertAdjacentHTML('afterbegin', newReviewHtml);
      } else {
        listEl.insertAdjacentHTML('afterbegin', newReviewHtml);
      }
    }
  }

  try {
    if (ta) ta.value = '';

    if (editingId) {
      await API.updateReview(editingId, text);
    } else {
      await API.postGameReview(g.id, { body: text, parentId: replyingId });
    }

    cancelReviewAction();
    await loadFeedReviewCount();
    setTimeout(() => openFeedReviewsDrawer(), 500);
  } catch (e) {
    if (window.SMOLGAME_DEBUG) console.error('[GameDetail] Submit review error:', e);
    showToast(t('try_again'));
    await openFeedReviewsDrawer();
  }
}

async function deleteFeedReview(id) {
  const confirmed = window.Telegram?.WebApp?.showConfirm
    ? await new Promise(resolve => window.Telegram.WebApp.showConfirm(t('review_delete') + '?', resolve))
    : confirm(t('review_delete') + '?');
  if (!confirmed) return;
  try {
    await API.deleteReview(id);
    await openFeedReviewsDrawer();
    await loadFeedReviewCount();
  } catch (e) {
    showToast(t('try_again'));
  }
}

// ── Полноэкранная карточка игры ──────────────────────────────────────────────

async function openGameDetail(gameId) {
  if (!gameId) return;
  const screen = document.getElementById('game-detail-screen');
  if (!screen) return;
  _gameDetailId = gameId;

  const hero = document.getElementById('gameDetailHero');
  const titleEl = document.getElementById('gameDetailTitle');
  const topTitle = document.getElementById('gameDetailTopTitle');
  const descEl = document.getElementById('gameDetailDesc');
  const badges = document.getElementById('gameDetailBadges');
  const meta = document.getElementById('gameDetailMeta');
  const authorCard = document.getElementById('gameDetailAuthorCard');
  const reviewsEl = document.getElementById('gameDetailReviews');
  const reviewForm = document.getElementById('gameDetailReviewForm');
  const ownerActions = document.getElementById('gameDetailOwnerActions');
  const playBtn = document.getElementById('gameDetailPlayBtn');

  hero.innerHTML = '<div class="game-detail-hero-skel"></div>';
  titleEl.textContent = '…';
  if (topTitle) topTitle.textContent = t('game_word');
  descEl.textContent = '';
  badges.innerHTML = '';
  meta.innerHTML = '';
  authorCard.innerHTML = '';
  if (reviewsEl) reviewsEl.innerHTML = '';
  if (reviewForm) reviewForm.hidden = false;
  if (ownerActions) { ownerActions.hidden = true; ownerActions.innerHTML = ''; }

  window._gameDetailReturnTab = window._activeMainTab || 'feed';
  ['games-library-screen', 'search-screen', 'profile-screen', 'author-screen']
    .forEach(id => document.getElementById(id)?.classList.remove('open'));
  if (typeof syncBodyFeedHiddenUnderSheet === 'function') syncBodyFeedHiddenUnderSheet();

  screen.hidden = false;
  screen.setAttribute('aria-hidden', 'false');

  const scrollEl = document.getElementById('gameDetailScroll');
  if (scrollEl) scrollEl.scrollTop = 0;

  void screen.offsetHeight;
  document.body.classList.add('game-detail-open');

  const inp = document.getElementById('gameDetailReviewInput');
  if (inp) inp.value = '';

  try {
    const data = await API.game(gameId);
    const game = data?.game;
    if (!game?.id) throw new Error(t('gd_no_data'));

    titleEl.textContent = game.title || t('game_word');
    if (topTitle) topTitle.textContent = game.title || t('game_word');
    descEl.textContent = (game.description && String(game.description).trim()) || t('gd_no_desc');

    const img = game.imageUrl
      ? `<img src="${esc(game.imageUrl)}" alt="" class="game-detail-hero-img">`
      : `<div class="game-detail-hero-ph">${typeof genreIconForGame === 'function' ? genreIconForGame(game) : ''}</div>`;
    hero.innerHTML = img;

    const st = game.status || '';
    let badgeHtml = '';
    if (st === 'pending') {
      badgeHtml = `<span class="game-detail-badge game-detail-badge--pending">${esc(t('pending_banner'))}</span>`;
    } else if (st === 'rejected') {
      badgeHtml = `<span class="game-detail-badge game-detail-badge--rejected">${esc(t('gd_badge_rejected'))}</span>`;
    } else {
      badgeHtml = `<span class="game-detail-badge game-detail-badge--free">${esc(t('free'))}</span>`;
    }

    const genreShown = game.genre && typeof genreDisplayFromApi === 'function'
      ? genreDisplayFromApi(game.genre)
      : game.genre || '';
    badges.innerHTML = badgeHtml + (genreShown
      ? `<span class="game-detail-badge game-detail-badge--muted">${esc(genreShown)}</span>`
      : '');

    const pubLine = st === 'published'
      ? t('gd_in_catalog', { date: formatGameDate(game.updatedAt ?? game.createdAt) })
      : st === 'pending' ? t('gd_pending_check') : t('gd_not_listed');
    const genreMeta = game.genre && typeof genreDisplayFromApi === 'function'
      ? genreDisplayFromApi(game.genre)
      : game.genre || '—';

    meta.innerHTML = `
      <div class="game-detail-meta-cell">
        <span class="game-detail-meta-k">${esc(t('meta_genre'))}</span>
        <span class="game-detail-meta-v">${esc(genreMeta)}</span>
      </div>
      <div class="game-detail-meta-cell">
        <span class="game-detail-meta-k">${esc(t('meta_likes'))}</span>
        <span class="game-detail-meta-v">${esc(fmtNum(game.likes))}</span>
      </div>
      <div class="game-detail-meta-cell">
        <span class="game-detail-meta-k">${esc(t('meta_plays'))}</span>
        <span class="game-detail-meta-v">${esc(fmtNum(game.plays))}</span>
      </div>
    `;

    const av = game.authorAvatar;
    const avUrl = typeof avatarImgUrl === 'function' ? avatarImgUrl(av) : null;
    const avHtml = avUrl
      ? `<div class="game-detail-author-av"><img src="${esc(avUrl)}" alt="" referrerpolicy="no-referrer"></div>`
      : `<div class="game-detail-author-av game-detail-author-av--txt">${esc(String(game.authorName || '?').slice(0, 1))}</div>`;
    const following = typeof followedSet !== 'undefined' && game.authorId && followedSet.has(game.authorId);
    const isSelf = Boolean(game.authorId && window.USER?.id && _isMe(game.authorId));
    const followLabel = following ? t('follow_done') : t('follow_add_author');

    authorCard.innerHTML = `
      ${avHtml}
      <div class="game-detail-author-text">
        <div class="game-detail-author-name">${esc(game.authorName || t('gd_author'))}</div>
        ${game.authorHandle ? `<div class="game-detail-author-handle">@${esc(game.authorHandle)}</div>` : ''}
      </div>
      <button type="button" class="sg-btn sg-btn--secondary game-detail-follow ${following ? 'following' : ''}"
        data-action="game-detail-follow"
        data-author-id="${esc(game.authorId)}"
        ${isSelf ? 'hidden' : ''}>${esc(followLabel)}</button>
    `;

    if (st === 'published' && playBtn) playBtn.hidden = false;
    else if (playBtn) playBtn.hidden = true;

    const revs = await fetchGameReviews(gameId);
    renderGameDetailReviews(reviewsEl, revs);

    if (reviewForm) reviewForm.hidden = isSelf;
    if (ownerActions) {
      if (isSelf) {
        ownerActions.hidden = false;
        ownerActions.innerHTML = `
          <p class="game-detail-owner-lead">${esc(t('gd_owner_your_game'))}</p>
          <div class="game-detail-owner-btns">
            <button type="button" class="sg-btn sg-btn--secondary"
              data-action="game-detail-owner-edit"
              data-game-id="${esc(game.id)}">${esc(t('gd_edit'))}</button>
            <button type="button" class="sg-btn sg-btn--secondary"
              data-action="game-detail-owner-feed"
              data-game-id="${esc(game.id)}">${esc(t('gd_open_in_feed'))}</button>
            <button type="button" class="sg-btn sg-btn--ghost game-detail-owner-del"
              data-action="game-detail-owner-delete"
              data-game-id="${esc(game.id)}"
              data-game-title="${esc(game.title || '')}"
              data-game-url="${esc(game.url || '')}">${esc(t('gd_delete'))}</button>
          </div>
        `;
      } else {
        ownerActions.hidden = true;
        ownerActions.innerHTML = '';
      }
    }
  } catch (e) {
    if (window.SMOLGAME_DEBUG) console.error('[GameDetail] Load error:', e);
    showToast(typeof userFacingError === 'function' ? userFacingError(e) : t('err_load'));
    closeGameDetail();
  }
}

function closeGameDetail() {
  const screen = document.getElementById('game-detail-screen');
  if (!screen) return;
  document.body.classList.remove('game-detail-open');
  _gameDetailId = null;

  // Ждём завершения анимации (CSS: 0.3s) перед реальным скрытием
  setTimeout(() => {
    screen.hidden = true;
    screen.setAttribute('aria-hidden', 'true');
  }, 300);

  const returnTo = window._gameDetailReturnTab || 'feed';
  window._gameDetailReturnTab = null;
  if (typeof switchTab === 'function') switchTab(returnTo);
}

async function gameDetailPlay() {
  const id = _gameDetailId;
  if (!id) return;
  closeGameDetail();
  if (typeof closeProfile === 'function') closeProfile();
  if (typeof closeSearch === 'function') closeSearch();
  if (typeof closeGamesLibrary === 'function') closeGamesLibrary();
  if (typeof switchTab === 'function') switchTab('feed');
  let idx = typeof GAMES !== 'undefined' ? GAMES.findIndex(g => g.id === id) : -1;
  if (idx === -1 && typeof injectGameIntoFeed === 'function') {
    idx = await injectGameIntoFeed(id);
  }
  if (idx >= 0 && typeof goTo === 'function') goTo(idx, false);
}

async function gameDetailSubmitReview() {
  const id = _gameDetailId;
  const ta = document.getElementById('gameDetailReviewInput');
  const text = ta?.value?.trim() || '';
  if (!id || !text) {
    showToast(t('gd_review_empty'));
    return;
  }
  try {
    await API.postGameReview(id, { body: text });
    ta.value = '';
    showToast(t('gd_review_saved'));
    const reviews = await fetchGameReviews(id);
    renderGameDetailReviews(document.getElementById('gameDetailReviews'), reviews);
  } catch (e) {
    showToast(typeof userFacingError === 'function' ? userFacingError(e) : t('try_again'));
  }
}

async function gameDetailToggleFollow(el) {
  const authorId = el?.dataset?.authorId;
  if (!authorId || _isMe(authorId)) return;
  const was = typeof followedSet !== 'undefined' && followedSet.has(authorId);
  if (was) followedSet.delete(authorId);
  else followedSet.add(authorId);
  if (typeof saveSet === 'function' && typeof STORAGE_KEYS !== 'undefined') {
    saveSet(STORAGE_KEYS.followed, followedSet);
  }
  el.textContent = was ? t('follow_add_author') : t('follow_done');
  el.classList.toggle('following', !was);
  try {
    await (was ? API.unfollow(authorId) : API.follow(authorId));
    showToast(was ? t('unsubscribed') : t('subscribed'));
    if (typeof updateOverlay === 'function') updateOverlay();
  } catch (e) {
    if (was) followedSet.add(authorId);
    else followedSet.delete(authorId);
    if (typeof saveSet === 'function' && typeof STORAGE_KEYS !== 'undefined') {
      saveSet(STORAGE_KEYS.followed, followedSet);
    }
    el.textContent = was ? t('follow_done') : t('follow_add_author');
    el.classList.toggle('following', was);
    showToast(typeof userFacingError === 'function' ? userFacingError(e) : t('try_again'));
  }
}

async function gameDetailOwnerEdit(gameId) {
  closeGameDetail();
  if (typeof openProfile === 'function') openProfile();
  if (typeof renderProfile === 'function') await renderProfile();
  setTimeout(() => {
    if (typeof toggleProfileGameEditor === 'function') toggleProfileGameEditor(gameId);
  }, 280);
}

async function gameDetailOwnerFeed(gameId) {
  closeGameDetail();
  if (typeof closeProfile === 'function') closeProfile();
  if (typeof switchTab === 'function') switchTab('feed');
  let idx = typeof GAMES !== 'undefined' ? GAMES.findIndex(g => g.id === gameId) : -1;
  if (idx === -1 && typeof injectGameIntoFeed === 'function') {
    idx = await injectGameIntoFeed(gameId);
  }
  if (idx >= 0 && typeof goTo === 'function') goTo(idx, false);
}

async function gameDetailOwnerDelete(gameId, title, playUrl) {
  if (typeof deleteGame === 'function') {
    try { await deleteGame(gameId, title, playUrl); } finally { closeGameDetail(); }
  } else { closeGameDetail(); }
}

// ── Экспорт ──────────────────────────────────────────────────────────────────

window.openGameDetail = openGameDetail;
window.closeGameDetail = closeGameDetail;
window.gameDetailPlay = gameDetailPlay;
window.gameDetailSubmitReview = gameDetailSubmitReview;
window.gameDetailToggleFollow = gameDetailToggleFollow;
window.gameDetailOwnerEdit = gameDetailOwnerEdit;
window.gameDetailOwnerFeed = gameDetailOwnerFeed;
window.gameDetailOwnerDelete = gameDetailOwnerDelete;
window.loadFeedReviewCount = loadFeedReviewCount;
window.openFeedReviewsDrawer = openFeedReviewsDrawer;
window.closeFeedReviewsDrawer = closeFeedReviewsDrawer;
window.submitFeedReview = submitFeedReview;
window.setReviewReply = setReviewReply;
window.setReviewEdit = setReviewEdit;
window.cancelReviewAction = cancelReviewAction;
window.deleteFeedReview = deleteFeedReview;
