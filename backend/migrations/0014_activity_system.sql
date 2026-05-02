-- 0014_activity_system.sql
CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL, -- Кому уведомление (владелец игры или тот, на кого подписались)
    type TEXT NOT NULL,    -- 'like', 'review', 'follow', 'repost', 'reply'
    actor_id TEXT NOT NULL, -- Кто совершил действие
    game_id TEXT,          -- С какой игрой связано
    review_id TEXT,        -- С каким отзывом связано (для ответов)
    post_id TEXT,          -- С каким постом связано
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_is_read ON activity(user_id, is_read);
