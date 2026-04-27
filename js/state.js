let tgUser = null;
try { tgUser = Telegram.WebApp.initDataUnsafe?.user; } catch (e) {}

window.USER = {
  id: tgUser?.id ? String(tgUser.id) : '',
  tgId: tgUser?.id ? String(tgUser.id) : null,
  name: tgUser ? (tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '')) : '',
  siteHandle: null,
  displayName: '',
  bio: '',
  avatar: (tgUser?.photo_url && String(tgUser.photo_url).trim()) || tgUser?.first_name?.[0] || '?',
  isGithubConnected: false,
  githubUsername: null,
};

// Ключи локального хранилища — привязаны к Telegram id.
window.STORAGE_KEYS = {
  liked:      'smolgame:liked:' + (USER.id || 'anon'),
  followed:   'smolgame:followed:' + (USER.id || 'anon'),
  bookmarked: 'smolgame:bookmarked:' + (USER.id || 'anon'),
  feedNavTip: 'smolgame:feedNavTip2:' + (USER.id || 'anon'),
  welcomeOnboarding: 'smolgame:welcome3:' + (USER.id || 'anon'),
};

window.likedSet      = loadSet(STORAGE_KEYS.liked);
window.followedSet   = loadSet(STORAGE_KEYS.followed);
window.bookmarkedSet = loadSet(STORAGE_KEYS.bookmarked);

window.GAMES = [];

window.currentIdx = 0;
window.slides = [];

window.selectedGenre = '';
window.selectedUploadMethod = 'url';
window.selectedGenres = { code: '', url: '' };
