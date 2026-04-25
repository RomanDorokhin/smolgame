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

  // Экранируем всё, что пришло из API/от авторов. id зашиваем как data-атрибут,
  // чтобы в onclick не мог попасть " или ' от автора.
  results.innerHTML = filtered.map(g => `
    <div class="game-card" data-game-id="${esc(g.id)}" onclick="openGameFromSearch(this.dataset.gameId)">
      <div class="game-card-thumb">${esc(g.genreEmoji || '🎮')}</div>
      <div class="game-card-info">
        <div class="game-card-name">${esc(g.title)}</div>
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
