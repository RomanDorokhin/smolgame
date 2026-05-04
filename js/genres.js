/** «Все жанры» в фильтре поиска — значение для API/логики (русское, как в БД). */
const GENRE_FILTER_ALL_VALUE = 'Все';

function genrePillHtml(g) {
  const key = g.key || (typeof genreIconKeyFromLabel === 'function' ? genreIconKeyFromLabel(g.label) : 'other');
  const icon = typeof genreIconSvg === 'function' ? genreIconSvg(key, 'sg-genre-ic--sm') : '';
  const display =
    typeof genreDisplayFromApi === 'function' ? genreDisplayFromApi(g.label) : g.label;
  return `${icon}<span class="genre-pill-txt">${esc(display)}</span>`;
}

function renderGenrePills(containerId, stateKey) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  GENRES.forEach(g => {
    const pill = document.createElement('div');
    pill.className = 'genre-pill' + (selectedGenres[stateKey] === g.label ? ' selected' : '');
    pill.innerHTML = genrePillHtml(g);
    pill.addEventListener('click', () => {
      selectedGenres[stateKey] = selectedGenres[stateKey] === g.label ? '' : g.label;
      renderGenrePills(containerId, stateKey);
    });
    el.appendChild(pill);
  });
}

function renderGenreFilter() {
  const el = document.getElementById('genreFilter');
  if (!el) return;
  el.innerHTML = '';
  const allDisplay = typeof t === 'function' ? t('genre_all') : GENRE_FILTER_ALL_VALUE;
  const chips = [
    { value: GENRE_FILTER_ALL_VALUE, key: 'all', labelDisplay: allDisplay },
    ...GENRES.map(g => ({
      value: g.label,
      key: g.key,
      labelDisplay: typeof genreDisplayFromApi === 'function' ? genreDisplayFromApi(g.label) : g.label,
    })),
  ];
  chips.forEach(g => {
    const tag = document.createElement('div');
    const active =
      g.value === GENRE_FILTER_ALL_VALUE
        ? !window.selectedGenre || window.selectedGenre === '' || window.selectedGenre === GENRE_FILTER_ALL_VALUE
        : window.selectedGenre === g.value;
    tag.className = 'genre-tag' + (active ? ' active' : '');
    const iconKey = g.key || (typeof genreIconKeyFromLabel === 'function' ? genreIconKeyFromLabel(g.value) : 'all');
    tag.innerHTML =
      (typeof genreIconSvg === 'function' ? genreIconSvg(iconKey, 'sg-genre-ic--sm') : '') +
      `<span class="genre-tag-txt">${esc(g.labelDisplay)}</span>`;
    tag.addEventListener('click', () => {
      if (g.value === GENRE_FILTER_ALL_VALUE) {
        window.selectedGenre = '';
      } else {
        window.selectedGenre = window.selectedGenre === g.value ? '' : g.value;
      }
      renderGenreFilter();
      onSearch(document.getElementById('searchInput').value);
    });
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
window.GENRE_FILTER_ALL_VALUE = GENRE_FILTER_ALL_VALUE;
