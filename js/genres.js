function renderGenrePills(containerId, stateKey) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  GENRES.forEach(g => {
    const pill = document.createElement('div');
    pill.className = 'genre-pill' + (selectedGenres[stateKey] === g.label ? ' selected' : '');
    pill.textContent = g.emoji + ' ' + g.label;
    pill.onclick = () => {
      selectedGenres[stateKey] = selectedGenres[stateKey] === g.label ? '' : g.label;
      renderGenrePills(containerId, stateKey);
    };
    el.appendChild(pill);
  });
}

function renderGenreFilter() {
  const el = document.getElementById('genreFilter');
  el.innerHTML = '';
  [{ label: 'Все', emoji: '🎮' }, ...GENRES].forEach(g => {
    const tag = document.createElement('div');
    tag.className = 'genre-tag' + (window.selectedGenre === g.label ? ' active' : '');
    tag.textContent = g.emoji + ' ' + g.label;
    tag.onclick = () => {
      window.selectedGenre = window.selectedGenre === g.label ? '' : g.label;
      renderGenreFilter();
      onSearch(document.getElementById('searchInput').value);
    };
    el.appendChild(tag);
  });
}

window.renderGenrePills = renderGenrePills;
window.renderGenreFilter = renderGenreFilter;
