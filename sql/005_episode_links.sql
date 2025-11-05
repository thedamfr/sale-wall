-- Migration 005: Table episode_links pour cache smartlinks
-- ADR-0011 Phase 5: Stockage liens plateformes résolus par worker

CREATE TABLE IF NOT EXISTS episode_links (
  id SERIAL PRIMARY KEY,
  season INTEGER NOT NULL,
  episode INTEGER NOT NULL,
  spotify_url TEXT,
  apple_url TEXT,
  deezer_url TEXT,
  podcast_addict_url TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Contrainte unique : 1 seule entrée par épisode
  CONSTRAINT unique_episode UNIQUE (season, episode)
);

-- Index pour recherche rapide par season/episode
CREATE INDEX IF NOT EXISTS idx_episode_links_season_episode ON episode_links(season, episode);

-- Commentaires
COMMENT ON TABLE episode_links IS 'Cache des liens plateformes résolus par worker pg-boss (ADR-0011)';
COMMENT ON COLUMN episode_links.spotify_url IS 'Lien direct Spotify episode (priorité desktop/Android)';
COMMENT ON COLUMN episode_links.apple_url IS 'Lien direct Apple Podcasts (priorité iOS)';
COMMENT ON COLUMN episode_links.deezer_url IS 'Lien direct Deezer episode';
COMMENT ON COLUMN episode_links.podcast_addict_url IS 'Lien deeplink Podcast Addict (priorité Android)';
COMMENT ON COLUMN episode_links.resolved_at IS 'Timestamp résolution complète (toutes plateformes)';
