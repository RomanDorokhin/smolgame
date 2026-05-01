let tgUser = null;
try { tgUser = Telegram?.WebApp?.initDataUnsafe?.user; } catch (e) {}

const PERSIST_ID_KEY = 'smolgame:persisted_id:v1';
let cachedId = '';
try { cachedId = localStorage.getItem(PERSIST_ID_KEY) || ''; } catch(e) {}

window.USER = {
  id: tgUser?.id ? String(tgUser.id) : cachedId,
  tgId: tgUser?.id ? String(tgUser.id) : null,
  name: tgUser ? (tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '')) : '',
  siteHandle: null,
  displayName: '',
  bio: '',
  avatar: (tgUser?.photo_url && String(tgUser.photo_url).trim()) || tgUser?.first_name?.[0] || '?',
  isGithubConnected: false,
  githubUsername: null,
  hasGithubPublishToken: false,
  isPremium: false,
};

window.refreshStorageKeys = function() {
  const uid = USER.id || 'anon';
  window.STORAGE_KEYS = {
    liked:      'smolgame:liked:' + uid,
    followed:   'smolgame:followed:' + uid,
    bookmarked: 'smolgame:bookmarked:' + uid,
    feedNavTip: 'smolgame:feedNavTip2:' + uid,
    feedSwipeLearned: 'smolgame:feedSwipeLearned:' + uid,
    feedSwipeTeaseShown: 'smolgame:feedSwipeTeaseShown:' + uid,
    welcomeOnboarding: 'smolgame:welcome3:' + uid,
    feedOnboardingDone: 'smolgame:feedOnboard1:' + uid,
  };
  // Re-load sets if ID changed
  window.likedSet      = typeof loadSet === 'function' ? loadSet(STORAGE_KEYS.liked)      : new Set();
  window.followedSet   = typeof loadSet === 'function' ? loadSet(STORAGE_KEYS.followed)   : new Set();
  window.bookmarkedSet = typeof loadSet === 'function' ? loadSet(STORAGE_KEYS.bookmarked) : new Set();
};

window.refreshStorageKeys();

if (typeof window.syncUSERFromTelegramInit === 'function') {
  window.syncUSERFromTelegramInit();
}
