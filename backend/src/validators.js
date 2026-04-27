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

export function validateSubmission(body) {
  const title = String(body.title || '').trim().slice(0, 40);
  const description = String(body.description || '').trim().slice(0, 120);
  const genre = GENRES.has(body.genre) ? body.genre : 'Прочее';
  const genreEmoji = String(body.genreEmoji || '🎮').slice(0, 8);
  const url = safeHttpsUrl(body.url);
  const imageUrl = body.imageUrl ? safeHttpsUrl(body.imageUrl) : null;

  if (!title) return { error: 'Название игры обязательно' };
  if (!url)   return { error: 'Нужна корректная https:// ссылка' };
  if (body.imageUrl && !imageUrl) return { error: 'Некорректная ссылка на обложку' };

  return { ok: { title, description, genre, genreEmoji, url, imageUrl } };
}

/** Мета для POST /api/submit-html-game (URL игры подставляет сервер). */
export function validateHostedGameFields(body) {
  const title = String(body.title || '').trim().slice(0, 40);
  const description = String(body.description || '').trim().slice(0, 120);
  const genre = GENRES.has(body.genre) ? body.genre : 'Прочее';
  const genreEmoji = String(body.genreEmoji || '🎮').slice(0, 8);
  const imageUrl = body.imageUrl ? safeHttpsUrl(body.imageUrl) : null;

  if (!title) return { error: 'Название игры обязательно' };
  if (body.imageUrl && !imageUrl) return { error: 'Некорректная ссылка на обложку' };

  return { ok: { title, description, genre, genreEmoji, imageUrl } };
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
