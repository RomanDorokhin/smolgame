const GENRES = new Set([
  'Аркада', 'Головоломка', 'Экшен', 'Казуалка',
  'Стратегия', 'Гонки', 'Платформер', 'Прочее',
]);

export function safeHttpsUrl(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    if (u.protocol !== 'https:') return null;
    if (!u.hostname) return null;
    return u.toString();
  } catch (e) {
    return null;
  }
}

/** Игра на GitHub Pages (*.github.io) — отдельная проверка для submit. */
export function safeGithubPagesPlayUrl(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    if (u.protocol !== 'https:') return null;
    const h = u.hostname.toLowerCase();
    if (!h.endsWith('.github.io')) return null;
    if (!u.pathname || u.pathname === '/') return u.toString();
    return u.toString();
  } catch (e) {
    return null;
  }
}

export function validateSubmission(body) {
  const title = String(body.title || '').trim().slice(0, 40);
  const description = String(body.description || '').trim().slice(0, 120);
  const genre = GENRES.has(body.genre) ? body.genre : 'Прочее';
  const genreEmoji = String(body.genreEmoji || '🎮').slice(0, 8);
  const ghPages = safeGithubPagesPlayUrl(body.url);
  const url = ghPages || safeHttpsUrl(body.url);
  const imageUrl = body.imageUrl ? safeHttpsUrl(body.imageUrl) : null;

  if (!title) return { error: 'Название игры обязательно' };
  if (!url) {
    return { error: 'Нужна корректная https:// ссылка (для GitHub Pages — https://username.github.io/…)' };
  }
  if (body.imageUrl && !imageUrl) return { error: 'Некорректная ссылка на обложку' };

  return { ok: { title, description, genre, genreEmoji, url, imageUrl } };
}

/** PATCH карточки игры автором: название, описание, жанр, обложка; URL игры не меняется. */
export function validateGameListingPatch(body) {
  const title = String(body.title || '').trim().slice(0, 40);
  const description = String(body.description || '').trim().slice(0, 120);
  const genre = GENRES.has(body.genre) ? body.genre : 'Прочее';
  const genreEmoji = String(body.genreEmoji || '🎮').slice(0, 8);
  if (!title) return { error: 'Название игры обязательно' };

  let imageUrlPatch;
  if (Object.prototype.hasOwnProperty.call(body, 'imageUrl')) {
    const raw = body.imageUrl;
    if (raw === null || raw === '') {
      imageUrlPatch = null;
    } else {
      const u = safeHttpsUrl(String(raw).trim());
      if (!u) return { error: 'Некорректная ссылка на обложку' };
      imageUrlPatch = u;
    }
  }

  return { ok: { title, description, genre, genreEmoji, imageUrlPatch } };
}

const HANDLE_RE = /^[a-z0-9_]{3,24}$/;

/** PATCH /api/me: displayName, bio, siteHandle, photoUrl (optional). */
export function validateProfilePatch(body) {
  const out = {};
  if (body.displayName !== undefined) {
    const s = String(body.displayName || '').trim().slice(0, 60);
    if (!s) return { error: 'Имя не может быть пустым' };
    out.displayName = s;
  }
  if (body.bio !== undefined) {
    out.bio = String(body.bio || '').trim().slice(0, 280);
  }
  if (body.siteHandle !== undefined) {
    const h = String(body.siteHandle || '').trim().toLowerCase();
    if (!HANDLE_RE.test(h)) return { error: 'Публичный ID: 3-24 символа, латиница, цифры или _' };
    out.siteHandle = h;
  }
  if (body.photoUrl !== undefined) {
    if (body.photoUrl === null || body.photoUrl === '') {
      out.clearAvatar = true;
    } else {
      const u = safeHttpsUrl(String(body.photoUrl).trim());
      if (!u) return { error: 'Некорректная ссылка на фото (нужен https://)' };
      out.photoUrl = u;
    }
  }
  if (Object.keys(out).length === 0) return { error: 'Нечего обновить' };
  return { ok: out };
}
