/**
 * Короткий экран загрузки с логотипом (первый кадр вместо «пустого» UI и длинного ожидания API).
 */
const BOOT_GENRE_KEYS = ['arcade', 'puzzle', 'action', 'casual', 'strategy', 'racing', 'platform'];

function fillBootGenreDriftLayer() {
  const layer = document.getElementById('app-boot-genre-drift');
  if (!layer || layer.dataset.ready === '1') return;
  if (typeof genreIconSvg !== 'function') return;
  layer.dataset.ready = '1';
  BOOT_GENRE_KEYS.forEach((key, i) => {
    const wrap = document.createElement('span');
    wrap.className = 'app-boot-genre-drift__item app-boot-genre-drift__item--' + (i + 1);
    wrap.innerHTML = genreIconSvg(key, 'sg-genre-ic--boot-drift');
    layer.appendChild(wrap);
  });
}

function showBootSplash() {
  const el = document.getElementById('app-boot-splash');
  if (!el) return;
  fillBootGenreDriftLayer();
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
