-- OAuth access token for GitHub API (publish game to user's repo). Encrypted in app layer.
-- Run: npm run db:migrate:remote:github-token

ALTER TABLE users ADD COLUMN github_access_token_enc TEXT;
