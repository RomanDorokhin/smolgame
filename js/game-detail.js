/** Полноэкранная карточка игры + отзывы в ленте (чип / drawer). */

let _gameDetailId = null;
let _feedReviewsOpen = false;

function formatGameDate(ts) {
  if (ts == null || !Number.isFinite(Number(ts))) return '—';
  try {
    const d = new Date(Number(ts) * 1000);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return '—';
  }
}

async function fetchGameReviews(gameId) {
  try {
    const data = await API.gameReviews(gameId);
    return Array.isArray(data?.reviews) ? data.reviews : [];
  } catch (e) {
    return [];
  }
}

async function loadFeedReviewCount() {
  const chip = document.getElementById('feedReviewCount');
  if (!chip || !Array.isArray(window.GAMES) || window.GAMES.length === 0) return;
  const g = GAMES[window.currentIdx];
  if (!g?.id) return;
  const list = await fetchGameReviews(g.id);
  chip.textContent = String(list.length);
}

async function openFeedReviewsDrawer() {
  const drawer = document.getElementById('feed-reviews-drawer');
  const listEl = document.getElementById('feedReviewsDrawerList');
  if (!drawer || !listEl || !Array.isArray(window.GAMES) || GAMES.length === 0) return;
  const g = GAMES[window.currentIdx];
  if (!g?.id) return;
  _feedReviewsOpen = true;
  drawer.hidden = false;
  drawer.setAttribute('aria-hidden', 'false');
  listEl.innerHTML = '<p class="feed-reviews-loading">Загрузка…</p>';
  const list = await fetchGameReviews(g.id);
  const chipNum = document.getElementById('feedReviewCount');
  if (chipNum) chipNum.textContent = String(list.length);
  if (list.length === 0) {
    listEl.innerHTML = '<p class="feed-reviews-empty">Пока без отзывов — будь первым.</p>';
  } else {
    listEl.innerHTML = list
      .map(
        r => `
      <div class="feed-review-item">
        <div class="feed-review-item-head"><span class="feed-review-author">${esc(r.authorName || 'Игрок')}</span><span class="feed-review-date">${esc(formatGameDate(r.createdAt))}</span></div>
        <p class="feed-review-body">${esc(r.body || '')}</p>
      </div>`
      )
      .join('');
  }
}

function closeFeedReviewsDrawer() {
  const drawer = document.getElementById('feed-reviews-drawer');
  if (!drawer) return;
  _feedReviewsOpen = false;
  drawer.hidden = true;
  drawer.setAttribute('aria-hidden', 'true');
}

async function submitFeedReview() {
  const ta = document.getElementById('feedReviewInput');
  const text = ta?.value?.trim() || '';
  if (!text) {
    showToast('⚠️ Напиши отзыв');
    return;
  }
  if (!Array.isArray(window.GAMES) || GAMES.length === 0) return;
  const g = GAMES[window.currentIdx];
  if (!g?.id) return;
  try {
    await API.postGameReview(g.id, { text });
    ta.value = '';
    showToast('✅ Отзыв сохранён');
    await openFeedReviewsDrawer();
    await loadFeedReviewCount();
  } catch (e) {
    showToast(typeof userFacingError === 'function' ? userFacingError(e) : (e?.message || 'Не вышло'));
  }
}

function renderGameDetailReviews(container, reviews) {
  if (!container) return;
  if (!reviews.length) {
    container.innerHTML = '<p class="game-detail-reviews-empty">Пока нет отзывов.</p>';
    return;
  }
  container.innerHTML = reviews
    .map(
      r => `
    <div class="game-detail-review">
      <div class="game-detail-review-meta"><span>${esc(r.authorName || 'Игрок')}</span><span>${esc(formatGameDate(r.createdAt))}</span></div>
      <p>${esc(r.body || '')}</p>
    </div>`
    )
    .join('');
}

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
  if (topTitle) topTitle.textContent = 'Игра';
  descEl.textContent = '';
  badges.innerHTML = '';
  meta.innerHTML = '';
  authorCard.innerHTML = '';
  reviewsEl.innerHTML = '';
  if (reviewForm) {
    reviewForm.hidden = false;
    const inp = document.getElementById('gameDetailReviewInput');
    if (inp) inp.value = '';
  }
  ownerActions.hidden = true;
  ownerActions.innerHTML = '';

  screen.hidden = false;
  screen.setAttribute('aria-hidden', 'false');
  document.body.classList.add('game-detail-open');

  let game;
  try {
    const data = await API.game(gameId);
    game = data?.game;
    if (!game?.id) throw new Error('Нет данных');
  } catch (e) {
    showToast(typeof userFacingError === 'function' ? userFacingError(e) : 'Не загрузилось');
    closeGameDetail();
    return;
  }

  titleEl.textContent = game.title || 'Игра';
  if (topTitle) topTitle.textContent = game.title || 'Игра';
  descEl.textContent = (game.description && String(game.description).trim()) || 'Без описания.';

  const img = game.imageUrl
    ? `<img src="${esc(game.imageUrl)}" alt="" class="game-detail-hero-img">`
    : `<div class="game-detail-hero-ph">${typeof genreIconForGame === 'function' ? genreIconForGame(game) : ''}</div>`;
  hero.innerHTML = img;

  const st = game.status || '';
  let badgeHtml = '';
  if (st === 'pending') badgeHtml = '<span class="game-detail-badge game-detail-badge--pending">На модерации</span>';
  else if (st === 'rejected') badgeHtml = '<span class="game-detail-badge game-detail-badge--rejected">Отклонена</span>';
  else badgeHtml = '<span class="game-detail-badge game-detail-badge--free">Бесплатно</span>';
  badges.innerHTML = badgeHtml + (game.genre ? `<span class="game-detail-badge game-detail-badge--muted">${esc(game.genre)}</span>` : '');

  const pubLine =
    st === 'published'
      ? `В каталоге с ${esc(formatGameDate(game.updatedAt ?? game.createdAt))}`
      : st === 'pending'
        ? 'Карточка на проверке'
        : 'Не в каталоге';
  meta.innerHTML = `
    <div class="game-detail-meta-cell"><span class="game-detail-meta-k">Жанр</span><span class="game-detail-meta-v">${esc(game.genre || '—')}</span></div>
    <div class="game-detail-meta-cell"><span class="game-detail-meta-k">Лайки</span><span class="game-detail-meta-v">${esc(fmtNum(game.likes))}</span></div>
    <div class="game-detail-meta-cell"><span class="game-detail-meta-k">Запуски</span><span class="game-detail-meta-v">${esc(fmtNum(game.plays))}</span></div>
    <div class="game-detail-meta-cell game-detail-meta-cell--wide"><span class="game-detail-meta-k">Дата</span><span class="game-detail-meta-v">${pubLine}</span></div>
  `;

  const av = game.authorAvatar;
  const avUrl = typeof avatarImgUrl === 'function' ? avatarImgUrl(av) : null;
  const avHtml = avUrl
    ? `<div class="game-detail-author-av"><img src="${esc(avUrl)}" alt="" referrerpolicy="no-referrer"></div>`
    : `<div class="game-detail-author-av game-detail-author-av--txt">${esc(String(av || '?').slice(0, 1))}</div>`;
  const following = typeof followedSet !== 'undefined' && game.authorId && followedSet.has(game.authorId);
  const isSelf = Boolean(game.authorId && USER?.id && game.authorId === USER.id);
  authorCard.innerHTML = `
    <div class="game-detail-author-row">
      ${avHtml}
      <div class="game-detail-author-text">
        <div class="game-detail-author-name">${esc(game.authorName || 'Автор')}</div>
        <div class="game-detail-author-handle">${game.authorHandle ? '@' + esc(game.authorHandle) : ''}</div>
      </div>
    </div>
    <button type="button" class="sg-btn sg-btn--secondary game-detail-follow ${following ? 'following' : ''}" data-action="game-detail-follow" data-author-id="${esc(game.authorId)}" ${isSelf ? 'hidden' : ''}>${following ? 'Вы подписаны' : '+ Подписаться на автора'}</button>
  `;

  if (st === 'published' && playBtn) playBtn.hidden = false;
  else if (playBtn) playBtn.hidden = true;

  const reviews = await fetchGameReviews(gameId);
  renderGameDetailReviews(reviewsEl, reviews);

  const isOwner = Boolean(USER?.id && game.authorId === USER.id);
  if (reviewForm) reviewForm.hidden = isOwner;
  if (ownerActions) {
    if (isOwner) {
    ownerActions.hidden = false;
    ownerActions.innerHTML = `
      <p class="game-detail-owner-lead">Твоя игра</p>
      <div class="game-detail-owner-btns">
        <button type="button" class="sg-btn sg-btn--secondary" data-action="game-detail-owner-edit" data-game-id="${esc(game.id)}">Редактировать</button>
        <button type="button" class="sg-btn sg-btn--secondary" data-action="game-detail-owner-feed" data-game-id="${esc(game.id)}">Открыть в ленте</button>
        <button type="button" class="sg-btn sg-btn--ghost game-detail-owner-del" data-action="game-detail-owner-delete" data-game-id="${esc(game.id)}" data-game-title="${esc(game.title || '')}" data-game-url="${esc(game.url || '')}">Удалить</button>
      </div>
    `;
    } else {
      ownerActions.hidden = true;
      ownerActions.innerHTML = '';
    }
  }
}

function closeGameDetail() {
  const screen = document.getElementById('game-detail-screen');
  if (!screen) return;
  screen.hidden = true;
  screen.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('game-detail-open');
  _gameDetailId = null;
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
    showToast('⚠️ Напиши отзыв');
    return;
  }
  try {
    await API.postGameReview(id, { text });
    ta.value = '';
    showToast('✅ Отзыв сохранён');
    const reviews = await fetchGameReviews(id);
    renderGameDetailReviews(document.getElementById('gameDetailReviews'), reviews);
  } catch (e) {
    showToast(typeof userFacingError === 'function' ? userFacingError(e) : (e?.message || 'Не вышло'));
  }
}

async function gameDetailToggleFollow(el) {
  const authorId = el?.dataset?.authorId;
  if (!authorId || authorId === USER?.id) return;
  const was = typeof followedSet !== 'undefined' && followedSet.has(authorId);
  if (was) followedSet.delete(authorId);
  else followedSet.add(authorId);
  if (typeof saveSet === 'function' && typeof STORAGE_KEYS !== 'undefined') {
    saveSet(STORAGE_KEYS.followed, followedSet);
  }
  el.textContent = was ? '+ Подписаться на автора' : 'Вы подписаны';
  el.classList.toggle('following', !was);
  try {
    await (was ? API.unfollow(authorId) : API.follow(authorId));
    showToast(was ? 'Отписались' : 'Подписка оформлена');
    if (typeof updateOverlay === 'function') updateOverlay();
  } catch (e) {
    if (was) followedSet.add(authorId);
    else followedSet.delete(authorId);
    if (typeof saveSet === 'function' && typeof STORAGE_KEYS !== 'undefined') {
      saveSet(STORAGE_KEYS.followed, followedSet);
    }
    el.textContent = was ? 'Вы подписаны' : '+ Подписаться на автора';
    el.classList.toggle('following', was);
    showToast(typeof userFacingError === 'function' ? userFacingError(e) : 'Не вышло');
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
    try {
      await deleteGame(gameId, title, playUrl);
    } finally {
      closeGameDetail();
    }
  } else {
    closeGameDetail();
  }
}

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
