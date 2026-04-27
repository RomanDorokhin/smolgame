function onSearch(query) {
  const results = document.getElementById('searchResults');
  const filtered = GAMES.filter(g => {
    const q = (query || '').toLowerCase();
    const matchQuery = !q
      || (g.title || '').toLowerCase().includes(q)
      || (g.authorName || '').toLowerCase().includes(q)
      || (g.authorHandle || '').toLowerCase().includes(q);
    const matchGenre = !window.selectedGenre
      || window.selectedGenre === 'Все'
      || g.genre === window.selectedGenre;
    return matchQuery && matchGenre;
  });

  if (filtered.length === 0) {
    results.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:var(--muted);font-size:14px;">Нет результатов</div>`;
    return;
  }

  results.innerHTML = filtered.map(g => `
    <div class="game-card" data-action="open-game" data-game-id="${esc(g.id)}">
      <div class="game-card-thumb">${gameThumbHtml(g)}</div>
      <div class="game-card-info">
        <div class="game-card-name">${esc(g.title)}</div>
        <div class="game-card-stats"><span class="sg-mini-stat">${sgStatHeartSvg()}${fmtNum(g.likes)}</span><span class="sg-mini-sep">·</span><span class="sg-mini-stat">${sgStatEyeSvg()}${fmtNum(g.plays)}</span></div>
      </div>
    </div>
  `).join('');
}

async function openGameFromSearch(gameId) {
  if (!gameId) return;
  closeSearch();
  if (typeof switchTab === 'function') switchTab('feed');
  let idx = GAMES.findIndex(g => g.id === gameId);
  if (idx === -1 && typeof injectGameIntoFeed === 'function') {
    await injectGameIntoFeed(gameId);
    idx = GAMES.findIndex(g => g.id === gameId);
  }
  if (idx >= 0 && typeof goTo === 'function') goTo(idx, false);
}

window.onSearch = onSearch;
window.openGameFromSearch = openGameFromSearch;
