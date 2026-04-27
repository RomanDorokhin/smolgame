import { verifyInitData } from './telegram.js';
import { isMissingColumnError } from './db-errors.js';

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
 * Старые D1 без tg_username / site_handle — перебираем варианты INSERT (как для ленты).
 */
const UPSERT_USER_SQL_VARIANTS = [
  {
    sql: `INSERT INTO users (id, username, tg_username, first_name, last_name, photo_url)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            username    = COALESCE(users.site_handle, users.username),
            tg_username = excluded.tg_username,
            first_name  = COALESCE(excluded.first_name, users.first_name),
            last_name   = COALESCE(excluded.last_name, users.last_name),
            photo_url   = COALESCE(excluded.photo_url, users.photo_url)`,
    bind: (u) => [u.id, u.username, u.username, u.first_name, u.last_name, u.photo_url],
  },
  // Есть tg_username, но нет site_handle в таблице
  {
    sql: `INSERT INTO users (id, username, tg_username, first_name, last_name, photo_url)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            username    = COALESCE(excluded.username, users.username),
            tg_username = excluded.tg_username,
            first_name  = COALESCE(excluded.first_name, users.first_name),
            last_name   = COALESCE(excluded.last_name, users.last_name),
            photo_url   = COALESCE(excluded.photo_url, users.photo_url)`,
    bind: (u) => [u.id, u.username, u.username, u.first_name, u.last_name, u.photo_url],
  },
  // Есть site_handle, нет tg_username
  {
    sql: `INSERT INTO users (id, username, first_name, last_name, photo_url)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            username    = COALESCE(users.site_handle, excluded.username, users.username),
            first_name  = COALESCE(excluded.first_name, users.first_name),
            last_name   = COALESCE(excluded.last_name, users.last_name),
            photo_url   = COALESCE(excluded.photo_url, users.photo_url)`,
    bind: (u) => [u.id, u.username, u.first_name, u.last_name, u.photo_url],
  },
  // Минимальная схема users
  {
    sql: `INSERT INTO users (id, username, first_name, last_name, photo_url)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            username    = COALESCE(excluded.username, users.username),
            first_name  = COALESCE(excluded.first_name, users.first_name),
            last_name   = COALESCE(excluded.last_name, users.last_name),
            photo_url   = COALESCE(excluded.photo_url, users.photo_url)`,
    bind: (u) => [u.id, u.username ?? '', u.first_name, u.last_name, u.photo_url],
  },
  // Только id — достаточно для FOREIGN KEY в games, если остальные колонки другие/отсутствуют
  {
    sql: `INSERT OR IGNORE INTO users (id) VALUES (?)`,
    bind: (u) => [u.id],
  },
];

export async function upsertUser(db, user) {
  let lastErr;
  for (const variant of UPSERT_USER_SQL_VARIANTS) {
    try {
      await db.prepare(variant.sql).bind(...variant.bind(user)).run();
      return;
    } catch (e) {
      lastErr = e;
      if (!isMissingColumnError(e)) throw e;
    }
  }
  throw lastErr;
}
