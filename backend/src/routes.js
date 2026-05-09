import { json, error, newId } from './http.js';
import { isMissingColumnError, isMissingTableError } from './db-errors.js';
import { authenticate, upsertUser, initDataFromRequest } from './auth.js';
import { tryDeleteGithubRepoForAuthor } from './github-repo-delete.js';
import {
  safeHttpsUrl,
  validateSubmission,
  validateGameListingPatch,
  validateProfilePatch,
  validateGameReview,
} from './validators.js';

// ──────────────────────────────────────────────────────────────
// PUBLIC
// ──────────────────────────────────────────────────────────────

const FEED_PAGE_DEFAULT = 15;
const FEED_PAGE_MAX = 40;

/**
 * Основной SQL-запрос для ленты игр.
 * Мы отказались от перебора вариантов SQL (антипаттерн), предполагая, что БД мигрирована.
 */
const PUBLISHED_FEED_SQL = `
  SELECT g.id, g.title, g.description, g.genre, g.genre_emoji AS genreEmoji,
          g.url, g.image_url AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          g.created_at AS createdAt, g.updated_at AS updatedAt,
          u.site_handle AS authorHandle, u.first_name AS authorFirst, u.last_name AS authorLast,
          u.display_name AS authorDisplayName,
          COALESCE(u.photo_url, '') AS authorPhoto
     FROM games g
     LEFT JOIN users u ON u.id = g.author_id
    WHERE g.status = 'published'
    ORDER BY g.created_at DESC
    LIMIT ?1 OFFSET ?2`;

async function publishedFeedGamesQuery(db, limit, offset, orderBy = 'g.created_at DESC') {
  const safeOrder = orderBy === 'RANDOM()' ? 'RANDOM()' : 'g.created_at DESC';
  const sql = PUBLISHED_FEED_SQL.replace(/ORDER\s+BY\s+g\.created_at\s+DESC/i, `ORDER BY ${safeOrder}`);
  return db.prepare(sql).bind(limit, offset).all();
}

// Вспомогательные функции для совместимости, теперь просто выполняют первый запрос
async function firstSuccessfulAll(db, sqlStrings, bindArgs = []) {
  return bindArgs.length ? await db.prepare(sqlStrings[0]).bind(...bindArgs).all() : await db.prepare(sqlStrings[0]).all();
}

async function firstSuccessfulFirst(db, sqlStrings, bindArgs = []) {
  return bindArgs.length ? await db.prepare(sqlStrings[0]).bind(...bindArgs).first() : await db.prepare(sqlStrings[0]).first();
}

/** Та же схема колонок, что и лента, но только pending — для админа в начале ленты. */
const PENDING_QUEUE_SQL = PUBLISHED_FEED_SQL
    .replace("WHERE g.status = 'published'", "WHERE g.status = 'pending'")
    .replace('ORDER BY g.created_at DESC', 'ORDER BY g.created_at ASC');

async function pendingQueueGamesQuery(db, cap = 100) {
  return db.prepare(PENDING_QUEUE_SQL).bind(cap, 0).all();
}

/** Очередь модерации без JOIN users. */
const PENDING_QUEUE_GAMES_ONLY_SQL = `
  SELECT g.id, g.title, g.description, g.genre, g.genre_emoji AS genreEmoji,
          g.url, g.image_url AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          CAST(NULL AS TEXT) AS authorHandle,
          CAST(NULL AS TEXT) AS authorFirst,
          CAST(NULL AS TEXT) AS authorLast,
          CAST(NULL AS TEXT) AS authorDisplayName,
          CAST(NULL AS TEXT) AS authorPhoto
     FROM games g
    WHERE g.status = 'pending'
    ORDER BY g.created_at ASC
    LIMIT ?1 OFFSET ?2`;

async function pendingQueueGamesOnlyQuery(db, cap = 100) {
  return db.prepare(PENDING_QUEUE_GAMES_ONLY_SQL).bind(cap, 0).all();
}

function mapFeedGameRow(g, likedSet, followedSet, bookmarkedSet, extra = {}) {
  return {
    id: g.id,
    title: g.title,
    description: g.description,
    genre: g.genre,
    genreEmoji: g.genreEmoji,
    url: g.url,
    imageUrl: g.imageUrl,
    likes: g.likes,
    plays: g.plays,
    createdAt: g.createdAt != null ? Number(g.createdAt) : null,
    updatedAt: g.updatedAt != null ? Number(g.updatedAt) : null,
    authorId: g.authorId != null && g.authorId !== '' ? String(g.authorId) : g.authorId,
    authorName: (g.authorDisplayName && String(g.authorDisplayName).trim())
      || [g.authorFirst, g.authorLast].filter(Boolean).join(' ')
      || g.authorHandle
      || 'Аноним',
    authorHandle: g.authorHandle || '',
    authorAvatar: g.authorPhoto || (g.authorFirst?.[0] || '?'),
    isLiked: likedSet.has(g.id),
    isFollowing: followedSet.has(g.authorId),
    isBookmarked: bookmarkedSet.has(g.id),
    ...extra,
  };
}

const GAME_BY_ID_SQL = `
  SELECT g.id, g.title, g.description, g.genre, g.genre_emoji AS genreEmoji,
          g.url, g.image_url AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          g.status, g.created_at AS createdAt, g.updated_at AS updatedAt,
          u.site_handle AS authorHandle, u.first_name AS authorFirst, u.last_name AS authorLast,
          u.display_name AS authorDisplayName,
          COALESCE(NULLIF(TRIM(u.avatar_override_url), ''), u.photo_url) AS authorPhoto
     FROM games g
     LEFT JOIN users u ON u.id = g.author_id
    WHERE g.id = ?`;

async function gameByIdRow(db, gameId) {
  return db.prepare(GAME_BY_ID_SQL).bind(gameId).first();
}

export async function getFeed(req, env) {
  const user = await authenticate(req, env);
  const userId = user?.id ?? null;

  const url = new URL(req.url);
  let offset = Number(url.searchParams.get('offset') || 0);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  let shuffle = url.searchParams.get('shuffle') === 'true';
  let limit = Number(url.searchParams.get('limit') || FEED_PAGE_DEFAULT);
  if (!Number.isFinite(limit) || limit < 1) limit = FEED_PAGE_DEFAULT;
  limit = Math.min(FEED_PAGE_MAX, Math.max(1, Math.floor(limit)));

  // Только опубликованные. По умолчанию новые первыми (created_at DESC).
  // Если shuffle=true — случайный порядок (RANDOM()).
  const { results } = await publishedFeedGamesQuery(env.DB, limit, offset, shuffle ? 'RANDOM()' : 'g.created_at DESC');

  const headers = {};
  // Кэшируем ленту на уровне CDN на 1 минуту, если это не случайный порядок
  if (!shuffle) {
    headers['Cache-Control'] = 'public, max-age=60';
  }

  let likedSet = new Set();
  let followedSet = new Set();
  let bookmarkedSet = new Set();
  if (userId) {
    const [likes, follows, bookmarks] = await Promise.all([
      env.DB.prepare(`SELECT game_id FROM likes WHERE user_id = ?`).bind(userId).all(),
      env.DB.prepare(`SELECT author_id FROM follows WHERE user_id = ?`).bind(userId).all(),
      env.DB.prepare(`SELECT game_id FROM bookmarks WHERE user_id = ?`).bind(userId).all()
    ]);
    likedSet = new Set((likes.results || []).map(r => r.game_id));
    followedSet = new Set((follows.results || []).map(r => r.author_id));
    bookmarkedSet = new Set((bookmarks.results || []).map(r => r.game_id));
  }

  const games = results.map(g =>
    mapFeedGameRow(g, likedSet, followedSet, bookmarkedSet, { status: 'published' })
  );

  let pendingQueue = [];
  let pendingCount = 0;
  if (user?.isAdmin === true) {
    try {
      let pendRows = [];
      try {
        ({ results: pendRows } = await pendingQueueGamesQuery(env.DB, 100));
      } catch (e1) {
        console.error('getFeed pendingQueue join', e1);
      }
      if (!pendRows?.length) {
        try {
          ({ results: pendRows } = await pendingQueueGamesOnlyQuery(env.DB, 100));
        } catch (e2) {
          console.error('getFeed pendingQueue games-only', e2);
        }
      }
      pendingQueue = (pendRows || []).map(g =>
        mapFeedGameRow(g, likedSet, followedSet, bookmarkedSet, {
          status: 'pending',
          isModerationQueue: true,
        })
      );
      pendingCount = pendingQueue.length;
    } catch (e) {
      console.error('getFeed pendingQueue', e);
    }
  }

  return json({
    games,
    offset,
    limit,
    hasMore: results.length === limit,
    isAdmin: user?.isAdmin === true,
    pendingQueue,
    pendingCount,
  }, 200, headers);
}

const GET_ME_SQL_VARIANTS = [
  `SELECT site_handle AS siteHandle,
          display_name AS displayName,
          bio AS bio,
          github_login AS githubLogin,
          github_user_id AS githubUserId,
          github_access_token_enc AS githubAccessTokenEnc,
          photo_url AS avatarUrl
     FROM users WHERE id = ?`,
  `SELECT site_handle AS siteHandle,
          display_name AS displayName,
          bio AS bio,
          github_login AS githubLogin,
          github_user_id AS githubUserId,
          github_access_token_enc AS githubAccessTokenEnc,
          photo_url AS avatarUrl
     FROM users WHERE id = ?`,
  `SELECT site_handle AS siteHandle,
          display_name AS displayName,
          bio AS bio,
          github_login AS githubLogin,
          github_user_id AS githubUserId,
          photo_url AS avatarUrl
     FROM users WHERE id = ?`,
  `SELECT site_handle AS siteHandle,
          display_name AS displayName,
          bio AS bio,
          github_login AS githubLogin,
          github_user_id AS githubUserId,
          photo_url AS avatarUrl
     FROM users WHERE id = ?`,
  `SELECT site_handle AS siteHandle,
          CAST(NULL AS TEXT) AS displayName,
          CAST(NULL AS TEXT) AS bio,
          github_login AS githubLogin,
          github_user_id AS githubUserId,
          github_access_token_enc AS githubAccessTokenEnc,
          photo_url AS avatarUrl
     FROM users WHERE id = ?`,
  `SELECT site_handle AS siteHandle,
          CAST(NULL AS TEXT) AS displayName,
          CAST(NULL AS TEXT) AS bio,
          github_login AS githubLogin,
          github_user_id AS githubUserId,
          photo_url AS avatarUrl
     FROM users WHERE id = ?`,
  `SELECT site_handle AS siteHandle,
          display_name AS displayName,
          bio AS bio,
          photo_url AS avatarUrl
     FROM users WHERE id = ?`,
  `SELECT site_handle AS siteHandle,
          display_name AS displayName,
          bio AS bio,
          photo_url AS avatarUrl
     FROM users WHERE id = ?`,
  `SELECT site_handle AS siteHandle,
          CAST(NULL AS TEXT) AS displayName,
          CAST(NULL AS TEXT) AS bio,
          photo_url AS avatarUrl
     FROM users WHERE id = ?`,
];

/**
 * Читает привязку GitHub отдельно (GET_ME_SQL_VARIANTS может быть без этих колонок).
 * D1/SQLite иногда отдают ключи в snake_case — нормализуем.
 */
function normalizeGithubLinkRow(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const uid =
    raw.githubUserId ??
    raw.github_user_id ??
    raw.GITHUB_USER_ID ??
    null;
  const login =
    raw.githubLogin ??
    raw.github_login ??
    raw.GITHUB_LOGIN ??
    null;
  const enc =
    raw.githubAccessTokenEnc ??
    raw.github_access_token_enc ??
    raw.GITHUB_ACCESS_TOKEN_ENC ??
    null;
  return {
    githubUserId: uid != null && String(uid).trim() !== '' ? String(uid) : null,
    githubLogin: login != null && String(login).trim() !== '' ? String(login) : null,
    githubAccessTokenEnc: enc != null && String(enc).trim() !== '' ? String(enc) : null,
  };
}

async function fetchGithubLinkRow(db, userId) {
  const tries = [
    `SELECT github_user_id, github_login, github_access_token_enc FROM users WHERE id = ?`,
    `SELECT github_user_id, github_login FROM users WHERE id = ?`,
  ];
  for (const sql of tries) {
    try {
      const raw = await db.prepare(sql).bind(userId).first();
      return normalizeGithubLinkRow(raw);
    } catch (e) {
      if (!isMissingColumnError(e)) throw e;
    }
  }
  return null;
}

export async function getMe(req, env) {
  const initHeader = initDataFromRequest(req);
  if (!initHeader) {
    return error(
      'Нет данных входа из Telegram. Открой мини-апп только из бота (не из обычного браузера по ссылке).',
      401
    );
  }
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token || !String(token).trim()) {
    return error(
      'На сервере не задан TELEGRAM_BOT_TOKEN. Владельцу Worker: npx wrangler secret put TELEGRAM_BOT_TOKEN (токен этого бота из @BotFather).',
      503
    );
  }
  const user = await authenticate(req, env);
  if (!user) {
    return error(
      'Телеграм не подтвердил сессию (initData). Часто помогает: полностью закрыть мини-апп и открыть снова из бота. Если не помогает — на Cloudflare в Worker проверь, что TELEGRAM_BOT_TOKEN от того же бота, что и мини-апп.',
      401
    );
  }
  await upsertUser(env.DB, user);
  const dbUser = await firstSuccessfulFirst(env.DB, GET_ME_SQL_VARIANTS, [user.id]);
  if (dbUser && !('githubAccessTokenEnc' in dbUser)) dbUser.githubAccessTokenEnc = null;

  const ghRow = await fetchGithubLinkRow(env.DB, user.id);
  if (ghRow) {
    dbUser.githubUserId = ghRow.githubUserId;
    dbUser.githubLogin = ghRow.githubLogin;
    dbUser.githubAccessTokenEnc = ghRow.githubAccessTokenEnc;
  }

  // Статистика автора (одна строка — надёжнее .first(), чем .all()[0] в D1).
  const statsRow = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM games   WHERE author_id = ?1 AND status='published') AS gamesCount,
       (SELECT COALESCE(SUM(likes),0) FROM games WHERE author_id = ?1) AS likesTotal,
       (SELECT COUNT(*) FROM follows WHERE author_id = ?1) AS followersCount`
  ).bind(user.id).first();
  const s = statsRow && typeof statsRow === 'object' ? statsRow : {};

  const tgName = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const displayName = (dbUser?.displayName && String(dbUser.displayName).trim())
    || tgName
    || (dbUser?.siteHandle || user.id);
  const avatar =
    (dbUser?.avatarUrl && String(dbUser.avatarUrl).trim())
    || user.photo_url
    || user.first_name?.[0]
    || '?';

  return json({
    user: {
      id: user.id,
      siteHandle: dbUser?.siteHandle || user.id,
      name: displayName,
      displayName: (dbUser?.displayName && String(dbUser.displayName).trim()) || '',
      telegramName: tgName,
      bio: dbUser?.bio != null ? String(dbUser.bio) : '',
      avatar,
      isGithubConnected: Boolean(dbUser?.githubUserId),
      githubUsername: dbUser?.githubLogin || null,
      hasGithubPublishToken: Boolean(dbUser?.githubAccessTokenEnc),
      isAdmin: user.isAdmin === true,
      isPremium: user.isPremium === true,
    },
    stats: {
      games: s.gamesCount ?? 0,
      likes: s.likesTotal ?? 0,
      followers: s.followersCount ?? 0,
    },
  });
}

export async function updateMe(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);
  await upsertUser(env.DB, user);

  let body;
  try { body = await req.json(); } catch (e) { return error('invalid json'); }

  const { ok, error: verr } = validateProfilePatch(body);
  if (verr) return error(verr);

  if (ok.siteHandle) {
    const conflict = await env.DB.prepare(
      `SELECT id FROM users WHERE site_handle = ? AND id <> ?`
    ).bind(ok.siteHandle, user.id).first();
    if (conflict) return error('Этот публичный ID уже занят', 409);
  }

  const sets = [];
  const vals = [];
  if (ok.displayName !== undefined) {
    sets.push('display_name = ?');
    vals.push(ok.displayName);
  }
  if (ok.bio !== undefined) {
    sets.push('bio = ?');
    vals.push(ok.bio);
  }
  if (ok.siteHandle !== undefined) {
    sets.push('site_handle = ?');
    vals.push(ok.siteHandle);
  }
  if (ok.clearAvatar) {
    sets.push('avatar_override_url = NULL');
  } else if (ok.photoUrl !== undefined) {
    sets.push('avatar_override_url = ?');
    vals.push(ok.photoUrl);
  }

  if (sets.length === 0) return error('Нечего обновить');
  vals.push(user.id);
  await env.DB.prepare(
    `UPDATE users SET ${sets.join(', ')} WHERE id = ?`
  ).bind(...vals).run();

  return getMe(req, env);
}

/**
 * Удалить аккаунт текущего пользователя и все связанные данные.
 * Это необратимое действие.
 */
export async function deleteAccount(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  const uid = user.id;

  // 1. Получаем список игр пользователя, чтобы потенциально удалить их с GitHub
  const games = await env.DB.prepare(
    `SELECT id, url FROM games WHERE author_id = ?`
  ).bind(uid).all();

  // 2. Для каждой игры пробуем удалить репозиторий (если есть линк)
  if (games && games.results) {
    for (const g of games.results) {
      if (g.url) {
        await tryDeleteGithubRepoForAuthor(env, uid, g.url);
      }
    }
  }

  // 3. Удаляем всё из БД. Благодаря ON DELETE CASCADE в схеме,
  // достаточно удалить пользователя. Но для совместимости со старыми базами
  // (где CASCADE может не быть) оставляем явное удаление связанных данных.
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM likes WHERE user_id = ?`).bind(uid),
    env.DB.prepare(`DELETE FROM bookmarks WHERE user_id = ?`).bind(uid),
    env.DB.prepare(`DELETE FROM game_reviews WHERE user_id = ?`).bind(uid),
    env.DB.prepare(`DELETE FROM user_posts WHERE user_id = ?`).bind(uid),
    env.DB.prepare(`DELETE FROM user_game_plays WHERE user_id = ?`).bind(uid),
    env.DB.prepare(`DELETE FROM oauth_states WHERE user_id = ?`).bind(uid),
    env.DB.prepare(`DELETE FROM follows WHERE user_id = ? OR author_id = ?`).bind(uid, uid),
    env.DB.prepare(`DELETE FROM activity WHERE user_id = ? OR actor_id = ?`).bind(uid, uid),
    env.DB.prepare(`DELETE FROM games WHERE author_id = ?`).bind(uid),
    env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(uid),
  ]);

  return json({ ok: true, message: 'Account deleted' });
}

/** POST /api/auth/github/unlink — снять привязку GitHub и удалить сохранённый токен. */
export async function githubUnlink(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);
  try {
    await env.DB.prepare(
      `UPDATE users SET github_user_id = NULL, github_login = NULL, github_access_token_enc = NULL WHERE id = ?`
    )
      .bind(user.id)
      .run();
  } catch (e) {
    if (!isMissingColumnError(e)) throw e;
    try {
      await env.DB.prepare(
        `UPDATE users SET github_user_id = NULL, github_login = NULL WHERE id = ?`
      )
        .bind(user.id)
        .run();
    } catch (e2) {
      if (!isMissingColumnError(e2)) throw e2;
    }
  }
  return json({ ok: true });
}

export async function getMyGames(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  const { results } = await env.DB.prepare(
    `SELECT id, title, description, genre, genre_emoji AS genreEmoji,
            url, image_url AS imageUrl, likes, plays, author_id AS authorId, status
       FROM games
      WHERE author_id = ?
      ORDER BY created_at DESC`
  ).bind(user.id).all();

  const games = (results || []).map(r => ({
    ...r,
    authorId: r.authorId != null && r.authorId !== '' ? String(r.authorId) : r.authorId,
  }));
  return json({ games });
}

const LIKED_GAMES_SQL_VARIANTS = [
  `SELECT g.id, g.title, g.description, g.genre, g.genre_emoji AS genreEmoji,
          g.url, g.image_url AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          u.site_handle AS authorHandle, u.first_name AS authorFirst, u.last_name AS authorLast,
          u.display_name AS authorDisplayName,
          u.photo_url AS authorPhoto
     FROM likes l
     JOIN games g ON g.id = l.game_id AND g.status = 'published'
     LEFT JOIN users u ON u.id = g.author_id
    WHERE l.user_id = ?1
    ORDER BY l.created_at DESC`,
  `SELECT g.id, g.title, g.description, g.genre, CAST(NULL AS TEXT) AS genreEmoji,
          g.url, CAST(NULL AS TEXT) AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          u.site_handle AS authorHandle, u.first_name AS authorFirst, u.last_name AS authorLast,
          u.display_name AS authorDisplayName,
          u.photo_url AS authorPhoto
     FROM likes l
     JOIN games g ON g.id = l.game_id AND g.status = 'published'
     LEFT JOIN users u ON u.id = g.author_id
    WHERE l.user_id = ?1
    ORDER BY l.created_at DESC`,
  `SELECT g.id, g.title, g.description, g.genre, g.genre_emoji AS genreEmoji,
          g.url, g.image_url AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          COALESCE(NULLIF(TRIM(u.username), ''), u.id) AS authorHandle,
          u.first_name AS authorFirst, u.last_name AS authorLast,
          CAST(NULL AS TEXT) AS authorDisplayName,
          u.photo_url AS authorPhoto
     FROM likes l
     JOIN games g ON g.id = l.game_id AND g.status = 'published'
     LEFT JOIN users u ON u.id = g.author_id
    WHERE l.user_id = ?1
    ORDER BY l.created_at DESC`,
  `SELECT g.id, g.title, g.description, g.genre, CAST(NULL AS TEXT) AS genreEmoji,
          g.url, CAST(NULL AS TEXT) AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          COALESCE(NULLIF(TRIM(u.username), ''), u.id) AS authorHandle,
          u.first_name AS authorFirst, u.last_name AS authorLast,
          CAST(NULL AS TEXT) AS authorDisplayName,
          u.photo_url AS authorPhoto
     FROM likes l
     JOIN games g ON g.id = l.game_id AND g.status = 'published'
     LEFT JOIN users u ON u.id = g.author_id
    WHERE l.user_id = ?1
    ORDER BY l.created_at DESC`,
];

export async function getLikedGames(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  const [likes, follows, bookmarks, gamesRes] = await Promise.all([
    env.DB.prepare(`SELECT game_id FROM likes WHERE user_id = ?`).bind(user.id).all(),
    env.DB.prepare(`SELECT author_id FROM follows WHERE user_id = ?`).bind(user.id).all(),
    env.DB.prepare(`SELECT game_id FROM bookmarks WHERE user_id = ?`).bind(user.id).all(),
    firstSuccessfulAll(env.DB, LIKED_GAMES_SQL_VARIANTS, [user.id]),
  ]);

  const likedSet = new Set((likes.results || []).map(r => r.game_id));
  const followedSet = new Set((follows.results || []).map(r => r.author_id));
  const bookmarkedSet = new Set((bookmarks.results || []).map(r => r.game_id));

  const { results } = gamesRes;
  const games = (results || []).map(g => mapFeedGameRow(g, likedSet, followedSet, bookmarkedSet));
  return json({ games });
}

const PLAYED_GAMES_SQL_VARIANTS = [
  `SELECT g.id, g.title, g.description, g.genre, g.genre_emoji AS genreEmoji,
          g.url, g.image_url AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          u.site_handle AS authorHandle, u.first_name AS authorFirst, u.last_name AS authorLast,
          u.display_name AS authorDisplayName,
          u.photo_url AS authorPhoto
     FROM user_game_plays p
     JOIN games g ON g.id = p.game_id AND g.status = 'published'
     LEFT JOIN users u ON u.id = g.author_id
    WHERE p.user_id = ?1
    ORDER BY p.last_played_at DESC`,
  `SELECT g.id, g.title, g.description, g.genre, CAST(NULL AS TEXT) AS genreEmoji,
          g.url, CAST(NULL AS TEXT) AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          u.site_handle AS authorHandle, u.first_name AS authorFirst, u.last_name AS authorLast,
          u.display_name AS authorDisplayName,
          u.photo_url AS authorPhoto
     FROM user_game_plays p
     JOIN games g ON g.id = p.game_id AND g.status = 'published'
     LEFT JOIN users u ON u.id = g.author_id
    WHERE p.user_id = ?1
    ORDER BY p.last_played_at DESC`,
  `SELECT g.id, g.title, g.description, g.genre, g.genre_emoji AS genreEmoji,
          g.url, g.image_url AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          COALESCE(NULLIF(TRIM(u.username), ''), u.id) AS authorHandle,
          u.first_name AS authorFirst, u.last_name AS authorLast,
          CAST(NULL AS TEXT) AS authorDisplayName,
          u.photo_url AS authorPhoto
     FROM user_game_plays p
     JOIN games g ON g.id = p.game_id AND g.status = 'published'
     LEFT JOIN users u ON u.id = g.author_id
    WHERE p.user_id = ?1
    ORDER BY p.last_played_at DESC`,
  `SELECT g.id, g.title, g.description, g.genre, CAST(NULL AS TEXT) AS genreEmoji,
          g.url, CAST(NULL AS TEXT) AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          COALESCE(NULLIF(TRIM(u.username), ''), u.id) AS authorHandle,
          u.first_name AS authorFirst, u.last_name AS authorLast,
          CAST(NULL AS TEXT) AS authorDisplayName,
          u.photo_url AS authorPhoto
     FROM user_game_plays p
     JOIN games g ON g.id = p.game_id AND g.status = 'published'
     LEFT JOIN users u ON u.id = g.author_id
    WHERE p.user_id = ?1
    ORDER BY p.last_played_at DESC`,
];

export async function getPlayedGames(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  try {
    const [likes, follows, bookmarks, gamesRes] = await Promise.all([
      env.DB.prepare(`SELECT game_id FROM likes WHERE user_id = ?`).bind(user.id).all(),
      env.DB.prepare(`SELECT author_id FROM follows WHERE user_id = ?`).bind(user.id).all(),
      env.DB.prepare(`SELECT game_id FROM bookmarks WHERE user_id = ?`).bind(user.id).all(),
      firstSuccessfulAll(env.DB, PLAYED_GAMES_SQL_VARIANTS, [user.id]),
    ]);

    const likedSet = new Set((likes.results || []).map(r => r.game_id));
    const followedSet = new Set((follows.results || []).map(r => r.author_id));
    const bookmarkedSet = new Set((bookmarks.results || []).map(r => r.game_id));
    const { results } = gamesRes;
    const games = (results || []).map(g => mapFeedGameRow(g, likedSet, followedSet, bookmarkedSet));
    return json({ games });
  } catch (e) {
    if (/no such table/i.test(String(e?.message || e))) return json({ games: [] });
    throw e;
  }
}

/** GET /api/me/games-library — лайкнутые + «играл» одним round-trip (меньше холодных стартов Worker). */
export async function getMyGamesLibraryBatch(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  const likesP = env.DB.prepare(`SELECT game_id FROM likes WHERE user_id = ?`).bind(user.id).all();
  const followsP = env.DB.prepare(`SELECT author_id FROM follows WHERE user_id = ?`).bind(user.id).all();
  const bookmarksP = env.DB.prepare(`SELECT game_id FROM bookmarks WHERE user_id = ?`).bind(user.id).all();
  const likedP = firstSuccessfulAll(env.DB, LIKED_GAMES_SQL_VARIANTS, [user.id]);
  const playedP = firstSuccessfulAll(env.DB, PLAYED_GAMES_SQL_VARIANTS, [user.id]).catch(e => {
    if (/no such table/i.test(String(e?.message || e))) return { results: [] };
    throw e;
  });

  const [likes, follows, bookmarks, likedRes, playedRes] = await Promise.all([
    likesP,
    followsP,
    bookmarksP,
    likedP,
    playedP,
  ]);

  const likedSet = new Set((likes.results || []).map(r => r.game_id));
  const followedSet = new Set((follows.results || []).map(r => r.author_id));
  const bookmarkedSet = new Set((bookmarks.results || []).map(r => r.game_id));

  const likedGames = (likedRes.results || []).map(g =>
    mapFeedGameRow(g, likedSet, followedSet, bookmarkedSet)
  );
  const playedGames = (playedRes.results || []).map(g =>
    mapFeedGameRow(g, likedSet, followedSet, bookmarkedSet)
  );

  return json({ likedGames, playedGames });
}

export async function checkRegistered(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);
  await upsertUser(env.DB, user);
  const row = await env.DB.prepare(
    `SELECT site_handle AS siteHandle, date_of_birth AS dateOfBirth,
            consented_at AS consentedAt, tos_accepted_at AS tosAcceptedAt,
            parent_consent AS parentConsent
       FROM users WHERE id = ?`
  ).bind(user.id).first();
  return json({
    registered: Boolean(row?.dateOfBirth && row?.consentedAt && row?.tosAcceptedAt && row?.siteHandle),
    user: row || null,
  });
}

export async function register(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);
  await upsertUser(env.DB, user);

  let body;
  try { body = await req.json(); } catch (e) { return error('invalid json'); }

  const dateOfBirth = String(body.dateOfBirth || '').trim();
  const siteHandle = String(body.siteHandle || '').trim().toLowerCase();
  const parentConsent = Boolean(body.parentConsent);
  const privacyAccepted = Boolean(body.privacyAccepted);
  const tosAccepted = Boolean(body.tosAccepted);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return error('Укажи дату рождения');
  const age = ageFromDate(dateOfBirth);
  if (age < 13) return error('Возраст должен быть 13+', 403);
  if (age < 18 && !parentConsent) return error('Нужно согласие родителя или опекуна');
  if (!privacyAccepted) return error('Нужно принять политику приватности');
  if (!tosAccepted) return error('Нужно принять пользовательское соглашение');
  if (!/^[a-z0-9_]{3,24}$/.test(siteHandle)) {
    return error('Публичный ID: 3-24 символа, латиница, цифры или _');
  }

  const conflict = await env.DB.prepare(
    `SELECT id FROM users WHERE site_handle = ? AND id <> ?`
  ).bind(siteHandle, user.id).first();
  if (conflict) return error('Этот публичный ID уже занят', 409);

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE users
        SET site_handle = ?, date_of_birth = ?, consented_at = ?,
            tos_accepted_at = ?, parent_consent = ?, registered_at = ?
      WHERE id = ?`
  ).bind(siteHandle, dateOfBirth, now, now, parentConsent ? 1 : 0, now, user.id).run();

  return json({ ok: true, user: { id: user.id, siteHandle } });
}

export async function submitGame(req, env) {
  try {
    const initHeader = initDataFromRequest(req);
    const user = await authenticate(req, env);
    if (!user) {
      if (!initHeader) {
        return error('Нет данных входа из Telegram. Открой мини-апп только из бота, не из обычного браузера.', 401);
      }
      const token = env.TELEGRAM_BOT_TOKEN;
      if (!token || !String(token).trim()) {
        return error(
          'Нет TELEGRAM_BOT_TOKEN на Worker. Владельцу: npx wrangler secret put TELEGRAM_BOT_TOKEN (токен этого бота).',
          503
        );
      }
      return error(
        'Вход из Telegram не подтверждён (initData). Чаще всего: токен на Worker от другого бота. Закрой мини-апп и открой снова.',
        401
      );
    }

    try {
      await upsertUser(env.DB, user);
    } catch (e) {
      console.error('submitGame upsertUser', e);
      const m = String(e?.message || e || '').trim().slice(0, 200);
      return error(
        m
          ? `Не удалось обновить профиль в базе: ${m}. Открой мини-апп из бота заново или напиши админу.`
          : 'Не удалось обновить профиль в базе. Открой мини-апп из бота заново.',
        500
      );
    }

    let body;
    try { body = await req.json(); } catch (e) { return error('invalid json'); }

    const { ok, error: verr } = validateSubmission(body);
    if (verr) return error(verr);

    const id = newId();
    const desc = ok.description ?? '';
    const emoji = ok.genreEmoji ?? '🎮';
    const img = ok.imageUrl == null ? null : ok.imageUrl;
    try {
      await env.DB.prepare(
        `INSERT INTO games (id, title, description, genre, genre_emoji, url, image_url, author_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      ).bind(id, ok.title, desc, ok.genre, emoji, ok.url, img, user.id).run();
    } catch (e) {
      console.error('submitGame insert', e);
      const msg = String(e?.message || e || '');
      if (/FOREIGN KEY constraint failed/i.test(msg)) {
        return error(
          'Профиль в базе не создался. Закрой мини-апп полностью, открой снова из бота, подожди пару секунд и отправь ещё раз.',
          409
        );
      }
      if (isMissingColumnError(e)) {
        try {
          await env.DB.prepare(
            `INSERT INTO games (id, title, description, genre, url, author_id, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`
          ).bind(id, ok.title, desc, ok.genre, ok.url, user.id).run();
        } catch (e2) {
          console.error('submitGame legacy insert', e2);
          const m2 = String(e2?.message || e2 || '');
          if (/FOREIGN KEY constraint failed/i.test(m2)) {
            return error(
              'Профиль в базе не создался. Открой мини-апп из бота заново и попробуй снова.',
              409
            );
          }
          return error('Не удалось сохранить игру (база). Попробуй позже.', 500);
        }
      } else {
        return error('Не удалось сохранить игру (база). Попробуй позже.', 500);
      }
    }

    return json({ ok: true, id, status: 'pending' });
  } catch (e) {
    console.error('submitGame unhandled', e);
    const detail = String(e?.message || e || '').trim().slice(0, 220);
    return error(
      detail
        ? `Ошибка при сохранении: ${detail}`
        : 'Не удалось сохранить игру. Повтори позже или обнови приложение.',
      500
    );
  }
}

export async function uploadImage(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);
  if (!env.IMAGES) return error('image storage is not configured', 501);

  let form;
  try { form = await req.formData(); } catch (e) { return error('invalid multipart form'); }
  const file = form.get('image');
  if (!file || typeof file === 'string') return error('Файл изображения обязателен');
  if (!String(file.type || '').startsWith('image/')) return error('Можно загрузить только изображение');
  if (file.size > 2 * 1024 * 1024) return error('Максимальный размер изображения — 2 МБ');

  const ext = extensionFromType(file.type);
  const kind = String(form.get('kind') || 'cover');
  const subdir = kind === 'avatar' ? 'avatars' : 'covers';
  const key = `${subdir}/${user.id}/${newId()}.${ext}`;
  await env.IMAGES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const base = env.PUBLIC_IMAGE_BASE_URL || env.R2_PUBLIC_URL;
  if (!base) return error('public image URL is not configured', 501);
  return json({ ok: true, imageUrl: `${String(base).replace(/\/$/, '')}/${key}` });
}

export async function getGameById(req, env, gameId) {
  const viewer = await authenticate(req, env);
  const viewerId = viewer?.id ?? null;

  const g = await gameByIdRow(env.DB, gameId);

  if (!g) return error('not found', 404);
  if (g.status !== 'published' && g.authorId !== viewerId) return error('not found', 404);

  let isLiked = false;
  let isFollowing = false;
  let isBookmarked = false;
  if (viewerId) {
    const [likeRow, followRow, bmRow] = await Promise.all([
      env.DB.prepare(`SELECT 1 FROM likes WHERE user_id = ? AND game_id = ?`).bind(viewerId, gameId).first(),
      env.DB.prepare(`SELECT 1 FROM follows WHERE user_id = ? AND author_id = ?`).bind(viewerId, g.authorId).first(),
      env.DB.prepare(`SELECT 1 FROM bookmarks WHERE user_id = ? AND game_id = ?`).bind(viewerId, gameId).first(),
    ]);
    isLiked = Boolean(likeRow);
    isFollowing = Boolean(followRow);
    isBookmarked = Boolean(bmRow);
  }

  return json({
    game: {
      id: g.id,
      title: g.title,
      description: g.description,
      genre: g.genre,
      genreEmoji: g.genreEmoji,
      url: g.url,
      imageUrl: g.imageUrl,
      likes: g.likes,
      plays: g.plays,
      createdAt: g.createdAt != null ? Number(g.createdAt) : null,
      updatedAt: g.updatedAt != null ? Number(g.updatedAt) : null,
      authorId: g.authorId,
      authorName: (g.authorDisplayName && String(g.authorDisplayName).trim())
        || [g.authorFirst, g.authorLast].filter(Boolean).join(' ')
        || g.authorHandle
        || 'Аноним',
      authorHandle: g.authorHandle || '',
      authorAvatar: g.authorPhoto || (g.authorFirst?.[0] || '?'),
      isLiked,
      isFollowing,
      isBookmarked,
      status: g.status,
    },
  });
}

const REVIEWS_LIST_SQL_VARIANTS = [
  `SELECT r.id, r.body, r.created_at AS createdAt, r.user_id AS authorId, r.parent_id AS parentId,
          u.display_name AS authorDisplayName, u.first_name AS authorFirst, u.last_name AS authorLast,
          u.site_handle AS authorHandle
     FROM game_reviews r
     LEFT JOIN users u ON u.id = r.user_id
    WHERE r.game_id = ?
    ORDER BY r.created_at DESC
    LIMIT 100`,
  `SELECT r.id, r.body, r.created_at AS createdAt, r.user_id AS authorId, r.parent_id AS parentId,
          CAST(NULL AS TEXT) AS authorDisplayName, u.first_name AS authorFirst, u.last_name AS authorLast,
          u.site_handle AS authorHandle
     FROM game_reviews r
     LEFT JOIN users u ON u.id = r.user_id
    WHERE r.game_id = ?
    ORDER BY r.created_at DESC
    LIMIT 100`,
];

function mapReviewRow(r) {
  const authorName =
    (r.authorDisplayName && String(r.authorDisplayName).trim())
    || [r.authorFirst, r.authorLast].filter(Boolean).join(' ')
    || r.authorHandle
    || 'Игрок';
  return {
    id: r.id,
    body: r.body,
    createdAt: r.createdAt != null ? Number(r.createdAt) : null,
    authorId: r.authorId,
    authorName,
    parentId: r.parentId || null,
  };
}

export async function listGameReviews(req, env, gameId) {
  const viewer = await authenticate(req, env);
  const viewerId = viewer?.id ?? null;
  const g = await gameByIdRow(env.DB, gameId);
  if (!g) return error('not found', 404);
  if (g.status !== 'published' && g.authorId !== viewerId) return error('not found', 404);

  try {
    const { results } = await firstSuccessfulAll(env.DB, REVIEWS_LIST_SQL_VARIANTS, [gameId]);
    return json({ reviews: (results || []).map(mapReviewRow) });
  } catch (e) {
    if (isMissingTableError(e)) return json({ reviews: [] });
    throw e;
  }
}

export async function postGameReview(req, env, gameId) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  const g = await gameByIdRow(env.DB, gameId);
  if (!g) return error('not found', 404);
  if (g.status !== 'published' && g.authorId !== user.id) return error('not found', 404);

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return error('invalid json');
  }
  const { ok, error: verr } = validateGameReview(body);
  if (verr) return error(verr);

  const id = newId();
  try {
    const res = await env.DB.prepare(
      `INSERT INTO game_reviews (id, game_id, user_id, parent_id, body, created_at)
       VALUES (?, ?, ?, ?, ?, unixepoch())`
    ).bind(id, gameId, user.id, body.parentId || null, ok.text).run();

    if (res.meta.changes > 0) {
      const activityPromise = (async () => {
        if (body.parentId) {
          const parent = await env.DB.prepare(`SELECT user_id FROM game_reviews WHERE id = ?`).bind(body.parentId).first();
          if (parent) await addActivity(env.DB, { userId: parent.user_id, actorId: user.id, type: 'reply', gameId, review_id: id });
        } else {
          await addActivity(env.DB, { userId: g.authorId, actorId: user.id, type: 'review', gameId, review_id: id });
        }
      })();
      if (req.ctx?.waitUntil) req.ctx.waitUntil(activityPromise);
    }
  } catch (e) {
    if (isMissingTableError(e)) {
      return error('Отзывы пока недоступны — админ должен выполнить миграцию БД (game_reviews).', 503);
    }
    throw e;
  }

  return json({ ok: true, id });
}

export async function updateGameReview(req, env, reviewId) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  let body;
  try { body = await req.json(); } catch (e) { return error('invalid json'); }
  const { ok, error: verr } = validateGameReview(body);
  if (verr) return error(verr);

  const row = await env.DB.prepare(`SELECT user_id FROM game_reviews WHERE id = ?`).bind(reviewId).first();
  if (!row) return error('not found', 404);
  if (row.user_id !== user.id) return error('forbidden', 403);

  await env.DB.prepare(`UPDATE game_reviews SET body = ?, created_at = unixepoch() WHERE id = ?`)
    .bind(ok.text, reviewId).run();

  return json({ ok: true });
}

export async function deleteGameReview(req, env, reviewId) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  const row = await env.DB.prepare(`SELECT user_id FROM game_reviews WHERE id = ?`).bind(reviewId).first();
  if (!row) return error('not found', 404);

  // Разрешаем удалять автору или админу
  const isAdmin = typeof env.ADMIN_TG_IDS === 'string' && env.ADMIN_TG_IDS.split(',').includes(String(user.id));
  if (row.user_id !== user.id && !isAdmin) return error('forbidden', 403);

  // Рекурсивное удаление всех вложенных ответов.
  // В SQLite с включенным FOREIGN KEY + ON DELETE CASCADE это произойдет автоматически,
  // если parent_id ссылается на id той же таблицы.
  // Для надежности на старых схемах делаем ручной каскад (хотя бы для одного уровня).
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM activity WHERE review_id = ?`).bind(reviewId),
    env.DB.prepare(`DELETE FROM game_reviews WHERE id = ? OR parent_id = ?`).bind(reviewId, reviewId),
  ]);

  return json({ ok: true });
}

export async function listUserPosts(req, env, userId) {
  const posts = await env.DB.prepare(`
    SELECT id, body, created_at as createdAt
    FROM user_posts
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).bind(userId).all();
  return json({ posts: posts.results || [] });
}

export async function createUserPost(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  let body;
  try { body = await req.json(); } catch (e) { return error('invalid json'); }
  const text = String(body?.body || '').trim().slice(0, 1000);
  if (!text) return error('post is empty');

  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO user_posts (id, user_id, body, created_at)
    VALUES (?, ?, ?, unixepoch())
  `).bind(id, user.id, text).run();

  return json({ ok: true, id });
}

export async function deleteUserPost(req, env, postId) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  const row = await env.DB.prepare(`SELECT user_id FROM user_posts WHERE id = ?`).bind(postId).first();
  if (!row) return error('not found', 404);

  const isAdmin = typeof env.ADMIN_TG_IDS === 'string' && env.ADMIN_TG_IDS.split(',').includes(String(user.id));
  if (row.user_id !== user.id && !isAdmin) return error('forbidden', 403);

  await env.DB.prepare(`DELETE FROM user_posts WHERE id = ?`).bind(postId).run();
  return json({ ok: true });
}

export async function deleteGame(req, env, gameId) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  const game = await env.DB.prepare(
    `SELECT author_id AS authorId, url AS url FROM games WHERE id = ?`
  ).bind(gameId).first();
  if (!game) return error('not found', 404);
  if (game.authorId !== user.id && user.isAdmin !== true) return error('forbidden', 403);

  let deleteGithubRepo = false;
  try {
    const body = await req.json().catch(() => ({}));
    deleteGithubRepo = Boolean(body?.deleteGithubRepo);
  } catch {
    deleteGithubRepo = false;
  }
  // Fallback to query param because DELETE body is often stripped
  if (!deleteGithubRepo) {
    const url = new URL(req.url);
    deleteGithubRepo = url.searchParams.get('deleteGithubRepo') === 'true';
  }

  let githubDeleted = false;
  let githubDeleteNote = '';
  const isAuthorSelf = game.authorId === user.id;
  /** Автор явно просит GitHub; админ при удалении карточки — пробуем убрать репо автора (если есть токен и URL Pages). */
  const shouldTryGithubDelete =
    Boolean(game.url) && (user.isAdmin === true || (isAuthorSelf && deleteGithubRepo));

  if (shouldTryGithubDelete) {
    const gh = await tryDeleteGithubRepoForAuthor(env, game.authorId, game.url);
    if (gh.ok) {
      githubDeleted = true;
    } else if (gh.error === 'not_github_pages') {
      githubDeleteNote = '';
    } else if (gh.error === 'repo_not_owned' || gh.error === 'github_not_linked') {
      githubDeleteNote =
        'Репозиторий на GitHub под другим аккаунтом или ссылка не Pages — удалили только карточку в SmolGame.';
    } else if (gh.error === 'no_token' || gh.error === 'token_invalid') {
      githubDeleteNote =
        'Репозиторий на GitHub не удалён: заново войди через GitHub в «Загрузить» и при необходимости удали репозиторий вручную на github.com.';
    } else {
      githubDeleteNote =
        `GitHub: ${String(gh.error || 'ошибка').slice(0, 120)} — карточку в SmolGame всё равно удалим.`;
    }
  }

  // Удаляем связанные записи из опциональных таблиц тихо (могут не существовать в старых схемах).
  // Это нужно сделать ДО основного batch, т.к. D1 batch не поддерживает частичные ошибки.
  for (const sql of [
    `DELETE FROM game_reviews WHERE game_id = ?`,
    `DELETE FROM user_game_plays WHERE game_id = ?`,
    `DELETE FROM activity WHERE game_id = ?`,
  ]) {
    try {
      await env.DB.prepare(sql).bind(gameId).run();
    } catch (e) {
      if (!isMissingTableError(e)) throw e;
    }
  }

  // Атомарно удаляем записи из гарантированно существующих таблиц и саму игру.
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM likes WHERE game_id = ?`).bind(gameId),
    env.DB.prepare(`DELETE FROM bookmarks WHERE game_id = ?`).bind(gameId),
    env.DB.prepare(`DELETE FROM games WHERE id = ?`).bind(gameId),
  ]);
  return json({
    ok: true,
    githubDeleted,
    ...(githubDeleteNote ? { githubDeleteNote } : {}),
  });
}

export async function updateGameListing(req, env, gameId) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  const row = await env.DB.prepare(
    `SELECT author_id AS authorId, status FROM games WHERE id = ?`
  ).bind(gameId).first();
  if (!row) return error('not found', 404);
  if (row.authorId !== user.id) return error('forbidden', 403);
  if (row.status === 'rejected') {
    return error('Игра отклонена — создай новую карточку через «Загрузить».', 403);
  }

  let body;
  try { body = await req.json(); } catch (e) { return error('invalid json'); }
  const { ok, error: verr } = validateGameListingPatch(body);
  if (verr) return error(verr);

  const desc = ok.description ?? '';
  const emoji = ok.genreEmoji ?? '🎮';

  try {
    if (ok.imageUrlPatch !== undefined) {
      await env.DB.prepare(
        `UPDATE games
            SET title = ?, description = ?, genre = ?, genre_emoji = ?,
                image_url = ?, status = 'pending', updated_at = unixepoch()
          WHERE id = ? AND author_id = ?`
      ).bind(ok.title, desc, ok.genre, emoji, ok.imageUrlPatch, gameId, user.id).run();
    } else {
      await env.DB.prepare(
        `UPDATE games
            SET title = ?, description = ?, genre = ?, genre_emoji = ?,
                status = 'pending', updated_at = unixepoch()
          WHERE id = ? AND author_id = ?`
      ).bind(ok.title, desc, ok.genre, emoji, gameId, user.id).run();
    }
  } catch (e) {
    if (isMissingColumnError(e)) {
      if (ok.imageUrlPatch !== undefined) {
        await env.DB.prepare(
          `UPDATE games
              SET title = ?, description = ?, genre = ?,
                  image_url = ?, status = 'pending', updated_at = unixepoch()
            WHERE id = ? AND author_id = ?`
        ).bind(ok.title, desc, ok.genre, ok.imageUrlPatch, gameId, user.id).run();
      } else {
        await env.DB.prepare(
          `UPDATE games
              SET title = ?, description = ?, genre = ?,
                  status = 'pending', updated_at = unixepoch()
            WHERE id = ? AND author_id = ?`
        ).bind(ok.title, desc, ok.genre, gameId, user.id).run();
      }
    } else {
      throw e;
    }
  }

  return getGameById(req, env, gameId);
}

export async function toggleLike(req, env, gameId, method) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  if (method === 'DELETE') {
    // batch: атомарно удаляем лайк и обновляем счётчик только если запись существовала
    const res = await env.DB.prepare(
      `DELETE FROM likes WHERE user_id = ? AND game_id = ?`
    ).bind(user.id, gameId).run();
    if (res.meta.changes > 0) {
      // Счётчик не уйдёт ниже 0 благодаря MAX(0, likes - 1)
      await env.DB.prepare(
        `UPDATE games SET likes = MAX(0, likes - 1) WHERE id = ?`
      ).bind(gameId).run();
    }
    return json({ ok: true, liked: false });
  }

  // POST — ставим лайк, если ещё нет.
  const res = await env.DB.prepare(
    `INSERT OR IGNORE INTO likes (user_id, game_id) VALUES (?, ?)`
  ).bind(user.id, gameId).run();
  if (res.meta.changes > 0) {
    await env.DB.prepare(`UPDATE games SET likes = likes + 1 WHERE id = ?`).bind(gameId).run();
    const activityPromise = (async () => {
      const g = await gameByIdRow(env.DB, gameId);
      if (g) await addActivity(env.DB, { userId: g.authorId, actorId: user.id, type: 'like', gameId });
    })();
    if (req.ctx?.waitUntil) req.ctx.waitUntil(activityPromise);
  }
  return json({ ok: true, liked: true });
}

export async function toggleFollow(req, env, authorId, method) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);
  if (user.id === authorId) return error('нельзя подписаться на себя');

  if (method === 'DELETE') {
    await env.DB.prepare(
      `DELETE FROM follows WHERE user_id = ? AND author_id = ?`
    ).bind(user.id, authorId).run();
    return json({ ok: true, following: false });
  }
  const res = await env.DB.prepare(
    `INSERT OR IGNORE INTO follows (user_id, author_id) VALUES (?, ?)`
  ).bind(user.id, authorId).run();
  if (res.meta.changes > 0) {
    await addActivity(env.DB, { userId: authorId, actorId: user.id, type: 'follow' });
  }
  return json({ ok: true, following: true });
}

export async function toggleBookmark(req, env, gameId, method) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  if (method === 'DELETE') {
    await env.DB.prepare(
      `DELETE FROM bookmarks WHERE user_id = ? AND game_id = ?`
    ).bind(user.id, gameId).run();
    return json({ ok: true, bookmarked: false });
  }

  await env.DB.prepare(
    `INSERT OR IGNORE INTO bookmarks (user_id, game_id) VALUES (?, ?)`
  ).bind(user.id, gameId).run();
  return json({ ok: true, bookmarked: true });
}

const GET_USER_PROFILE_SQL = `
  SELECT id, site_handle AS siteHandle, first_name AS firstName,
          last_name AS lastName, photo_url AS photoUrl,
          display_name AS displayName, bio AS bio,
          photo_url AS avatarUrl
     FROM users WHERE id = ?`;

export async function getUserProfile(req, env, userId) {
  const viewer = await authenticate(req, env);
  const statsSql = env.DB
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM games   WHERE author_id = ?1 AND status='published') AS games,
         (SELECT COALESCE(SUM(likes),0) FROM games WHERE author_id = ?1) AS likes,
         (SELECT COUNT(*) FROM follows WHERE author_id = ?1) AS followers`
    )
    .bind(userId);

  const [user, stats, followRow] = await Promise.all([
    env.DB.prepare(GET_USER_PROFILE_SQL).bind(userId).first(),
    statsSql.first(),
    viewer
      ? env.DB
          .prepare(`SELECT 1 AS ok FROM follows WHERE user_id = ? AND author_id = ?`)
          .bind(viewer.id, userId)
          .first()
      : Promise.resolve(null),
  ]);

  if (!user) return error('not found', 404);
  const isFollowing = Boolean(followRow?.ok ?? followRow);

  return json({
    user: publicUser(user),
    stats: stats || { games: 0, likes: 0, followers: 0 },
    isSelf: viewer?.id === userId,
    isFollowing,
  }, 200, { 'Cache-Control': 'public, max-age=30' });
}

export async function getUserGames(req, env, userId) {
  const viewer = await authenticate(req, env);
  const isSelf = viewer && viewer.id === userId;
  const statusSql = isSelf
    ? `status IN ('published', 'pending', 'rejected')`
    : `status = 'published'`;

  const { results } = await env.DB.prepare(
    `SELECT id, title, description, genre, genre_emoji AS genreEmoji,
            url, image_url AS imageUrl, likes, plays, author_id AS authorId, status
       FROM games
      WHERE author_id = ? AND ${statusSql}
      ORDER BY created_at DESC`
  ).bind(userId).all();
  return json({ games: results });
}

export async function play(req, env, gameId) {
  const user = await authenticate(req, env);
  await env.DB.prepare(
    `UPDATE games SET plays = plays + 1 WHERE id = ? AND status = 'published'`
  ).bind(gameId).run();
  if (user?.id) {
    try {
      await env.DB
        .prepare(
          `INSERT INTO user_game_plays (user_id, game_id, last_played_at)
           VALUES (?, ?, unixepoch())
           ON CONFLICT(user_id, game_id) DO UPDATE SET last_played_at = excluded.last_played_at`
        )
        .bind(user.id, gameId)
        .run();
    } catch (e) {
      if (!isMissingColumnError(e) && !/no such table/i.test(String(e?.message || e))) throw e;
    }
  }
  return json({ ok: true });
}

// ──────────────────────────────────────────────────────────────
// ADMIN
// ──────────────────────────────────────────────────────────────

async function requireAdmin(req, env) {
  const user = await authenticate(req, env);
  if (!user || !user.isAdmin) return { resp: error('forbidden', 403) };
  return { user };
}

export async function adminPending(req, env) {
  const { resp } = await requireAdmin(req, env);
  if (resp) return resp;

  const pendingSqlVariants = [
    `SELECT g.*, u.site_handle AS authorHandle, u.first_name AS authorFirst
       FROM games g
       LEFT JOIN users u ON u.id = g.author_id
      WHERE g.status = 'pending'
      ORDER BY g.created_at ASC`,
    `SELECT g.*, COALESCE(NULLIF(TRIM(u.username), ''), u.id) AS authorHandle, u.first_name AS authorFirst
       FROM games g
       LEFT JOIN users u ON u.id = g.author_id
      WHERE g.status = 'pending'
      ORDER BY g.created_at ASC`,
  ];
  const { results } = await firstSuccessfulAll(env.DB, pendingSqlVariants);

  return json({ games: results });
}

export async function adminApprove(req, env, gameId) {
  const { resp } = await requireAdmin(req, env);
  if (resp) return resp;
  await env.DB.prepare(
    `UPDATE games SET status = 'published', updated_at = unixepoch() WHERE id = ?`
  ).bind(gameId).run();
  return json({ ok: true });
}

export async function adminReject(req, env, gameId) {
  const { resp } = await requireAdmin(req, env);
  if (resp) return resp;
  await env.DB.prepare(
    `UPDATE games SET status = 'rejected', updated_at = unixepoch() WHERE id = ?`
  ).bind(gameId).run();
  return json({ ok: true });
}

function ageFromDate(dateOfBirth) {
  const birth = new Date(dateOfBirth + 'T00:00:00Z');
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthday =
    now.getUTCMonth() > birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthday) age -= 1;
  return age;
}

function extensionFromType(type) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';
  return 'jpg';
}

function publicUser(user) {
  const tgName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const display = (user.displayName && String(user.displayName).trim()) || tgName;
  const avatar =
    (user.avatarUrl && String(user.avatarUrl).trim())
    || user.photoUrl
    || user.firstName?.[0]
    || '?';
  return {
    id: user.id,
    siteHandle: user.siteHandle || user.id,
    name: display || user.siteHandle || 'Аноним',
    bio: user.bio != null ? String(user.bio) : '',
    avatar,
  };
}

export async function logRepost(req, env, gameId) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);
  const g = await gameByIdRow(env.DB, gameId);
  if (!g) return error('not found', 404);
  await addActivity(env.DB, { userId: g.authorId, actorId: user.id, type: 'repost', gameId });
  return json({ ok: true });
}

export async function getActivity(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);
  
  const results = await env.DB.prepare(`
    SELECT a.*, 
           u.first_name AS actorFirst, u.last_name AS actorLast, u.photo_url AS actorPhoto, u.site_handle AS actorHandle,
           g.title AS gameTitle
      FROM activity a
      LEFT JOIN users u ON u.id = a.actor_id
      LEFT JOIN games g ON g.id = a.game_id
     WHERE a.user_id = ?
     ORDER BY a.created_at DESC
     LIMIT 30
  `).bind(user.id).all();
  
  return json({ activities: results.results || [] });
}

export async function markActivityRead(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);
  await env.DB.prepare(`UPDATE activity SET is_read = 1 WHERE user_id = ?`).bind(user.id).run();
  return json({ ok: true });
}

async function addActivity(db, { userId, actorId, type, gameId, reviewId, postId }) {
  if (userId === actorId) return;
  const id = newId();
  try {
    await db.prepare(`
      INSERT INTO activity (id, user_id, actor_id, type, game_id, review_id, post_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(id, userId, actorId, type, gameId || null, reviewId || null, postId || null).run();
  } catch (e) {
    console.error('[Activity] Error adding activity:', e);
  }
}
