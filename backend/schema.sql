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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS games (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  genre        TEXT,
  genre_emoji  TEXT,
  image_url    TEXT,
  url          TEXT NOT NULL,
  author_id    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  likes        INTEGER NOT NULL DEFAULT 0,
  plays        INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_games_status_created  ON games(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_author          ON games(author_id);
-- Индекс для оптимизации publishedFeedGamesQuery (лента)
CREATE INDEX IF NOT EXISTS idx_games_status_id_created ON games(status, id, created_at DESC);

CREATE TABLE IF NOT EXISTS likes (
  user_id    TEXT NOT NULL,
  game_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, game_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS follows (
  user_id    TEXT NOT NULL,
  author_id  TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, author_id),
  CHECK (user_id <> author_id),
  FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_game_plays (
  user_id         TEXT NOT NULL,
  game_id         TEXT NOT NULL,
  last_played_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, game_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_game_plays_user_time
  ON user_game_plays (user_id, last_played_at DESC);

CREATE TABLE IF NOT EXISTS game_reviews (
  id         TEXT PRIMARY KEY,
  game_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  parent_id  TEXT,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES game_reviews(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_game_reviews_parent ON game_reviews(parent_id);
CREATE INDEX IF NOT EXISTS idx_game_reviews_game_time ON game_reviews(game_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id    TEXT NOT NULL,
  game_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, game_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
