-- Регистрация /api/me/registered и register(): колонки возраста и согласий.
-- Ошибка на проде: no such column: date_of_birth
-- Один раз:
--   cd backend && npx wrangler d1 execute smolgame --remote --file=./migrations/0009_users_dob_consent.sql
-- Если строка упала с "duplicate column" — эта колонка уже есть, остальные выполни вручную при необходимости.

ALTER TABLE users ADD COLUMN date_of_birth TEXT;
ALTER TABLE users ADD COLUMN consented_at INTEGER;
ALTER TABLE users ADD COLUMN tos_accepted_at INTEGER;
ALTER TABLE users ADD COLUMN parent_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN registered_at INTEGER;
