-- Таблица постов на стене профиля
CREATE TABLE IF NOT EXISTS user_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Индекс для быстрого получения постов пользователя (сначала новые)
CREATE INDEX IF NOT EXISTS idx_user_posts_user_id ON user_posts(user_id, created_at DESC);
