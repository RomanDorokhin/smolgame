try {
  Telegram.WebApp.ready();
  Telegram.WebApp.expand();
} catch (e) {
  console.log('Not in Telegram, running in browser');
}

document.body.addEventListener('touchmove', function (e) {
  if (e.target === document.body || e.target === document.documentElement) {
    e.preventDefault();
  }
}, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
