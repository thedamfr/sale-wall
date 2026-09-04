-- Migration 009: YouTube video deep links for podcast episodes (ADR-0011)
-- Date: 2026-09-04
-- Additive migration: all existing smartlinks and cached images are preserved.

ALTER TABLE episode_links
  ADD COLUMN IF NOT EXISTS youtube_url TEXT;

COMMENT ON COLUMN episode_links.youtube_url IS
  'Direct YouTube video URL resolved from the canonical episode URL in its description';

-- Planned rollback (not automatic):
--   ALTER TABLE episode_links DROP COLUMN IF EXISTS youtube_url;
-- Dropping the column loses only the cached YouTube video links.
