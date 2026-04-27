-- GitHub OAuth: store account id and login (required with github_access_token_enc).
-- Run once on production D1 if PRAGMA table_info(users) has no github_user_id / github_login:
--   wrangler d1 execute smolgame --remote --file=./migrations/0004_github_user_columns.sql
-- If a line errors with "duplicate column", skip that line — column already exists.

ALTER TABLE users ADD COLUMN github_user_id TEXT;
ALTER TABLE users ADD COLUMN github_login TEXT;
