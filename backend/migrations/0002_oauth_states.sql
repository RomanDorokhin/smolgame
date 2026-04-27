-- GitHub OAuth: temporary state between /api/auth/github/start and callback.
-- Apply once on production D1:
--   npm run db:migrate:remote:oauth
-- Safe to re-run: IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS oauth_states (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);
