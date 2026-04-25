let tgUser = null;
try { tgUser = Telegram.WebApp.initDataUnsafe?.user; } catch (e) {}

window.USER = {
  id: tgUser?.id || 'guest_' + Math.random().toString(36).slice(2, 8),
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
window.likedSet = new Set();
window.followedSet = new Set();
window.selectedGenre = '';
window.selectedUploadMethod = 'code';
window.selectedGenres = { code: '', url: '' };
