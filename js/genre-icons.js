/**
 * Кастомные иконки жанров (SVG, currentColor) + сопоставление с label / старым emoji в API.
 */
const GENRE_ICON_KEYS = {
  'Все': 'all',
  Аркада: 'arcade',
  Головоломка: 'puzzle',
  Экшен: 'action',
  Казуалка: 'casual',
  Стратегия: 'strategy',
  Гонки: 'racing',
  Платформер: 'platform',
  Прочее: 'other',
};

/** Старые значения genre_emoji в БД (эмодзи) → ключ иконки */
const LEGACY_EMOJI_TO_KEY = {
  '🎮': 'all',
  '🕹️': 'arcade',
  '🧩': 'puzzle',
  '⚔️': 'action',
  '🎯': 'casual',
  '♟️': 'strategy',
  '🏎️': 'racing',
  '🏃': 'platform',
  '🎲': 'other',
  // варианты без variation selector
  '🕹': 'arcade',
  '♟': 'strategy',
  '🏎': 'racing',
  '🏃': 'platform',
};

const DEFAULT_KEY = 'all';

function genreIconKeyFromLabel(label) {
  if (!label) return DEFAULT_KEY;
  if (label === 'Все') return 'all';
  return GENRE_ICON_KEYS[label] || DEFAULT_KEY;
}

/**
 * API хранит в genre_emoji либо старые эмодзи, либо короткий ключ (arcade, puzzle, …).
 */
function genreIconKeyFromStored(stored, genreLabel) {
  const s = String(stored || '').trim();
  const KEY_SET = { all: 1, arcade: 1, puzzle: 1, action: 1, casual: 1, strategy: 1, racing: 1, platform: 1, other: 1 };
  if (s && KEY_SET[s]) return s;
  if (LEGACY_EMOJI_TO_KEY[s]) return LEGACY_EMOJI_TO_KEY[s];
  return genreIconKeyFromLabel(genreLabel);
}

/**
 * @param {string} key — all | arcade | puzzle | …
 * @param {string} [sizeClass] — sg-genre-ic--xs | sm | md | lg
 */
function genreIconSvg(key, sizeClass) {
  const k = key in _ICONS ? key : DEFAULT_KEY;
  const cls = 'sg-genre-ic' + (sizeClass ? ' ' + sizeClass : '');
  return _ICONS[k](cls);
}

function genreIconForGame(g) {
  const key = genreIconKeyFromStored(g?.genreEmoji, g?.genre);
  return genreIconSvg(key, 'sg-genre-ic--md');
}

const _ICONS = {
  all(cls) {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
<rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
<rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
<rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
<path d="M10.5 6.5h3M10.5 12h3M6.5 10.5v3M12 10.5v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".35"/>
</svg>`;
  },
  arcade(cls) {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<rect x="4" y="7" width="16" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
<path d="M8.5 12.5h.01M12 12.5h.01M15.5 12.5h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
<path d="M9.5 5.5L8 3.5M14.5 5.5L16 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;
  },
  puzzle(cls) {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M8.5 4.5H10a2.5 2.5 0 012.5 2.5V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
<path d="M15.5 4.5H14A2.5 2.5 0 0011.5 7V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
<path d="M8.5 19.5H10a2.5 2.5 0 002.5-2.5V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
<path d="M4.5 12.5V11A2.5 2.5 0 017 8.5h1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
<path d="M19.5 12.5V11A2.5 2.5 0 0017 8.5h-1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
<path d="M15.5 19.5H14A2.5 2.5 0 0111.5 17V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
<circle cx="12" cy="12" r="2" fill="currentColor" opacity=".25"/>
</svg>`;
  },
  action(cls) {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;
  },
  casual(cls) {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5"/>
<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5" opacity=".5"/>
<circle cx="12" cy="12" r="1.2" fill="currentColor"/>
</svg>`;
  },
  strategy(cls) {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M12 4l2.2 4.5L19 10l-3.5 3.4L16.4 19 12 16.2 7.6 19l.9-5.6L5 10l4.8-1.5L12 4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M8.5 15.5L6 20" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".4"/>
<path d="M15.5 15.5L18 20" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".4"/>
</svg>`;
  },
  racing(cls) {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M4.5 16.5c0-2.5 2-4.5 5-4.5h5c2.2 0 4 1.2 4.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
<path d="M6.5 16.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
<circle cx="8.5" cy="18" r="1.6" fill="currentColor"/>
<circle cx="16" cy="18" r="1.6" fill="currentColor"/>
<path d="M7.5 9.5L9 6.5h6.5L19 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M3.5 12.5L2 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".5"/>
</svg>`;
  },
  platform(cls) {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M8.5 5.5a2.5 2.5 0 11-1.1 3.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
<path d="M7.5 8.5L6.5 19" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
<path d="M6.5 19H4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
<rect x="3" y="19" width="18" height="2.5" rx="0.8" fill="currentColor" opacity=".25"/>
<rect x="14" y="14" width="5" height="3" rx="0.6" stroke="currentColor" stroke-width="1.3"/>
<path d="M9.5 8.5L12 5.5l2.5 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  },
  other(cls) {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<rect x="5" y="5" width="14" height="14" rx="2.5" stroke="currentColor" stroke-width="1.5"/>
<circle cx="9" cy="9" r="1.1" fill="currentColor"/>
<circle cx="15" cy="9" r="1.1" fill="currentColor"/>
<circle cx="9" cy="15" r="1.1" fill="currentColor"/>
<circle cx="15" cy="15" r="1.1" fill="currentColor"/>
<path d="M9.5 10.5L10.5 12" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" opacity=".4"/>
</svg>`;
  },
};

window.GENRE_ICON_KEYS = GENRE_ICON_KEYS;
window.genreIconKeyFromLabel = genreIconKeyFromLabel;
window.genreIconKeyFromStored = genreIconKeyFromStored;
window.genreIconSvg = genreIconSvg;
window.genreIconForGame = genreIconForGame;
