-- Carltine chain schema for Cloudflare D1.
--
-- Apply with:
--   npx wrangler d1 execute carltine --file=db/schema.sql
--
-- The table is append-only by convention. The hash/prev_hash columns mirror the
-- JSON payload so chain walks and verification can order and check rows without
-- parsing every payload. SQLite has no column-level immutability guarantee, so
-- immutability is enforced by verification detecting edits, not by the schema.

CREATE TABLE IF NOT EXISTS records (
  seq         INTEGER PRIMARY KEY,
  id          TEXT    NOT NULL UNIQUE,
  prev_hash   TEXT    NOT NULL,
  hash        TEXT    NOT NULL,
  payload     TEXT    NOT NULL,
  recorded_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_records_recorded_at ON records (recorded_at);
