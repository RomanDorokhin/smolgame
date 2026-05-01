-- Удаляем уникальный индекс, который мешал писать несколько отзывов одной игре
DROP INDEX IF EXISTS idx_game_reviews_user_game;

-- Создаем обычный индекс для ускорения поиска по пользователю (если нужно), но без UNIQUE
CREATE INDEX IF NOT EXISTS idx_game_reviews_user_game_non_unique ON game_reviews(user_id, game_id);
