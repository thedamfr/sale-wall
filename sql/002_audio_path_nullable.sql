-- Migration pour permettre audio_path NULL en production
-- Quand on utilise S3/Cellar, on n'a pas besoin de audio_path local

ALTER TABLE posts ALTER COLUMN audio_path DROP NOT NULL;
