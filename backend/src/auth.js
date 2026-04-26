import { verifyInitData } from './telegram.js';

/**
 * Извлекает и валидирует текущего пользователя из заголовка `x-telegram-init-data`.
 * Если токен не задан (локальный dev) — пропускает гостя без id.
 *
 * Возвращает { id, username, first_name, last_name, photo_url, isAdmin } или null.
 */
export async function authenticate(req, env) {
  const initData = req.headers.get('x-telegram-init-data');
  if (!initData) return null;
  const user = await verifyInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (!user) return null;

  const adminIds = new Set(
    String(env.ADMIN_TG_IDS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  );
  user.isAdmin = adminIds.has(user.id);
  return user;
}

/**
 * Апсертим юзера в БД (обновляем имя/аватар, если уже есть).
 */
export async function upsertUser(db, user) {
  await db
    .prepare(
      `INSERT INTO users (id, username, tg_username, first_name, last_name, photo_url)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         username   = COALESCE(users.site_handle, users.username),
         tg_username = excluded.tg_username,
         first_name = COALESCE(excluded.first_name, users.first_name),
         last_name  = COALESCE(excluded.last_name, users.last_name),
         photo_url  = COALESCE(excluded.photo_url, users.photo_url)`
    )
    .bind(
      user.id,
      user.username,
      user.username,
      user.first_name,
      user.last_name,
      user.photo_url
    )
    .run();
}
