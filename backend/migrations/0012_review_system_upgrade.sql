-- Обновление системы отзывов: поддержка ответов (древовидность)
ALTER TABLE game_reviews ADD COLUMN parent_id TEXT;

-- Индекс для быстрого поиска ответов к конкретному комментарию
CREATE INDEX IF NOT EXISTS idx_game_reviews_parent ON game_reviews(parent_id);

-- Обновляем основную схему (для новых установок)
-- Примечание: в SQLite нельзя просто добавить FOREIGN KEY через ALTER TABLE, 
-- поэтому мы просто добавляем колонку и индекс.
