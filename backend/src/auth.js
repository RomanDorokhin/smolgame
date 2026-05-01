import { verifyInitData } from './telegram.js';
import { isMissingColumnError } from './db-errors.js';

/**
 * Строка initData: заголовок (основной путь) или query `tgWebAppData` (fallback для WebView,
 * где длинный/нестандартный заголовок ломает fetch с TypeError).
 */
export function initDataFromRequest(req) {
  const h = String(req.headers.get('x-telegram-init-data') || '').trim();
  if (h) return h;
  try {
    const u = new URL(req.url);
    let q = u.searchParams.get('tgWebAppData');
    if (q) return String(q).trim();
    // Очень длинный tgWebAppData: часть клиентов режет query; парсим вручную из raw search.
    const raw = u.search || '';
    if (raw.includes('tgWebAppData=')) {
      const needle = 'tgWebAppData=';
      let i = raw.indexOf(needle);
      while (i >= 0) {
        const start = i + needle.length;
        let j = start;
        while (j < raw.length && raw[j] !== '&') j++;
        const part = raw.slice(start, j);
        if (part) {
          try {
            const dec = decodeURIComponent(part.replace(/\+/g, ' '));
            if (dec.includes('hash=')) return dec.trim();
          } catch (e) { /* next */ }
        }
        i = raw.indexOf(needle, j + 1);
      }
    }
  } catch (e) {
    /* ignore */
  }
  return '';
}

/**
 * Извлекает и валидирует текущего пользователя из initData (заголовок или query).
 * Если токен не задан (локальный dev) — пропускает гостя без id.
 *
 * Возвращает { id, username, first_name, last_name, photo_url, isAdmin } или null.
 */
export async function authenticate(req, env) {
  const initData = initDataFromRequest(req);
  if (!initData) return null;
  const user = await verifyInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (!user) return null;

  const adminIds = new Set(
    String(env.ADMIN_TG_IDS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  );
  const premiumIds = new Set(
    String(env.PREMIUM_TG_IDS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  );
  const uid = String(user.id);
  user.id = uid; // ENSURE STRING ID for DB queries
  user.isAdmin = [...adminIds].some(a => String(a) === uid);
  user.isPremium = [...premiumIds].some(a => String(a) === uid);
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
