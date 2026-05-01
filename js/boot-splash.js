/**
 * Сплэш входа: логотип + «летающие» иконки жанров по диагонали на весь экран.
 */
const BOOT_GENRE_KEYS = ['arcade', 'puzzle', 'action', 'casual', 'strategy', 'racing', 'platform', 'other'];

function fillBootGenreDriftLayer() {
  const layer = document.getElementById('app-boot-genre-drift');
  if (!layer || layer.dataset.ready === '1') return;
  if (typeof genreIconSvg !== 'function') return;
  layer.dataset.ready = '1';
  layer.innerHTML = '';

  const count = 12;
  for (let i = 0; i < count; i++) {
    const key = BOOT_GENRE_KEYS[i % BOOT_GENRE_KEYS.length];
    const wrap = document.createElement('span');
    wrap.className = 'app-boot-genre-drift__item';
    wrap.setAttribute('aria-hidden', 'true');

    const leftPct = ((i * 37 + 11 * (i % 3)) % 100);
    const bottomPct = ((i * 23 + 7 * (i % 5)) % 92);
    wrap.style.left = `${leftPct}%`;
    wrap.style.bottom = `${bottomPct}%`;
    wrap.style.right = 'auto';

    const angle = (i * 0.31) % (Math.PI * 2);
    const dist = 95 + (i % 5) * 8;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    const rot = -25 + (i % 7) * 8;

    wrap.style.setProperty('--boot-dx', `${tx.toFixed(1)}vw`);
    wrap.style.setProperty('--boot-dy', `${ty.toFixed(1)}vh`);
    wrap.style.setProperty('--boot-rot', `${rot}deg`);
    wrap.style.setProperty('--boot-dur', `${14 + (i % 5) * 2.2}s`);
    wrap.style.setProperty('--boot-delay', `${-(i * 1.7 + (i % 4) * 0.5).toFixed(2)}s`);

    wrap.innerHTML = genreIconSvg(key, 'sg-genre-ic--boot-drift');
    layer.appendChild(wrap);
  }
}

function showBootSplash() {
  const el = document.getElementById('app-boot-splash');
  if (!el) return;
  document.body.classList.add('app-boot-active');
  fillBootGenreDriftLayer();
  el.removeAttribute('hidden');
  requestAnimationFrame(() => el.classList.add('visible'));
}

function hideBootSplash() {
  const el = document.getElementById('app-boot-splash');
  if (!el) return;
  document.body.classList.remove('app-boot-active');
  el.classList.remove('visible');
  const done = () => el.setAttribute('hidden', '');
  el.addEventListener('transitionend', done, { once: true });
  setTimeout(done, 320);
}

window.showBootSplash = showBootSplash;
window.hideBootSplash = hideBootSplash;
