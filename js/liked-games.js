/**
 * Экран «Игры»: лайкнутые и недавно открытые (сервер).
 */
var tf = typeof window.t === 'function' ? window.t : k => k;

function renderGamesGridSection(gridId, games, emptyTitle, emptySub, emptyCtaTab) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  if (games.length === 0) {
    const heart =
      gridId === 'likedGamesGrid' && typeof sgStatHeartSvg === 'function'
        ? `<span class="liked-games-empty-heart">${sgStatHeartSvg()}</span>`
        : '';
    grid.innerHTML = `
      <div class="sg-empty-state sg-empty-state--grid" style="grid-column:1/-1">
        ${heart ? `<div class="sg-empty-state-icon" aria-hidden="true">${heart}</div>` : ''}
        <div class="sg-empty-state-title">${esc(emptyTitle)}</div>
        <div class="sg-empty-state-sub">${esc(emptySub)}</div>
        ${emptyCtaTab ? `<button type="button" class="empty-btn" data-action="switch-tab" data-tab="${esc(emptyCtaTab)}">${esc(tf('to_feed'))}</button>` : ''}
      </div>`;
    return;
  }
  grid.innerHTML = games
    .map(
      g => `
    <div class="game-card sg-store-card" data-action="open-game-detail" data-game-id="${esc(g.id)}">
      <div class="game-card-thumb sg-store-card-thumb">${typeof gameThumbHtml === 'function' ? gameThumbHtml(g) : ''}</div>
      ${typeof sgStorefrontCardInfoHtml === 'function' ? sgStorefrontCardInfoHtml(g, { author: false, desc: true }) : `<div class="game-card-info"><div class="game-card-name">${esc(g.title)}</div><div class="game-card-stats"><span class="sg-mini-stat">${typeof sgStatHeartSvg === 'function' ? sgStatHeartSvg() : ''}${typeof fmtNum === 'function' ? fmtNum(g.likes) : g.likes}</span><span class="sg-mini-sep">·</span><span class="sg-mini-stat">${typeof sgStatEyeSvg === 'function' ? sgStatEyeSvg() : ''}${typeof fmtNum === 'function' ? fmtNum(g.plays) : g.plays}</span></div></div>`}
    </div>`
    )
    .join('');
}

async function loadGamesLibrary() {
  const likedGrid = document.getElementById('likedGamesGrid');
  const playedGrid = document.getElementById('playedGamesGrid');
  if (likedGrid) {
    likedGrid.innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:24px 0;color:var(--muted);font-size:14px;">' + esc(tf('loading')) + '</div>';
  }
  if (playedGrid) {
    playedGrid.innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:24px 0;color:var(--muted);font-size:14px;">' + esc(tf('loading')) + '</div>';
  }
  try {
    let liked = [];
    let played = [];
    if (typeof API.gamesLibrary === 'function') {
      try {
        const batch = await API.gamesLibrary();
        liked = Array.isArray(batch?.likedGames) ? batch.likedGames : [];
        played = Array.isArray(batch?.playedGames) ? batch.playedGames : [];
      } catch (e) {
        const [likedData, playedData] = await Promise.all([
          API.likedGames(),
          API.playedGames().catch(() => ({ games: [] })),
        ]);
        liked = Array.isArray(likedData?.games) ? likedData.games : [];
        played = Array.isArray(playedData?.games) ? playedData.games : [];
      }
    } else {
      const [likedData, playedData] = await Promise.all([
        API.likedGames(),
        API.playedGames().catch(() => ({ games: [] })),
      ]);
      liked = Array.isArray(likedData?.games) ? likedData.games : [];
      played = Array.isArray(playedData?.games) ? playedData.games : [];
    }
    renderGamesGridSection(
      'likedGamesGrid',
      liked,
      tf('liked_empty_title'),
      tf('liked_empty_sub'),
      'feed'
    );
    renderGamesGridSection(
      'playedGamesGrid',
      played,
      tf('played_empty_title'),
      tf('played_empty_sub'),
      'feed'
    );
  } catch (e) {
    const msg = typeof userFacingError === 'function' ? userFacingError(e) : (e?.message || 'Ошибка');
    const errHtml = `<div class="sg-empty-state sg-empty-state--grid" style="grid-column:1/-1">
      <div class="sg-empty-state-title">${esc(tf('load_failed_title'))}</div>
      <div class="sg-empty-state-sub">${esc(msg)}</div>
    </div>`;
    if (likedGrid) likedGrid.innerHTML = errHtml;
    if (playedGrid) playedGrid.innerHTML = errHtml;
  }
}

function refreshGamesLibraryScreen() {
  const screen = document.getElementById('games-library-screen');
  if (screen?.classList.contains('open')) loadGamesLibrary();
}

async function openGameFromLibrary(gameId) {
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

window.loadGamesLibrary = loadGamesLibrary;
window.renderGamesGridSection = renderGamesGridSection;
window.refreshGamesLibraryScreen = refreshGamesLibraryScreen;
window.openGameFromLibrary = openGameFromLibrary;
/* backwards compat */
window.loadLikedGamesList = loadGamesLibrary;
window.refreshLikedGamesScreen = refreshGamesLibraryScreen;
