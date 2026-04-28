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
  display_name TEXT,                     -- публичное имя (иначе Telegram имя)
  bio         TEXT,                      -- короткое описание профиля
  avatar_override_url TEXT,              -- своё фото; иначе photo_url из Telegram
  github_user_id TEXT,                   -- id пользователя GitHub (не уникален: один GH может быть у нескольких TG после отдельного OAuth)
  github_login TEXT,                     -- логин @github
  github_access_token_enc TEXT,          -- OAuth token (AES-GCM), см. github-token-crypto.js
  date_of_birth TEXT,
  consented_at INTEGER,
  tos_accepted_at INTEGER,
  parent_consent INTEGER NOT NULL DEFAULT 0,
  registered_at INTEGER,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_site_handle ON users(site_handle);
CREATE TABLE IF NOT EXISTS oauth_states (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- D1/SQLite не умеет IF NOT EXISTS для ADD COLUMN во всех версиях Wrangler.
-- Для существующих БД эти ALTER нужно применить один раз вручную, если колонки ещё не добавлены.
-- ALTER TABLE users ADD COLUMN tg_username TEXT;
-- ALTER TABLE users ADD COLUMN site_handle TEXT;
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_users_site_handle ON users(site_handle);
-- Регистрация: см. migrations/0009_users_dob_consent.sql (прогон на прод D1).
-- ALTER TABLE users ADD COLUMN date_of_birth TEXT;
-- ALTER TABLE users ADD COLUMN consented_at INTEGER;
-- ALTER TABLE users ADD COLUMN tos_accepted_at INTEGER;
-- ALTER TABLE users ADD COLUMN parent_consent INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN registered_at INTEGER;
-- ALTER TABLE users ADD COLUMN display_name TEXT;
-- ALTER TABLE users ADD COLUMN bio TEXT;
-- ALTER TABLE users ADD COLUMN avatar_override_url TEXT;
-- ALTER TABLE users ADD COLUMN github_user_id TEXT;
-- ALTER TABLE users ADD COLUMN github_login TEXT;
-- Уникальный индекс по github_user_id убран: один GitHub может быть у нескольких Telegram после отдельного OAuth. См. migrations/0006_github_user_id_drop_unique_index.sql

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

-- Когда залогиненный пользователь открывает игру в ленте (POST /play), обновляется last_played_at.
CREATE TABLE IF NOT EXISTS user_game_plays (
  user_id         TEXT NOT NULL,
  game_id         TEXT NOT NULL,
  last_played_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, game_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (game_id) REFERENCES games(id)
);
CREATE INDEX IF NOT EXISTS idx_user_game_plays_user_time
  ON user_game_plays (user_id, last_played_at DESC);

CREATE TABLE IF NOT EXISTS game_reviews (
  id         TEXT PRIMARY KEY,
  game_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_reviews_user_game ON game_reviews(user_id, game_id);
CREATE INDEX IF NOT EXISTS idx_game_reviews_game_time ON game_reviews(game_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id    TEXT NOT NULL,
  game_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, game_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (game_id) REFERENCES games(id)
);
