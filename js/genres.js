function genrePillHtml(g) {
  const key = g.key || (typeof genreIconKeyFromLabel === 'function' ? genreIconKeyFromLabel(g.label) : 'other');
  const icon = typeof genreIconSvg === 'function' ? genreIconSvg(key, 'sg-genre-ic--sm') : '';
  return `${icon}<span class="genre-pill-txt">${esc(g.label)}</span>`;
}

function renderGenrePills(containerId, stateKey) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  GENRES.forEach(g => {
    const pill = document.createElement('div');
    pill.className = 'genre-pill' + (selectedGenres[stateKey] === g.label ? ' selected' : '');
    pill.innerHTML = genrePillHtml(g);
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
  [{ label: 'Все', key: 'all' }, ...GENRES].forEach(g => {
    const tag = document.createElement('div');
    tag.className = 'genre-tag' + (window.selectedGenre === g.label ? ' active' : '');
    const iconKey = g.key || (typeof genreIconKeyFromLabel === 'function' ? genreIconKeyFromLabel(g.label) : 'all');
    tag.innerHTML =
      (typeof genreIconSvg === 'function' ? genreIconSvg(iconKey, 'sg-genre-ic--sm') : '') +
      `<span class="genre-tag-txt">${esc(g.label)}</span>`;
    tag.onclick = () => {
      window.selectedGenre = window.selectedGenre === g.label ? '' : g.label;
      renderGenreFilter();
      onSearch(document.getElementById('searchInput').value);
    };
    el.appendChild(tag);
  });
}

/** Короткий ключ для API (genre_emoji) из русского названия жанра */
function genreKeyForApiLabel(label) {
  const row = GENRES.find(x => x.label === label);
  if (row?.key) return row.key;
  return typeof genreIconKeyFromLabel === 'function' ? genreIconKeyFromLabel(label) : 'other';
}

window.genreKeyForApiLabel = genreKeyForApiLabel;
window.renderGenrePills = renderGenrePills;
window.renderGenreFilter = renderGenreFilter;
