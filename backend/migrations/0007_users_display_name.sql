-- Публичное имя в профиле (PATCH /api/me). Если колонки нет — выполни на D1 один раз:
--   cd backend && npx wrangler d1 execute smolgame --remote --file=./migrations/0007_users_display_name.sql
ALTER TABLE users ADD COLUMN display_name TEXT;
