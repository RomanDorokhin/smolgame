/** Полноэкранная карточка игры + отзывы в ленте (чип / drawer). */

let _gameDetailId = null;
let _feedReviewsOpen = false;

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

function tf() {
  const globalT = window.t || window.T || window.i18n;
  return typeof globalT === 'function' ? globalT : (k) => k;
}

async function fetchGameReviews(gameId) {
  try {
    const data = await API.gameReviews(gameId);
    return Array.isArray(data?.reviews) ? data.reviews : [];
  } catch (e) {
    console.warn('[FeedReviews] Silent fetch fail:', e.message || e);
    // Возвращаем null вместо [], чтобы отличить «пусто» от «ошибки сети»
    return null;
  }
}

async function loadFeedReviewCount() {
  const chip = document.getElementById('feedReviewCount');
  if (!chip || !Array.isArray(window.GAMES) || window.GAMES.length === 0) return;
  const g = GAMES[window.currentIdx];
  if (!g?.id) return;
  
  try {
    const list = await fetchGameReviews(g.id);
    // Если list === null (ошибка сети), просто не обновляем счетчик
    if (Array.isArray(list)) {
      chip.textContent = String(list.length);
    }
  } catch (e) {
    // Тихо игнорируем ошибки счетчика
  }
}

async function openFeedReviewsDrawer() {
  const drawer = document.getElementById('feed-reviews-drawer');
  const backdrop = document.getElementById('feed-reviews-backdrop');
  const listEl = document.getElementById('feedReviewsDrawerList');
  const input = document.getElementById('feedReviewInput');
  
  if (!drawer || !listEl) return;

  // 1. Мгновенно даем фокус (TikTok-style), пока еще не ушли в сеть
  drawer.hidden = false;
  drawer.setAttribute('aria-hidden', 'false');
  if (backdrop) {
    backdrop.hidden = false;
    backdrop.onclick = closeFeedReviewsDrawer;
  }
  
  if (input) {
    input.focus();
    // На iOS/Android иногда нужно пнуть еще раз через 0мс
    setTimeout(() => input.focus(), 0);
  }
  
  // 2. Определяем игру
  const g = Array.isArray(window.GAMES) ? window.GAMES[window.currentIdx] : null;
  if (!g?.id) {
    listEl.innerHTML = '<div class="feed-reviews-empty">Игра не найдена</div>';
    return;
  }
  
  const i18n = tf();
  const loadingText = typeof i18n === 'function' ? i18n('gd_reviews_loading') : 'Загрузка отзывов...';
  listEl.innerHTML = `<div class="feed-reviews-loading">${esc(loadingText)}</div>`;

  try {
    // 3. Грузим отзывы с форсированным сбросом кэша
    const list = await fetchGameReviews(g.id);
    
    // Если list === null, значит была ошибка сети
    if (list === null) {
      const errTxt = (typeof i18n === 'function' ? i18n('err_load') : null) || 'Ошибка загрузки. Проверь интернет.';
      listEl.innerHTML = `<div class="feed-reviews-empty">${esc(errTxt)}</div>`;
      return;
    }

    const chipNum = document.getElementById('feedReviewCount');
    if (chipNum) chipNum.textContent = String(list.length);

    if (list.length === 0) {
      const emptyTxt = typeof i18n === 'function' ? i18n('gd_reviews_empty_drawer') : 'Отзывов пока нет. Будь первым!';
      listEl.innerHTML = `<div class="feed-reviews-empty">${esc(emptyTxt)}</div>`;
    } else {
      const html = list
        .map(r => {
          if (!r) return '';
          const author = esc(r.authorName || (typeof i18n === 'function' ? i18n('gd_player') : 'Игрок'));
          const firstChar = author.charAt(0).toUpperCase();
          const date = esc(formatGameDate(r.createdAt));
          const body = esc(r.body || '');
          if (!body && author === 'Игрок') return '';
          
          return `
            <div class="feed-review-item">
              <div class="feed-review-avatar">${firstChar}</div>
              <div class="feed-review-content">
                <span class="feed-review-author">${author}</span>
                <p class="feed-review-body">${body}</p>
                <div class="feed-review-footer">${date}</div>
              </div>
            </div>`;
        })
        .filter(Boolean)
        .join('');

      const emptyTxtFallback = typeof i18n === 'function' ? i18n('gd_reviews_empty_drawer') : 'Отзывов пока нет.';
      listEl.innerHTML = html || `<div class="feed-reviews-empty">${esc(emptyTxtFallback)}</div>`;
    }
  } catch (err) {
    console.error('[FeedReviews] Fatal Error:', err);
    const fatalErr = (typeof i18n === 'function' ? i18n('err_load') : null) || 'Ошибка загрузки';
    listEl.innerHTML = `<div class="feed-reviews-empty">${esc(fatalErr)}</div>`;
  }
}

function closeFeedReviewsDrawer() {
  const drawer = document.getElementById('feed-reviews-drawer');
  const backdrop = document.getElementById('feed-reviews-backdrop');
  if (!drawer) return;
  
  // Убираем фокус с инпута принудительно — это ПРЯЧЕТ клаву сразу
  const input = document.getElementById('feedReviewInput');
  if (input) {
    input.blur();
    input.value = ''; 
  }

  _feedReviewsOpen = false;
  drawer.hidden = true;
  drawer.setAttribute('aria-hidden', 'true');
  if (backdrop) backdrop.hidden = true;
}

async function submitFeedReview() {
  const ta = document.getElementById('feedReviewInput');
  const text = ta?.value?.trim() || '';
  const i18n = tf();
  if (!text) {
    showToast(typeof i18n === 'function' ? i18n('gd_review_empty') : 'Текст пуст');
    return;
  }
  if (!Array.isArray(window.GAMES) || GAMES.length === 0) return;
  const g = GAMES[window.currentIdx];
  if (!g?.id) return;
  try {
    await API.postGameReview(g.id, { body: text });
    if (ta) ta.value = '';
    showToast(typeof i18n === 'function' ? i18n('gd_review_saved') : 'Сохранено');
    await openFeedReviewsDrawer();
    await loadFeedReviewCount();
  } catch (e) {
    showToast(typeof userFacingError === 'function' ? userFacingError(e) : (e?.message || tf('try_again')));
  }
}

function renderGameDetailReviews(container, reviews) {
  if (!container) return;
  const t = tf();
  if (!reviews.length) {
    container.innerHTML = `<p class="game-detail-reviews-empty">${esc(t('gd_reviews_empty_page'))}</p>`;
    return;
  }
  container.innerHTML = reviews
    .map(
      r => `
    <div class="game-detail-review">
      <div class="game-detail-review-meta"><span>${esc(r.authorName || t('gd_player'))}</span><span>${esc(formatGameDate(r.createdAt))}</span></div>
      <p>${esc(r.body || '')}</p>
    </div>`
    )
    .join('');
}

async function openGameDetail(gameId) {
  const t = typeof window.t === 'function' ? window.t : k => k;
  
  if (typeof showToast === 'function') showToast('openGameDetail fired for ' + gameId);
  if (!gameId) {
    if (typeof showToast === 'function') showToast('No gameId provided');
    return;
  }

  const screen = document.getElementById('game-detail-screen');
  if (!screen) {
    if (typeof showToast === 'function') showToast('No screen found');
    return;
  }
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

  try {
    hero.innerHTML = '<div class="game-detail-hero-skel"></div>';
    titleEl.textContent = '…';
    if (topTitle) topTitle.textContent = t('game_word');
    descEl.textContent = '';
    badges.innerHTML = '';
    meta.innerHTML = '';
    authorCard.innerHTML = '';
    if (reviewsEl) reviewsEl.innerHTML = '';
    if (reviewForm) reviewForm.hidden = false;
    if (ownerActions) {
      ownerActions.hidden = true;
      ownerActions.innerHTML = '';
    }

    window._gameDetailReturnTab = window._activeMainTab || 'feed';
    ['games-library-screen', 'search-screen', 'profile-screen', 'author-screen']
      .forEach(id => document.getElementById(id)?.classList.remove('open'));
    if (typeof syncBodyFeedHiddenUnderSheet === 'function') syncBodyFeedHiddenUnderSheet();

    screen.hidden = false;
    screen.setAttribute('aria-hidden', 'false');
    document.body.classList.add('game-detail-open');

    const inp = document.getElementById('gameDetailReviewInput');
    if (inp) inp.value = '';
  } catch (syncErr) {
    if (typeof showToast === 'function') showToast('Crash: ' + syncErr.message);
    console.error('DOM setup crash:', syncErr);
    return;
  }

  let game;
  try {
    if (typeof showToast === 'function') showToast('Fetching API.game...');
    console.log('[GameDetail] Fetching game:', gameId);
    const data = await API.game(gameId);
    game = data?.game;
    if (!game?.id) throw new Error(t('gd_no_data'));
    if (typeof showToast === 'function') showToast('Game loaded successfully!');
    console.log('[GameDetail] Game loaded:', game);
  } catch (e) {
    console.error('[GameDetail] Load error:', e);
    showToast(typeof userFacingError === 'function' ? userFacingError(e) : t('err_load'));
    closeGameDetail();
    return;
  }


  const gword = t('game_word');
  titleEl.textContent = game.title || gword;
  if (topTitle) topTitle.textContent = game.title || gword;
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
  const genreShown =
    game.genre && typeof genreDisplayFromApi === 'function' ? genreDisplayFromApi(game.genre) : game.genre || '';
  badges.innerHTML =
    badgeHtml +
    (genreShown ? `<span class="game-detail-badge game-detail-badge--muted">${esc(genreShown)}</span>` : '');

  const pubLine =
    st === 'published'
      ? t('gd_in_catalog', { date: formatGameDate(game.updatedAt ?? game.createdAt) })
      : st === 'pending'
        ? t('gd_pending_check')
        : t('gd_not_listed');
  const genreMeta =
    game.genre && typeof genreDisplayFromApi === 'function' ? genreDisplayFromApi(game.genre) : game.genre || '—';
  meta.innerHTML = `
    <div class="game-detail-meta-cell"><span class="game-detail-meta-k">${esc(t('meta_genre'))}</span><span class="game-detail-meta-v">${esc(genreMeta)}</span></div>
    <div class="game-detail-meta-cell"><span class="game-detail-meta-k">${esc(t('meta_likes'))}</span><span class="game-detail-meta-v">${esc(fmtNum(game.likes))}</span></div>
    <div class="game-detail-meta-cell"><span class="game-detail-meta-k">${esc(t('meta_plays'))}</span><span class="game-detail-meta-v">${esc(fmtNum(game.plays))}</span></div>
  `;

  const av = game.authorAvatar;
  const avUrl = typeof avatarImgUrl === 'function' ? avatarImgUrl(av) : null;
  const avHtml = avUrl
    ? `<div class="game-detail-author-av"><img src="${esc(avUrl)}" alt="" referrerpolicy="no-referrer"></div>`
    : `<div class="game-detail-author-av game-detail-author-av--txt">${esc(String(game.authorName || '?').slice(0, 1))}</div>`;
  const following = typeof followedSet !== 'undefined' && game.authorId && followedSet.has(game.authorId);
  const isSelf = Boolean(game.authorId && USER?.id && sameTelegramUserId(game.authorId, USER.id));
  const followLabel = following ? t('follow_done') : t('follow_add_author');
  // Компактная карточка: аватар + имя + кнопка подписки в одну строку
  authorCard.innerHTML = `
    ${avHtml}
    <div class="game-detail-author-text">
      <div class="game-detail-author-name">${esc(game.authorName || t('gd_author'))}</div>
      ${game.authorHandle ? `<div class="game-detail-author-handle">@${esc(game.authorHandle)}</div>` : ''}
    </div>
    <button type="button" class="sg-btn sg-btn--secondary game-detail-follow ${following ? 'following' : ''}" data-action="game-detail-follow" data-author-id="${esc(game.authorId)}" ${isSelf ? 'hidden' : ''}>${esc(followLabel)}</button>
  `;


  if (st === 'published' && playBtn) playBtn.hidden = false;
  else if (playBtn) playBtn.hidden = true;

  const reviews = await fetchGameReviews(gameId);
  renderGameDetailReviews(reviewsEl, reviews);

  const isOwner = Boolean(USER?.id && sameTelegramUserId(game.authorId, USER.id));
  if (reviewForm) reviewForm.hidden = isOwner;
  if (ownerActions) {
    if (isOwner) {
      ownerActions.hidden = false;
      ownerActions.innerHTML = `
      <p class="game-detail-owner-lead">${esc(t('gd_owner_your_game'))}</p>
      <div class="game-detail-owner-btns">
        <button type="button" class="sg-btn sg-btn--secondary" data-action="game-detail-owner-edit" data-game-id="${esc(game.id)}">${esc(t('gd_edit'))}</button>
        <button type="button" class="sg-btn sg-btn--secondary" data-action="game-detail-owner-feed" data-game-id="${esc(game.id)}">${esc(t('gd_open_in_feed'))}</button>
        <button type="button" class="sg-btn sg-btn--ghost game-detail-owner-del" data-action="game-detail-owner-delete" data-game-id="${esc(game.id)}" data-game-title="${esc(game.title || '')}" data-game-url="${esc(game.url || '')}">${esc(t('gd_delete'))}</button>
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
  // Возвращаемся на вкладку, откуда открыли карточку
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
  const t = tf();
  if (!id || !text) {
    showToast(t('gd_review_empty'));
    return;
  }
  try {
    await API.postGameReview(id, { text });
    ta.value = '';
    showToast(t('gd_review_saved'));
    const reviews = await fetchGameReviews(id);
    renderGameDetailReviews(document.getElementById('gameDetailReviews'), reviews);
  } catch (e) {
    showToast(typeof userFacingError === 'function' ? userFacingError(e) : (e?.message || t('try_again')));
  }
}

async function gameDetailToggleFollow(el) {
  const authorId = el?.dataset?.authorId;
  if (!authorId || sameTelegramUserId(authorId, USER?.id)) return;
  const t = tf();
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
