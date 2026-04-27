-- Add columns if an older D1 database was created before they existed in schema.sql.
-- Apply with: wrangler d1 execute smolgame --remote --file=./migrations/0001_add_game_columns.sql
-- (Run once; if a column already exists, that statement will fail — skip that line and re-run.)

ALTER TABLE games ADD COLUMN genre_emoji TEXT;
ALTER TABLE games ADD COLUMN image_url TEXT;
