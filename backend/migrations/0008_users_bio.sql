-- Профиль / PATCH /api/me. Если в D1 нет колонки bio:
--   cd backend && npx wrangler d1 execute smolgame --remote --file=./migrations/0008_users_bio.sql
ALTER TABLE users ADD COLUMN bio TEXT;
