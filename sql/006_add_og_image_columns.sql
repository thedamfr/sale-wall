-- Migration 006: Add OG Image columns (ADR-0012 Phase 4)
-- Ajoute colonnes pour cache OG Images générées

ALTER TABLE episode_links 
  ADD COLUMN IF NOT EXISTS og_image_url TEXT,
  ADD COLUMN IF NOT EXISTS og_image_s3_key TEXT,
  ADD COLUMN IF NOT EXISTS feed_last_build TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;

-- Index pour check de cache invalidation (Phase 2.2)
CREATE INDEX IF NOT EXISTS idx_episode_links_feed_last_build 
  ON episode_links(feed_last_build);

-- Index pour cleanup des OG Images anciennes (> 7 jours)
CREATE INDEX IF NOT EXISTS idx_episode_links_generated_at 
  ON episode_links(generated_at);

-- Commentaires documentation
COMMENT ON COLUMN episode_links.og_image_url IS 'URL publique OG Image générée (1200x630 PNG blur)';
COMMENT ON COLUMN episode_links.og_image_s3_key IS 'Clé S3 pour cleanup (ex: og-images/s2e1.png)';
COMMENT ON COLUMN episode_links.feed_last_build IS 'RSS channel lastBuildDate pour cache invalidation';
COMMENT ON COLUMN episode_links.generated_at IS 'Timestamp génération OG Image (fallback 7 jours)';
