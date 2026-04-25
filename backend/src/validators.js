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

  if (!title) return { error: 'Название игры обязательно' };
  if (!url)   return { error: 'Нужна корректная https:// ссылка' };

  return { ok: { title, description, genre, genreEmoji, url } };
}
