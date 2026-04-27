-- OAuth access token for GitHub API (publish game to user's repo). Encrypted on Worker.
-- Применить удалённо без Мака: GitHub → Actions → "D1 migrate (remote)" → файл 0003_github_access_token.sql

ALTER TABLE users ADD COLUMN github_access_token_enc TEXT;
