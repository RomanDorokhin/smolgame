function allGenreValue() {
  return typeof GENRE_FILTER_ALL_VALUE === 'string' ? GENRE_FILTER_ALL_VALUE : 'Все';
}

function selectedGenreChipHtml() {
  const sel = window.selectedGenre;
  const allV = allGenreValue();
  if (!sel || sel === allV) return '';
  const key = typeof genreIconKeyFromLabel === 'function' ? genreIconKeyFromLabel(sel) : '';
  const icon =
    typeof genreIconSvg === 'function' ? genreIconSvg(key, 'sg-genre-ic--sm') : '';
  const label =
    typeof genreDisplayFromApi === 'function' ? genreDisplayFromApi(sel) : sel;
  const aria = typeof t === 'function' ? t('search_clear_genre_aria') : '';
  return `<button type="button" class="search-active-filter" data-action="search-clear-genre" aria-label="${esc(aria)}">${icon}<span>${esc(label)}</span><span class="search-active-filter-x" aria-hidden="true">×</span></button>`;
}

function hasSearchQuery() {
  const v = document.getElementById('searchInput')?.value?.trim() || '';
  return Boolean(v);
}

function isDefaultSearchView() {
  const g = window.selectedGenre;
  const allV = allGenreValue();
  return !hasSearchQuery() && (!g || g === '' || g === allV);
}

function renderSearchEmptyState() {
  const results = document.getElementById('searchResults');
  if (!results) return;
  const tFn = typeof t === 'function' ? t : k => k;
  if (isDefaultSearchView()) {
    results.innerHTML = `
      <div class="search-empty-state">
        <div class="search-empty-icon-wrap">${typeof genreIconSvg === 'function' ? genreIconSvg('all', 'sg-genre-ic--hero') : ''}</div>
        <p class="search-empty-title">${esc(tFn('search_empty_title'))}</p>
        <p class="search-empty-sub">${esc(tFn('search_empty_sub'))}</p>
      </div>`;
    return;
  }
  results.innerHTML = `<div class="search-no-results"><p>${esc(tFn('search_no_results'))}</p><p class="search-no-results-hint">${esc(tFn('search_no_hint'))}</p></div>`;
}

function onSearch(query) {
  const results = document.getElementById('searchResults');
  const allV = allGenreValue();
  const filtered = GAMES.filter(g => {
    const q = (query || '').toLowerCase();
    const matchQuery = !q
      || (g.title || '').toLowerCase().includes(q)
      || (g.authorName || '').toLowerCase().includes(q)
      || (g.authorHandle || '').toLowerCase().includes(q);
    const matchGenre = !window.selectedGenre
      || window.selectedGenre === allV
      || g.genre === window.selectedGenre;
    return matchQuery && matchGenre;
  });

  const hint = document.getElementById('searchHintBar');
  if (hint) hint.innerHTML = selectedGenreChipHtml();

  if (filtered.length === 0) {
    renderSearchEmptyState();
    return;
  }

  results.innerHTML = filtered.map(g => `
    <div class="game-card sg-store-card search-game-card" data-action="open-game-detail" data-game-id="${esc(g.id)}">
      <div class="game-card-thumb sg-store-card-thumb">${typeof gameThumbHtml === 'function' ? gameThumbHtml(g) : ''}</div>
      ${typeof sgStorefrontCardInfoHtml === 'function' ? sgStorefrontCardInfoHtml(g, { author: true, desc: true }) : `<div class="game-card-info"><div class="game-card-name">${esc(g.title)}</div><div class="game-card-stats"><span class="sg-mini-stat">${sgStatHeartSvg()}${fmtNum(g.likes)}</span><span class="sg-mini-sep">·</span><span class="sg-mini-stat">${sgStatEyeSvg()}${fmtNum(g.plays)}</span></div></div>`}
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

function initSearchInput() {
  const inp = document.getElementById('searchInput');
  if (!inp || inp.dataset.searchInit) return;
  inp.dataset.searchInit = '1';
  inp.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.target.value = '';
      onSearch('');
    }
  });
}

document.addEventListener('DOMContentLoaded', initSearchInput);

window.onSearch = onSearch;
window.openGameFromSearch = openGameFromSearch;
window.initSearchInput = initSearchInput;
window.renderSearchEmptyState = renderSearchEmptyState;
