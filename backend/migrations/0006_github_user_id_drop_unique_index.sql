-- Разрешить один GitHub на несколько Telegram (отдельный OAuth на каждый TG).
-- Выполни на D1 один раз, если раньше создавали UNIQUE по github_user_id:
--   npx wrangler d1 execute smolgame --remote --file=./migrations/0006_github_user_id_drop_unique_index.sql
DROP INDEX IF EXISTS idx_users_github_user_id;
