-- Схема D1 (SQLite) для SmolGame.
-- Применяется командой: npm run db:migrate:remote

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,           -- telegram id или guest_*
  username    TEXT,                       -- legacy alias для старых данных
  tg_username TEXT,                       -- внутреннее поле, не отдаём публично
  site_handle TEXT UNIQUE,                -- публичный ID внутри SmolGame
  first_name  TEXT,
  last_name   TEXT,
  photo_url   TEXT,
  date_of_birth TEXT,
  consented_at INTEGER,
  tos_accepted_at INTEGER,
  parent_consent INTEGER NOT NULL DEFAULT 0,
  registered_at INTEGER,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_site_handle ON users(site_handle);

-- D1/SQLite не умеет IF NOT EXISTS для ADD COLUMN во всех версиях Wrangler.
-- Для существующих БД эти ALTER нужно применить один раз вручную, если колонки ещё не добавлены.
-- ALTER TABLE users ADD COLUMN tg_username TEXT;
-- ALTER TABLE users ADD COLUMN site_handle TEXT;
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_users_site_handle ON users(site_handle);
-- ALTER TABLE users ADD COLUMN date_of_birth TEXT;
-- ALTER TABLE users ADD COLUMN consented_at INTEGER;
-- ALTER TABLE users ADD COLUMN tos_accepted_at INTEGER;
-- ALTER TABLE users ADD COLUMN parent_consent INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN registered_at INTEGER;

CREATE TABLE IF NOT EXISTS games (
  id           TEXT PRIMARY KEY,          -- nanoid / uuid
  title        TEXT NOT NULL,
  description  TEXT,
  genre        TEXT,
  genre_emoji  TEXT,
  image_url    TEXT,
  url          TEXT NOT NULL,
  author_id    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',   -- pending | published | rejected
  likes        INTEGER NOT NULL DEFAULT 0,
  plays        INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- ALTER TABLE games ADD COLUMN image_url TEXT;

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

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id    TEXT NOT NULL,
  game_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, game_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (game_id) REFERENCES games(id)
);
