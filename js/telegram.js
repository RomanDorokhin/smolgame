try {
  Telegram.WebApp.ready();
  Telegram.WebApp.expand();
  // Меньше конфликтов вертикального свайпа Telegram с drag в играх (Bot API 7.7+).
  if (typeof Telegram.WebApp.disableVerticalSwipes === 'function') {
    Telegram.WebApp.disableVerticalSwipes();
  }
} catch (e) {
  /* вне Telegram WebApp — ожидаемо для локальной разработки */
}

document.body.addEventListener('touchmove', function (e) {
  if (e.target === document.body || e.target === document.documentElement) {
    e.preventDefault();
  }
}, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
