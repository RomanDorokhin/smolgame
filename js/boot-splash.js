/**
 * Короткий экран загрузки с логотипом (первый кадр вместо «пустого» UI).
 */
function showBootSplash() {
  const el = document.getElementById('app-boot-splash');
  if (!el) return;
  el.removeAttribute('hidden');
  requestAnimationFrame(() => el.classList.add('visible'));
}

function hideBootSplash() {
  const el = document.getElementById('app-boot-splash');
  if (!el) return;
  el.classList.remove('visible');
  const done = () => el.setAttribute('hidden', '');
  el.addEventListener('transitionend', done, { once: true });
  setTimeout(done, 320);
}

window.showBootSplash = showBootSplash;
window.hideBootSplash = hideBootSplash;
