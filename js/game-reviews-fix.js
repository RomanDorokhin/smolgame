/** Полноэкранная карточка игры + отзывы в ленте (чип / drawer). 
 * ФАЙЛ-ФИКС ДЛЯ БОРЬБЫ С КЭШЕМ И ОШИБКОЙ 't is not a function'
 */

let _gameDetailId = null;
let _feedReviewsOpen = false;
let _replyingToId = null;
let _editingReviewId = null;

// Хелпер для экранирования
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Форматирование даты
function formatGameDate(ts) {
  if (ts == null || !Number.isFinite(Number(ts))) return '—';
  try {
    const d = new Date(Number(ts) * 1000);
    const isEn = typeof window.getLang === 'function' && window.getLang() === 'en';
    const loc = isEn ? 'en-US' : 'ru-RU';
    return d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return '—';
  }
}

// Глобальный словарь
function getReviewText(key) {
  const isEn = typeof window.getLang === 'function' && window.getLang() === 'en';
  const dict = {
    'gd_reviews_loading': isEn ? 'Loading reviews...' : 'Загрузка отзывов...',
    'gd_reviews_empty_drawer': isEn ? 'No reviews yet. Be the first!' : 'Отзывов пока нет. Будь первым!',
    'gd_player': isEn ? 'Player' : 'Игрок',
    'err_load': isEn ? 'Load failed. Check internet.' : 'Ошибка загрузки. Проверь интернет.',
    'gd_review_empty': isEn ? 'Review is empty' : 'Отзыв пустой',
    'gd_review_saved': isEn ? 'Review saved!' : 'Отзыв сохранен!',
    'gd_author': isEn ? 'Author' : 'Автор',
    'follow_done': isEn ? 'Following' : 'Вы подписаны',
    'follow_add_author': isEn ? 'Follow' : 'Подписаться',
    'game_word': isEn ? 'Game' : 'Игра',
    'gd_no_desc': isEn ? 'No description' : 'Нет описания',
    'gd_no_data': isEn ? 'No data' : 'Не удалось загрузить данные',
    'pending_banner': isEn ? 'Under Review' : 'На проверке',
    'gd_badge_rejected': isEn ? 'Rejected' : 'Отклонено',
    'free': isEn ? 'Free' : 'Бесплатно',
    'gd_in_catalog': isEn ? 'In catalog since {date}' : 'В каталоге с {date}',
    'gd_pending_check': isEn ? 'Pending check' : 'Ждет проверки',
    'gd_not_listed': isEn ? 'Not listed' : 'Не в каталоге',
    'meta_genre': isEn ? 'Genre' : 'Жанр',
    'meta_likes': isEn ? 'Likes' : 'Лайки',
    'meta_plays': isEn ? 'Plays' : 'Запуски',
    'gd_owner_your_game': isEn ? 'This is your game' : 'Это ваша игра',
    'gd_edit': isEn ? 'Edit' : 'Изменить',
    'gd_open_in_feed': isEn ? 'Open in Feed' : 'Открыть в ленте',
    'gd_delete': isEn ? 'Delete' : 'Удалить',
    'unsubscribed': isEn ? 'Unsubscribed' : 'Вы отписались',
    'subscribed': isEn ? 'Subscribed!' : 'Подписка оформлена!',
    'try_again': isEn ? 'Try again' : 'Попробуй еще раз',
    'gd_reviews_empty_page': isEn ? 'No reviews yet' : 'Отзывов пока нет',
    'reply': isEn ? 'Reply' : 'Ответить',
    'edit': isEn ? 'Edit' : 'Изм.',
    'delete': isEn ? 'Delete' : 'Удл.',
    'cancel': isEn ? 'Cancel' : 'Отмена',
    'replying_to': isEn ? 'Replying to {name}' : 'Ответ {name}',
    'editing_review': isEn ? 'Editing review' : 'Редактирование'
  };
  return dict[key] || key;
}

function getReviewTextFmt(key, replacements = {}) {
  let text = getReviewText(key);
  for (const k in replacements) {
    text = text.replace('{' + k + '}', replacements[k]);
  }
  return text;
}

async function fetchGameReviews(gameId) {
  try {
    const data = await API.gameReviews(gameId);
    return Array.isArray(data?.reviews) ? data.reviews : [];
  } catch (e) {
    console.warn('[FeedReviews] Silent fetch fail:', e.message || e);
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
    if (Array.isArray(list)) chip.textContent = String(list.length);
  } catch (e) {}
}

/** Рендеринг одного отзыва */
function renderReviewItem(r, isReply = false) {
  if (!r) return '';
  const author = esc(r.authorName || getReviewText('gd_player'));
  const firstChar = author.charAt(0).toUpperCase();
  const date = esc(formatGameDate(r.createdAt));
  const body = esc(r.body || '');
  if (!body && author === getReviewText('gd_player')) return '';
  
  const isMy = Boolean(r.authorId && USER?.id && sameTelegramUserId(r.authorId, USER.id));
  const isAdmin = typeof window.USER_IS_ADMIN !== 'undefined' ? window.USER_IS_ADMIN : false;

  return `
    <div class="feed-review-item ${isReply ? 'feed-review-item--reply' : ''}" id="review-${r.id}">
      <div class="feed-review-avatar">${firstChar}</div>
      <div class="feed-review-content">
        <div class="feed-review-header">
          <span class="feed-review-author">${author}</span>
          <span class="feed-review-date">${date}</span>
        </div>
        <p class="feed-review-body">${body}</p>
        <div class="feed-review-actions">
          <button class="feed-review-action" onclick="setReviewReply('${r.id}', '${author.replace(/'/g, "\\'")}')">${getReviewText('reply')}</button>
          ${isMy ? `<button class="feed-review-action" onclick="setReviewEdit('${r.id}', '${body.replace(/'/g, "\\'")}')">${getReviewText('edit')}</button>` : ''}
          ${isMy || isAdmin ? `<button class="feed-review-action feed-review-action--danger" onclick="deleteFeedReview('${r.id}')">${getReviewText('delete')}</button>` : ''}
        </div>
      </div>
    </div>`;
}

async function openFeedReviewsDrawer() {
  const drawer = document.getElementById('feed-reviews-drawer');
  const backdrop = document.getElementById('feed-reviews-backdrop');
  const listEl = document.getElementById('feedReviewsDrawerList');
  const input = document.getElementById('feedReviewInput');
  if (!drawer || !listEl) return;

  _feedReviewsOpen = true;
  drawer.hidden = false;
  drawer.setAttribute('aria-hidden', 'false');
  
  // Сбрасываем состояния при открытии
  cancelReviewAction();

  setTimeout(() => {
    if (input) {
      input.focus();
      setTimeout(() => input.focus(), 50);
    }
  }, 150);

  if (backdrop) {
    backdrop.hidden = false;
    backdrop.onclick = closeFeedReviewsDrawer;
  }
  
  const g = Array.isArray(window.GAMES) ? window.GAMES[window.currentIdx] : null;
  if (!g?.id) {
    listEl.innerHTML = '<div class="feed-reviews-empty">Game not found</div>';
    return;
  }
  
  listEl.innerHTML = `<div class="feed-reviews-loading">${esc(getReviewText('gd_reviews_loading'))}</div>`;

  try {
    const all = await fetchGameReviews(g.id);
    if (all === null) {
      listEl.innerHTML = `<div class="feed-reviews-empty">${esc(getReviewText('err_load'))}</div>`;
      return;
    }
    const chipNum = document.getElementById('feedReviewCount');
    if (chipNum) chipNum.textContent = String(all.length);

    if (all.length === 0) {
      listEl.innerHTML = `<div class="feed-reviews-empty">${esc(getReviewText('gd_reviews_empty_drawer'))}</div>`;
    } else {
      // Строим дерево: сначала корневые, потом под ними ответы
      const roots = all.filter(r => !r.parentId);
      const replies = all.filter(r => r.parentId);
      
      let html = '';
      roots.forEach(root => {
        html += renderReviewItem(root, false);
        const childs = replies.filter(rep => rep.parentId === root.id);
        childs.reverse().forEach(child => {
          html += renderReviewItem(child, true);
        });
      });
      
      listEl.innerHTML = html || `<div class="feed-reviews-empty">${esc(getReviewText('gd_reviews_empty_drawer'))}</div>`;
    }
  } catch (err) {
    listEl.innerHTML = `<div class="feed-reviews-empty">${esc(getReviewText('err_load'))}</div>`;
  }
}

function setReviewReply(id, name) {
  _replyingToId = id;
  _editingReviewId = null;
  const bar = document.getElementById('feedReviewActionBar');
  const txt = document.getElementById('feedReviewActionText');
  const input = document.getElementById('feedReviewInput');
  if (bar && txt) {
    txt.textContent = getReviewTextFmt('replying_to', { name });
    bar.hidden = false;
  }
  if (input) {
    input.focus();
    input.placeholder = `@${name}, ...`;
  }
}

function setReviewEdit(id, currentText) {
  _editingReviewId = id;
  _replyingToId = null;
  const bar = document.getElementById('feedReviewActionBar');
  const txt = document.getElementById('feedReviewActionText');
  const input = document.getElementById('feedReviewInput');
  if (bar && txt) {
    txt.textContent = getReviewText('editing_review');
    bar.hidden = false;
  }
  if (input) {
    input.value = currentText;
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
    input.placeholder = getReviewText('gd_reviews_empty_page'); // Fallback placeholder
    input.value = '';
  }
}

async function submitFeedReview() {
  const ta = document.getElementById('feedReviewInput');
  const text = ta?.value?.trim() || '';
  if (!text) {
    showToast(getReviewText('gd_review_empty'));
    return;
  }
  const g = Array.isArray(window.GAMES) ? window.GAMES[window.currentIdx] : null;
  if (!g?.id) return;

  const editingId = _editingReviewId;
  const replyingId = _replyingToId;

  // Оптимистичное обновление
  const listEl = document.getElementById('feedReviewsDrawerList');
  if (listEl && !editingId) {
    const author = esc(window.USER?.display_name || window.USER?.first_name || getReviewText('gd_player'));
    const firstChar = author.charAt(0).toUpperCase();
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
    setTimeout(() => openFeedReviewsDrawer(), 800);
    
  } catch (e) {
    showToast(getReviewText('try_again'));
    await openFeedReviewsDrawer();
  }
}

async function deleteFeedReview(id) {
  if (!confirm(getReviewText('delete') + '?')) return;
  try {
    await API.deleteReview(id);
    await openFeedReviewsDrawer();
    await loadFeedReviewCount();
  } catch (e) {
    showToast(getReviewText('try_again'));
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
  drawer.hidden = true;
  drawer.setAttribute('aria-hidden', 'true');
  if (backdrop) backdrop.hidden = true;
  cancelReviewAction();
}

function renderGameDetailReviews(container, reviews) {
  if (!container) return;
  if (!reviews.length) {
    container.innerHTML = `<p class="game-detail-reviews-empty">${esc(getReviewText('gd_reviews_empty_page'))}</p>`;
    return;
  }
  // В детальной карточке просто плоский список для простоты
  container.innerHTML = reviews
    .map(r => `
    <div class="game-detail-review">
      <div class="game-detail-review-meta"><span>${esc(r.authorName || getReviewText('gd_player'))}</span><span>${esc(formatGameDate(r.createdAt))}</span></div>
      <p>${esc(r.body || '')}</p>
    </div>`)
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
  if (topTitle) topTitle.textContent = getReviewText('game_word');
  descEl.textContent = '';
  badges.innerHTML = '';
  meta.innerHTML = '';
  authorCard.innerHTML = '';
  if (reviewsEl) reviewsEl.innerHTML = '';
  
  window._gameDetailReturnTab = window._activeMainTab || 'feed';
  ['games-library-screen', 'search-screen', 'profile-screen', 'author-screen']
    .forEach(id => document.getElementById(id)?.classList.remove('open'));
  
  screen.hidden = false;
  screen.setAttribute('aria-hidden', 'false');
  document.body.classList.add('game-detail-open');

  try {
    const data = await API.game(gameId);
    const game = data?.game;
    if (!game?.id) throw new Error(getReviewText('gd_no_data'));

    titleEl.textContent = game.title || getReviewText('game_word');
    if (topTitle) topTitle.textContent = game.title || getReviewText('game_word');
    descEl.textContent = (game.description && String(game.description).trim()) || getReviewText('gd_no_desc');

    const img = game.imageUrl
      ? `<img src="${esc(game.imageUrl)}" alt="" class="game-detail-hero-img">`
      : `<div class="game-detail-hero-ph">${typeof genreIconForGame === 'function' ? genreIconForGame(game) : ''}</div>`;
    hero.innerHTML = img;

    const st = game.status || '';
    let bHtml = '';
    if (st === 'pending') bHtml = `<span class="game-detail-badge game-detail-badge--pending">${esc(getReviewText('pending_banner'))}</span>`;
    else if (st === 'rejected') bHtml = `<span class="game-detail-badge game-detail-badge--rejected">${esc(getReviewText('gd_badge_rejected'))}</span>`;
    else bHtml = `<span class="game-detail-badge game-detail-badge--free">${esc(getReviewText('free'))}</span>`;

    const genreS = game.genre && typeof genreDisplayFromApi === 'function' ? genreDisplayFromApi(game.genre) : game.genre || '';
    badges.innerHTML = bHtml + (genreS ? `<span class="game-detail-badge game-detail-badge--muted">${esc(genreS)}</span>` : '');

    meta.innerHTML = `
      <div class="game-detail-meta-cell"><span class="game-detail-meta-k">${esc(getReviewText('meta_genre'))}</span><span class="game-detail-meta-v">${esc(genreS || '—')}</span></div>
      <div class="game-detail-meta-cell"><span class="game-detail-meta-k">${esc(getReviewText('meta_likes'))}</span><span class="game-detail-meta-v">${esc(fmtNum(game.likes))}</span></div>
      <div class="game-detail-meta-cell"><span class="game-detail-meta-k">${esc(getReviewText('meta_plays'))}</span><span class="game-detail-meta-v">${esc(fmtNum(game.plays))}</span></div>
    `;

    const av = game.authorAvatar;
    const avUrl = typeof avatarImgUrl === 'function' ? avatarImgUrl(av) : null;
    const avH = avUrl ? `<div class="game-detail-author-av"><img src="${esc(avUrl)}" alt="" referrerpolicy="no-referrer"></div>` : `<div class="game-detail-author-av game-detail-author-av--txt">${esc(String(game.authorName || '?').slice(0, 1))}</div>`;
    const following = typeof followedSet !== 'undefined' && game.authorId && followedSet.has(game.authorId);
    const isSelf = Boolean(game.authorId && USER?.id && sameTelegramUserId(game.authorId, USER.id));
    const fLabel = following ? getReviewText('follow_done') : getReviewText('follow_add_author');
    
    authorCard.innerHTML = `
      ${avH}
      <div class="game-detail-author-text">
        <div class="game-detail-author-name">${esc(game.authorName || getReviewText('gd_author'))}</div>
        ${game.authorHandle ? `<div class="game-detail-author-handle">@${esc(game.authorHandle)}</div>` : ''}
      </div>
      <button type="button" class="sg-btn sg-btn--secondary game-detail-follow ${following ? 'following' : ''}" data-action="game-detail-follow" data-author-id="${esc(game.authorId)}" ${isSelf ? 'hidden' : ''}>${esc(fLabel)}</button>
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
          <p class="game-detail-owner-lead">${esc(getReviewText('gd_owner_your_game'))}</p>
          <div class="game-detail-owner-btns">
            <button type="button" class="sg-btn sg-btn--secondary" data-action="game-detail-owner-edit" data-game-id="${esc(game.id)}">${esc(getReviewText('gd_edit'))}</button>
            <button type="button" class="sg-btn sg-btn--secondary" data-action="game-detail-owner-feed" data-game-id="${esc(game.id)}">${esc(getReviewText('gd_open_in_feed'))}</button>
            <button type="button" class="sg-btn sg-btn--ghost game-detail-owner-del" data-action="game-detail-owner-delete" data-game-id="${esc(game.id)}" data-game-title="${esc(game.title || '')}" data-game-url="${esc(game.url || '')}">${esc(getReviewText('gd_delete'))}</button>
          </div>
        `;
      } else {
        ownerActions.hidden = true;
      }
    }
  } catch (e) {
    showToast(getReviewText('err_load'));
    closeGameDetail();
  }
}

function closeGameDetail() {
  const screen = document.getElementById('game-detail-screen');
  if (!screen) return;
  screen.hidden = true;
  screen.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('game-detail-open');
  _gameDetailId = null;
  const returnTo = window._gameDetailReturnTab || 'feed';
  if (typeof switchTab === 'function') switchTab(returnTo);
}

async function gameDetailPlay() {
  const id = _gameDetailId;
  if (!id) return;
  closeGameDetail();
  if (typeof switchTab === 'function') switchTab('feed');
  let idx = typeof GAMES !== 'undefined' ? GAMES.findIndex(g => g.id === id) : -1;
  if (idx >= 0 && typeof goTo === 'function') goTo(idx, false);
}

async function gameDetailSubmitReview() {
  const id = _gameDetailId;
  const ta = document.getElementById('gameDetailReviewInput');
  const text = ta?.value?.trim() || '';
  if (!id || !text) {
    showToast(getReviewText('gd_review_empty'));
    return;
  }
  try {
    await API.postGameReview(id, { body: text });
    ta.value = '';
    showToast(getReviewText('gd_review_saved'));
    const revs = await fetchGameReviews(id);
    renderGameDetailReviews(document.getElementById('gameDetailReviews'), revs);
  } catch (e) {
    showToast(getReviewText('try_again'));
  }
}

async function gameDetailToggleFollow(el) {
  const authorId = el?.dataset?.authorId;
  if (!authorId || sameTelegramUserId(authorId, USER?.id)) return;
  const was = typeof followedSet !== 'undefined' && followedSet.has(authorId);
  if (was) followedSet.delete(authorId); else followedSet.add(authorId);
  el.textContent = was ? getReviewText('follow_add_author') : getReviewText('follow_done');
  el.classList.toggle('following', !was);
  try {
    await (was ? API.unfollow(authorId) : API.follow(authorId));
    showToast(was ? getReviewText('unsubscribed') : getReviewText('subscribed'));
  } catch (e) {
    showToast(getReviewText('try_again'));
  }
}

async function gameDetailOwnerEdit(gameId) {
  closeGameDetail();
  if (typeof openProfile === 'function') openProfile();
  setTimeout(() => { if (typeof toggleProfileGameEditor === 'function') toggleProfileGameEditor(gameId); }, 280);
}

async function gameDetailOwnerFeed(gameId) {
  closeGameDetail();
  if (typeof switchTab === 'function') switchTab('feed');
  let idx = typeof GAMES !== 'undefined' ? GAMES.findIndex(g => g.id === gameId) : -1;
  if (idx >= 0 && typeof goTo === 'function') goTo(idx, false);
}

async function gameDetailOwnerDelete(gameId, title, playUrl) {
  if (typeof deleteGame === 'function') {
    try { await deleteGame(gameId, title, playUrl); } finally { closeGameDetail(); }
  } else { closeGameDetail(); }
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
window.setReviewReply = setReviewReply;
window.setReviewEdit = setReviewEdit;
window.cancelReviewAction = cancelReviewAction;
window.deleteFeedReview = deleteFeedReview;
