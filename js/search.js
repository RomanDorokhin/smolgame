function onSearch(query) {
  const results = document.getElementById('searchResults');
  const filtered = GAMES.filter(g => {
    const q = (query || '').toLowerCase();
    const matchQuery = !q
      || g.title.toLowerCase().includes(q)
      || g.authorName.toLowerCase().includes(q);
    const matchGenre = !window.selectedGenre
      || window.selectedGenre === 'Все'
      || g.genre === window.selectedGenre;
    return matchQuery && matchGenre;
  });

  if (filtered.length === 0) {
    results.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:var(--muted);font-size:14px;">Ничего не найдено</div>`;
    return;
  }

  // NOTE: базовый шаблон, экранирование данных будет добавлено в security-проходе.
  results.innerHTML = filtered.map(g => `
    <div class="game-card" onclick="openGameFromSearch('${g.id}')">
      <div class="game-card-thumb">${g.genreEmoji || '🎮'}</div>
      <div class="game-card-info">
        <div class="game-card-name">${g.title}</div>
        <div class="game-card-stats">❤️ ${fmtNum(g.likes)} · 👁 ${fmtNum(g.plays)}</div>
      </div>
    </div>
  `).join('');
}

function openGameFromSearch(gameId) {
  const idx = GAMES.findIndex(g => g.id === gameId);
  if (idx === -1) return;
  closeSearch();
  goTo(idx);
}

window.onSearch = onSearch;
window.openGameFromSearch = openGameFromSearch;
