import { json, error, newId } from './http.js';
import { authenticate, upsertUser } from './auth.js';
import { validateSubmission } from './validators.js';

// ──────────────────────────────────────────────────────────────
// PUBLIC
// ──────────────────────────────────────────────────────────────

export async function getFeed(req, env) {
  const user = await authenticate(req, env);
  const userId = user?.id ?? null;

  // Только опубликованные, новые первыми. limit=50 на первом заходе хватит.
  const { results } = await env.DB.prepare(
    `SELECT g.id, g.title, g.description, g.genre, g.genre_emoji AS genreEmoji,
            g.url, g.likes, g.plays, g.author_id AS authorId,
            u.username AS authorUsername, u.first_name AS authorFirst, u.last_name AS authorLast,
            u.photo_url AS authorPhoto
       FROM games g
       LEFT JOIN users u ON u.id = g.author_id
      WHERE g.status = 'published'
      ORDER BY g.created_at DESC
      LIMIT 50`
  ).all();

  let likedSet = new Set();
  let followedSet = new Set();
  if (userId) {
    const likes = await env.DB
      .prepare(`SELECT game_id FROM likes WHERE user_id = ?`)
      .bind(userId).all();
    likedSet = new Set(likes.results.map(r => r.game_id));

    const follows = await env.DB
      .prepare(`SELECT author_id FROM follows WHERE user_id = ?`)
      .bind(userId).all();
    followedSet = new Set(follows.results.map(r => r.author_id));
  }

  const games = results.map(g => ({
    id: g.id,
    title: g.title,
    description: g.description,
    genre: g.genre,
    genreEmoji: g.genreEmoji,
    url: g.url,
    likes: g.likes,
    plays: g.plays,
    authorId: g.authorId,
    authorName: [g.authorFirst, g.authorLast].filter(Boolean).join(' ') || g.authorUsername || 'Аноним',
    authorHandle: g.authorUsername || '',
    authorAvatar: g.authorPhoto || (g.authorFirst?.[0] || '?'),
    isLiked: likedSet.has(g.id),
    isFollowing: followedSet.has(g.authorId),
  }));

  return json({ games });
}

export async function getMe(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);
  await upsertUser(env.DB, user);

  // Статистика автора.
  const { results: stats } = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM games   WHERE author_id = ?1 AND status='published') AS gamesCount,
       (SELECT COALESCE(SUM(likes),0) FROM games WHERE author_id = ?1) AS likesTotal,
       (SELECT COUNT(*) FROM follows WHERE author_id = ?1) AS followersCount`
  ).bind(user.id).all();
  const s = stats[0] || {};

  return json({
    user: {
      id: user.id,
      username: user.username,
      name: [user.first_name, user.last_name].filter(Boolean).join(' '),
      avatar: user.photo_url || user.first_name?.[0] || '?',
      isAdmin: user.isAdmin === true,
    },
    stats: {
      games: s.gamesCount ?? 0,
      likes: s.likesTotal ?? 0,
      followers: s.followersCount ?? 0,
    },
  });
}

export async function submitGame(req, env) {
  const user = await authenticate(req, env);
  if (!user) return error('unauthorized', 401);
  await upsertUser(env.DB, user);

  let body;
  try { body = await req.json(); } catch (e) { return error('invalid json'); }

  const { ok, error: verr } = validateSubmission(body);
  if (verr) return error(verr);

  const id = newId();
  await env.DB.prepare(
    `INSERT INTO games (id, title, description, genre, genre_emoji, url, author_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
  ).bind(id, ok.title, ok.description, ok.genre, ok.genreEmoji, ok.url, user.id).run();

  return json({ ok: true, id, status: 'pending' });
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

  const { results } = await env.DB.prepare(
    `SELECT g.*, u.username AS authorUsername, u.first_name AS authorFirst
       FROM games g
       LEFT JOIN users u ON u.id = g.author_id
      WHERE g.status = 'pending'
      ORDER BY g.created_at ASC`
  ).all();

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
