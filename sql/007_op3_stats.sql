-- Migration 007: OP3 Stats Cache (ADR-0015)
-- Objectif: Stocker stats OP3 par épisode avec cache 24h
-- Date: 2025-11-18

CREATE TABLE IF NOT EXISTS op3_stats (
  item_guid TEXT PRIMARY KEY,        -- itemGuid from RSS (unique per episode)
  downloads_all INTEGER NOT NULL,    -- All-time downloads (displayed in UI)
  downloads_30 INTEGER,              -- 30-day downloads (future trending feature)
  fetched_at TIMESTAMP DEFAULT NOW() -- Last fetch timestamp
);

-- Index pour cleanup des données stale (> 7 jours)
CREATE INDEX IF NOT EXISTS idx_op3_stats_fetched ON op3_stats(fetched_at);

-- Commentaires
COMMENT ON TABLE op3_stats IS 'OP3 episode download statistics with 24h cache (ADR-0015)';
COMMENT ON COLUMN op3_stats.item_guid IS 'RSS item <guid> tag value (episode identifier)';
COMMENT ON COLUMN op3_stats.downloads_all IS 'All-time downloads from OP3 API (displayed as badge if >= 10)';
COMMENT ON COLUMN op3_stats.downloads_30 IS 'Last 30 days downloads (reserved for future trending feature)';
COMMENT ON COLUMN op3_stats.fetched_at IS 'Timestamp of last OP3 API fetch (cache invalidation after 24h)';
