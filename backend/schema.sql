-- Схема D1 (SQLite) для SmolGame.
-- Применяется командой: npm run db:migrate:remote

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,           -- telegram id или guest_*
  username    TEXT,
  first_name  TEXT,
  last_name   TEXT,
  photo_url   TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS games (
  id           TEXT PRIMARY KEY,          -- nanoid / uuid
  title        TEXT NOT NULL,
  description  TEXT,
  genre        TEXT,
  genre_emoji  TEXT,
  url          TEXT NOT NULL,
  author_id    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',   -- pending | published | rejected
  likes        INTEGER NOT NULL DEFAULT 0,
  plays        INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_games_status_created  ON games(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_author          ON games(author_id);

CREATE TABLE IF NOT EXISTS likes (
  user_id    TEXT NOT NULL,
  game_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, game_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE TABLE IF NOT EXISTS follows (
  user_id    TEXT NOT NULL,               -- кто подписался
  author_id  TEXT NOT NULL,               -- на кого
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, author_id),
  CHECK (user_id <> author_id),
  FOREIGN KEY (user_id)   REFERENCES users(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);
