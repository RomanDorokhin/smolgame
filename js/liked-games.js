/**
 * Экран «Игры»: опубликованные игры, которые пользователь лайкнул (сервер + таблица likes).
 */
async function loadLikedGamesList() {
  const grid = document.getElementById('likedGamesGrid');
  if (!grid) return;
  grid.innerHTML =
    '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:var(--muted);font-size:14px;">Загрузка…</div>';
  try {
    const data = await API.likedGames();
    const games = Array.isArray(data?.games) ? data.games : [];
    renderLikedGamesGrid(games);
  } catch (e) {
    grid.innerHTML = `<div class="sg-empty-state sg-empty-state--grid" style="grid-column:1/-1">
      <div class="sg-empty-state-title">Не загрузилось</div>
      <div class="sg-empty-state-sub">${esc(typeof userFacingError === 'function' ? userFacingError(e) : (e?.message || 'Ошибка'))}</div>
    </div>`;
  }
}

function renderLikedGamesGrid(games) {
  const grid = document.getElementById('likedGamesGrid');
  if (!grid) return;
  if (games.length === 0) {
    grid.innerHTML = `
      <div class="sg-empty-state sg-empty-state--grid" style="grid-column:1/-1">
        <div class="sg-empty-state-icon" aria-hidden="true">${typeof sgStatHeartSvg === 'function' ? `<span class="liked-games-empty-heart">${sgStatHeartSvg()}</span>` : ''}</div>
        <div class="sg-empty-state-title">Пока пусто</div>
        <div class="sg-empty-state-sub">Лайкни игры в ленте — они появятся здесь.</div>
        <button type="button" class="empty-btn" data-action="switch-tab" data-tab="feed">В ленту</button>
      </div>`;
    return;
  }
  grid.innerHTML = games
    .map(
      g => `
    <div class="game-card" data-action="open-game-liked" data-game-id="${esc(g.id)}">
      <div class="game-card-thumb">${typeof gameThumbHtml === 'function' ? gameThumbHtml(g) : ''}</div>
      <div class="game-card-info">
        <div class="game-card-name">${esc(g.title)}</div>
        <div class="game-card-stats"><span class="sg-mini-stat">${typeof sgStatHeartSvg === 'function' ? sgStatHeartSvg() : ''}${typeof fmtNum === 'function' ? fmtNum(g.likes) : g.likes}</span><span class="sg-mini-sep">·</span><span class="sg-mini-stat">${typeof sgStatEyeSvg === 'function' ? sgStatEyeSvg() : ''}${typeof fmtNum === 'function' ? fmtNum(g.plays) : g.plays}</span></div>
      </div>
    </div>`
    )
    .join('');
}

function refreshLikedGamesScreen() {
  const screen = document.getElementById('games-library-screen');
  if (screen?.classList.contains('open')) loadLikedGamesList();
}

async function openGameFromLikedList(gameId) {
  if (!gameId) return;
  if (typeof closeGamesLibrary === 'function') closeGamesLibrary();
  if (typeof switchTab === 'function') switchTab('feed');
  let idx = typeof GAMES !== 'undefined' ? GAMES.findIndex(g => g.id === gameId) : -1;
  if (idx === -1 && typeof injectGameIntoFeed === 'function') {
    await injectGameIntoFeed(gameId);
    idx = GAMES.findIndex(g => g.id === gameId);
  }
  if (idx >= 0 && typeof goTo === 'function') goTo(idx, false);
}

window.loadLikedGamesList = loadLikedGamesList;
window.renderLikedGamesGrid = renderLikedGamesGrid;
window.refreshLikedGamesScreen = refreshLikedGamesScreen;
window.openGameFromLikedList = openGameFromLikedList;
