-- Migration 008: rolling OP3 download windows (ADR-0015)
-- Date: 2026-08-20
-- Additive migration: existing OP3 rows and all-time values are preserved.

ALTER TABLE op3_stats
  ADD COLUMN IF NOT EXISTS downloads_7 INTEGER;

COMMENT ON COLUMN op3_stats.downloads_7 IS
  'Downloads in the rolling seven days preceding fetched_at, computed from OP3 download rows';

COMMENT ON COLUMN op3_stats.downloads_30 IS
  'Downloads in the rolling thirty days preceding fetched_at, computed from OP3 download rows';

COMMENT ON COLUMN op3_stats.downloads_all IS
  'All-time downloads reported by the OP3 episode download counts query';

-- Planned rollback (not automatic):
--   ALTER TABLE op3_stats DROP COLUMN IF EXISTS downloads_7;
-- Dropping the column loses only the derived rolling-seven-day value. The
-- existing item_guid, downloads_30, downloads_all and fetched_at data remain.
