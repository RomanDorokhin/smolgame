// Username бота БЕЗ @. Используется для deep-link вида t.me/<bot>?startapp=...
// Поменяй на реальный username после создания бота в BotFather.
window.BOT_USERNAME = 'smolgame_bot';

// Имя мини-апп (если ты задал его в BotFather через /newapp).
// Если оставить пустым — используется бот по умолчанию (его Menu Button).
window.BOT_APP_NAME = '';

/** Жанры: key — короткий id иконки (отправляется в genre_emoji вместо эмодзи) */
window.GENRES = [
  { label: 'Аркада',      key: 'arcade' },
  { label: 'Головоломка', key: 'puzzle' },
  { label: 'Экшен',       key: 'action' },
  { label: 'Казуалка',    key: 'casual' },
  { label: 'Стратегия',   key: 'strategy' },
  { label: 'Гонки',       key: 'racing' },
  { label: 'Платформер',  key: 'platform' },
  { label: 'Прочее',      key: 'other' },
];
