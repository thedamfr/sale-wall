-- Migration pour ajouter des index de performance
-- Test de la fonctionnalité de migration automatique

CREATE INDEX IF NOT EXISTS idx_posts_duration ON posts(duration_seconds);
CREATE INDEX IF NOT EXISTS idx_posts_audio_url ON posts(audio_url);

-- Ajouter un commentaire sur la table
COMMENT ON TABLE posts IS 'Table des posts audio avec support MinIO/S3';
