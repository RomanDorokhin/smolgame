-- Отзывы к играм (после прогона: npm run db:migrate:remote:reviews)
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
