import { json, error, newId } from './http.js';
import { isMissingColumnError } from './db-errors.js';
import { authenticate, upsertUser } from './auth.js';
import { safeHttpsUrl, validateSubmission, validateProfilePatch } from './validators.js';

// ──────────────────────────────────────────────────────────────
// PUBLIC
// ──────────────────────────────────────────────────────────────

const FEED_PAGE_DEFAULT = 15;
const FEED_PAGE_MAX = 40;

/** Старые D1 без части колонок в users/games — перебираем запросы, пока не сработает. */
const PUBLISHED_FEED_SQL_VARIANTS = [
  // Полная схема
  `SELECT g.id, g.title, g.description, g.genre, g.genre_emoji AS genreEmoji,
          g.url, g.image_url AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          u.site_handle AS authorHandle, u.first_name AS authorFirst, u.last_name AS authorLast,
          u.display_name AS authorDisplayName,
          COALESCE(NULLIF(TRIM(u.avatar_override_url), ''), u.photo_url) AS authorPhoto
     FROM games g
     LEFT JOIN users u ON u.id = g.author_id
    WHERE g.status = 'published'
    ORDER BY g.created_at DESC
    LIMIT ?1 OFFSET ?2`,
  // Старые games без genre_emoji / image_url; полные users
  `SELECT g.id, g.title, g.description, g.genre, CAST(NULL AS TEXT) AS genreEmoji,
          g.url, CAST(NULL AS TEXT) AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          u.site_handle AS authorHandle, u.first_name AS authorFirst, u.last_name AS authorLast,
          u.display_name AS authorDisplayName,
          COALESCE(NULLIF(TRIM(u.avatar_override_url), ''), u.photo_url) AS authorPhoto
     FROM games g
     LEFT JOIN users u ON u.id = g.author_id
    WHERE g.status = 'published'
    ORDER BY g.created_at DESC
    LIMIT ?1 OFFSET ?2`,
  // Полные games; users только «старые» поля (без site_handle / display_name / avatar_override)
  `SELECT g.id, g.title, g.description, g.genre, g.genre_emoji AS genreEmoji,
          g.url, g.image_url AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          COALESCE(NULLIF(TRIM(u.username), ''), u.id) AS authorHandle,
          u.first_name AS authorFirst, u.last_name AS authorLast,
          CAST(NULL AS TEXT) AS authorDisplayName,
          u.photo_url AS authorPhoto
     FROM games g
     LEFT JOIN users u ON u.id = g.author_id
    WHERE g.status = 'published'
    ORDER BY g.created_at DESC
    LIMIT ?1 OFFSET ?2`,
  // Минимум и games, и users
  `SELECT g.id, g.title, g.description, g.genre, CAST(NULL AS TEXT) AS genreEmoji,
          g.url, CAST(NULL AS TEXT) AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          COALESCE(NULLIF(TRIM(u.username), ''), u.id) AS authorHandle,
          u.first_name AS authorFirst, u.last_name AS authorLast,
          CAST(NULL AS TEXT) AS authorDisplayName,
          u.photo_url AS authorPhoto
     FROM games g
     LEFT JOIN users u ON u.id = g.author_id
    WHERE g.status = 'published'
    ORDER BY g.created_at DESC
    LIMIT ?1 OFFSET ?2`,
];

async function firstSuccessfulAll(db, sqlStrings, bindArgs = []) {
  let lastErr;
  for (const sql of sqlStrings) {
    try {
      const stmt = db.prepare(sql);
      return bindArgs.length ? await stmt.bind(...bindArgs).all() : await stmt.all();
    } catch (e) {
      lastErr = e;
      if (!isMissingColumnError(e)) throw e;
    }
  }
  throw lastErr;
}

async function firstSuccessfulFirst(db, sqlStrings, bindArgs = []) {
  let lastErr;
  for (const sql of sqlStrings) {
    try {
      const stmt = db.prepare(sql);
      return bindArgs.length ? await stmt.bind(...bindArgs).first() : await stmt.first();
    } catch (e) {
      lastErr = e;
      if (!isMissingColumnError(e)) throw e;
    }
  }
  throw lastErr;
}

async function publishedFeedGamesQuery(db, limit, offset) {
  return firstSuccessfulAll(db, PUBLISHED_FEED_SQL_VARIANTS, [limit, offset]);
}

/** Та же схема колонок, что и лента, но только pending — для админа в начале ленты. */
const PENDING_QUEUE_SQL_VARIANTS = PUBLISHED_FEED_SQL_VARIANTS.map(sql =>
  sql
    .replace("WHERE g.status = 'published'", "WHERE g.status = 'pending'")
    .replace('ORDER BY g.created_at DESC', 'ORDER BY g.created_at ASC')
);

async function pendingQueueGamesQuery(db, cap = 100) {
  return firstSuccessfulAll(db, PENDING_QUEUE_SQL_VARIANTS, [cap, 0]);
}

/** Очередь модерации без JOIN users — надёжно, если схема users отличается. */
const PENDING_QUEUE_GAMES_ONLY_VARIANTS = [
  `SELECT g.id, g.title, g.description, g.genre, g.genre_emoji AS genreEmoji,
          g.url, g.image_url AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          CAST(NULL AS TEXT) AS authorHandle,
          CAST(NULL AS TEXT) AS authorFirst,
          CAST(NULL AS TEXT) AS authorLast,
          CAST(NULL AS TEXT) AS authorDisplayName,
          CAST(NULL AS TEXT) AS authorPhoto
     FROM games g
    WHERE g.status = 'pending'
    ORDER BY g.created_at ASC
    LIMIT ?1 OFFSET ?2`,
  `SELECT g.id, g.title, g.description, g.genre, CAST(NULL AS TEXT) AS genreEmoji,
          g.url, CAST(NULL AS TEXT) AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          CAST(NULL AS TEXT) AS authorHandle,
          CAST(NULL AS TEXT) AS authorFirst,
          CAST(NULL AS TEXT) AS authorLast,
          CAST(NULL AS TEXT) AS authorDisplayName,
          CAST(NULL AS TEXT) AS authorPhoto
     FROM games g
    WHERE g.status = 'pending'
    ORDER BY g.created_at ASC
    LIMIT ?1 OFFSET ?2`,
];

async function pendingQueueGamesOnlyQuery(db, cap = 100) {
  return firstSuccessfulAll(db, PENDING_QUEUE_GAMES_ONLY_VARIANTS, [cap, 0]);
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
    authorId: g.authorId,
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

const GAME_BY_ID_SQL_VARIANTS = [
  `SELECT g.id, g.title, g.description, g.genre, g.genre_emoji AS genreEmoji,
          g.url, g.image_url AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          g.status,
          u.site_handle AS authorHandle, u.first_name AS authorFirst, u.last_name AS authorLast,
          u.display_name AS authorDisplayName,
          COALESCE(NULLIF(TRIM(u.avatar_override_url), ''), u.photo_url) AS authorPhoto
     FROM games g
     LEFT JOIN users u ON u.id = g.author_id
    WHERE g.id = ?`,
  `SELECT g.id, g.title, g.description, g.genre, CAST(NULL AS TEXT) AS genreEmoji,
          g.url, CAST(NULL AS TEXT) AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          g.status,
          u.site_handle AS authorHandle, u.first_name AS authorFirst, u.last_name AS authorLast,
          u.display_name AS authorDisplayName,
          COALESCE(NULLIF(TRIM(u.avatar_override_url), ''), u.photo_url) AS authorPhoto
     FROM games g
     LEFT JOIN users u ON u.id = g.author_id
    WHERE g.id = ?`,
  `SELECT g.id, g.title, g.description, g.genre, g.genre_emoji AS genreEmoji,
          g.url, g.image_url AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          g.status,
          COALESCE(NULLIF(TRIM(u.username), ''), u.id) AS authorHandle,
          u.first_name AS authorFirst, u.last_name AS authorLast,
          CAST(NULL AS TEXT) AS authorDisplayName,
          u.photo_url AS authorPhoto
     FROM games g
     LEFT JOIN users u ON u.id = g.author_id
    WHERE g.id = ?`,
  `SELECT g.id, g.title, g.description, g.genre, CAST(NULL AS TEXT) AS genreEmoji,
          g.url, CAST(NULL AS TEXT) AS imageUrl, g.likes, g.plays, g.author_id AS authorId,
          g.status,
          COALESCE(NULLIF(TRIM(u.username), ''), u.id) AS authorHandle,
          u.first_name AS authorFirst, u.last_name AS authorLast,
          CAST(NULL AS TEXT) AS authorDisplayName,
          u.photo_url AS authorPhoto
     FROM games g
     LEFT JOIN users u ON u.id = g.author_id
    WHERE g.id = ?`,
];

async function gameByIdRow(db, gameId) {
  return firstSuccessfulFirst(db, GAME_BY_ID_SQL_VARIANTS, [gameId]);
}

export async function getFeed(req, env) {
  const user = await authenticate(req, env);
  const userId = user?.id ?? null;

  const url = new URL(req.url);
  let offset = Number(url.searchParams.get('offset') || 0);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  let limit = Number(url.searchParams.get('limit') || FEED_PAGE_DEFAULT);
  if (!Number.isFinite(limit) || limit < 1) limit = FEED_PAGE_DEFAULT;
  limit = Math.min(FEED_PAGE_MAX, Math.max(1, Math.floor(limit)));

  // Только опубликованные, новые первыми. Пагинация: ?offset=&limit=
  const { results } = await publishedFeedGamesQuery(env.DB, limit, offset);

  let likedSet = new Set();
  let followedSet = new Set();
  let bookmarkedSet = new Set();
  if (userId) {
    const likes = await env.DB
      .prepare(`SELECT game_id FROM likes WHERE user_id = ?`)
      .bind(userId).all();
    likedSet = new Set(likes.results.map(r => r.game_id));

    const follows = await env.DB
      .prepare(`SELECT author_id FROM follows WHERE user_id = ?`)
      .bind(userId).all();
    followedSet = new Set(follows.results.map(r => r.author_id));

    const bookmarks = await env.DB
      .prepare(`SELECT game_id FROM bookmarks WHERE user_id = ?`)
      .bind(userId).all();
    bookmarkedSet = new Set(bookmarks.results.map(r => r.game_id));
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
  });
}

const GET_ME_SQL_VARIANTS = [
  `SELECT site_handle AS siteHandle,
          display_name AS displayName,
          bio AS bio,
          github_login AS githubLogin,
          github_user_id AS githubUserId,
          github_access_token_enc AS githubAccessTokenEnc,
          COALESCE(NULLIF(TRIM(avatar_override_url), ''), photo_url) AS avatarUrl
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
          COALESCE(NULLIF(TRIM(avatar_override_url), ''), photo_url) AS avatarUrl
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
          COALESCE(NULLIF(TRIM(avatar_override_url), ''), photo_url) AS avatarUrl
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

export async function getMe(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);
  await upsertUser(env.DB, user);
  let dbUser;
  try {
    dbUser = await firstSuccessfulFirst(env.DB, GET_ME_SQL_VARIANTS, [user.id]);
  } catch (e) {
    throw e;
  }
  if (dbUser && !('githubAccessTokenEnc' in dbUser)) dbUser.githubAccessTokenEnc = null;

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

  vals.push(user.id);
  await env.DB.prepare(
    `UPDATE users SET ${sets.join(', ')} WHERE id = ?`
  ).bind(...vals).run();

  return getMe(req, env);
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

  return json({ games: results });
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
    const initHeader = String(req.headers.get('x-telegram-init-data') || '').trim();
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

export async function deleteGame(req, env, gameId) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  const game = await env.DB.prepare(
    `SELECT author_id AS authorId FROM games WHERE id = ?`
  ).bind(gameId).first();
  if (!game) return error('not found', 404);
  if (game.authorId !== user.id && user.isAdmin !== true) return error('forbidden', 403);

  await env.DB.prepare(`DELETE FROM likes WHERE game_id = ?`).bind(gameId).run();
  await env.DB.prepare(`DELETE FROM bookmarks WHERE game_id = ?`).bind(gameId).run();
  await env.DB.prepare(`DELETE FROM games WHERE id = ?`).bind(gameId).run();
  return json({ ok: true });
}

export async function toggleLike(req, env, gameId, method) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);

  if (method === 'DELETE') {
    const res = await env.DB.prepare(
      `DELETE FROM likes WHERE user_id = ? AND game_id = ?`
    ).bind(user.id, gameId).run();
    if (res.meta.changes > 0) {
      await env.DB.prepare(`UPDATE games SET likes = likes - 1 WHERE id = ?`).bind(gameId).run();
    }
    return json({ ok: true, liked: false });
  }

  // POST — ставим лайк, если ещё нет.
  const res = await env.DB.prepare(
    `INSERT OR IGNORE INTO likes (user_id, game_id) VALUES (?, ?)`
  ).bind(user.id, gameId).run();
  if (res.meta.changes > 0) {
    await env.DB.prepare(`UPDATE games SET likes = likes + 1 WHERE id = ?`).bind(gameId).run();
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
  await env.DB.prepare(
    `INSERT OR IGNORE INTO follows (user_id, author_id) VALUES (?, ?)`
  ).bind(user.id, authorId).run();
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

export async function getUserProfile(req, env, userId) {
  const viewer = await authenticate(req, env);
  const user = await env.DB.prepare(
    `SELECT id, site_handle AS siteHandle, first_name AS firstName,
            last_name AS lastName, photo_url AS photoUrl,
            display_name AS displayName, bio AS bio,
            COALESCE(NULLIF(TRIM(avatar_override_url), ''), photo_url) AS avatarUrl
       FROM users WHERE id = ?`
  ).bind(userId).first();
  if (!user) return error('not found', 404);

  const stats = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM games   WHERE author_id = ?1 AND status='published') AS games,
       (SELECT COALESCE(SUM(likes),0) FROM games WHERE author_id = ?1) AS likes,
       (SELECT COUNT(*) FROM follows WHERE author_id = ?1) AS followers`
  ).bind(userId).first();

  let isFollowing = false;
  if (viewer) {
    const follow = await env.DB.prepare(
      `SELECT 1 FROM follows WHERE user_id = ? AND author_id = ?`
    ).bind(viewer.id, userId).first();
    isFollowing = Boolean(follow);
  }

  return json({
    user: publicUser(user),
    stats: stats || { games: 0, likes: 0, followers: 0 },
    isSelf: viewer?.id === userId,
    isFollowing,
  });
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
  // Не требуем auth для просмотров — это публичный счётчик.
  await env.DB.prepare(
    `UPDATE games SET plays = plays + 1 WHERE id = ? AND status = 'published'`
  ).bind(gameId).run();
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
