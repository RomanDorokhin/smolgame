let tgUser = null;
try { tgUser = Telegram.WebApp.initDataUnsafe?.user; } catch (e) {}

// Для гостей закрепляем id в localStorage, иначе при каждом заходе он новый
// и все сохранённые лайки/подписки «теряются» (лежат под прошлым ключом).
function _resolveGuestId() {
  try {
    const saved = localStorage.getItem('smolgame:guestId');
    if (saved) return saved;
    const fresh = 'guest_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('smolgame:guestId', fresh);
    return fresh;
  } catch (e) {
    return 'guest_' + Math.random().toString(36).slice(2, 8);
  }
}

window.USER = {
  id: tgUser?.id ? String(tgUser.id) : _resolveGuestId(),
  name: tgUser ? (tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '')) : 'Гость',
  username: tgUser?.username || 'guest',
  avatar: tgUser?.first_name?.[0] || '?',
  isGithubConnected: false,
  githubUsername: null,
};

// База игр — сюда будут добавляться игры из API/бэкенда
// Структура одной игры:
// {
//   id: string,
//   title: string,
//   description: string,
//   genre: string,
//   genreEmoji: string,
//   url: string,           // ← URL iframe (GitHub Pages)
//   authorId: string,
//   authorName: string,
//   authorHandle: string,
//   authorAvatar: string,  // первая буква или URL
//   likes: number,
//   plays: number,
//   isLiked: boolean,
//   isFollowing: boolean,
// }
window.GAMES = [];

window.currentIdx = 0;
window.slides = [];

// Ключи локального хранилища — привязаны к юзеру, чтобы на одном устройстве
// разные аккаунты (гости, tg-юзеры) не делили лайки.
window.STORAGE_KEYS = {
  liked:    'smolgame:liked:' + USER.id,
  followed: 'smolgame:followed:' + USER.id,
};

window.likedSet    = loadSet(STORAGE_KEYS.liked);
window.followedSet = loadSet(STORAGE_KEYS.followed);

window.selectedGenre = '';
window.selectedUploadMethod = 'code';
window.selectedGenres = { code: '', url: '' };
