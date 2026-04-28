-- История «играл» по пользователю (для раздела Игры). Применить на D1:
-- npx wrangler d1 execute smolgame --remote --file=./migrations/0005_user_game_plays.sql

CREATE TABLE IF NOT EXISTS user_game_plays (
  user_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  last_played_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, game_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE INDEX IF NOT EXISTS idx_user_game_plays_user_time
  ON user_game_plays (user_id, last_played_at DESC);
