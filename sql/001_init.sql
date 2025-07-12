CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Posts table for voice recordings
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  transcription text NOT NULL,
  badge varchar(16) CHECK (badge IN ('wafer','charbon')),
  audio_filename text NOT NULL,
  audio_path text, -- Local path (dev only, nullable)
  audio_url text, -- For S3 URL in production
  status varchar(16) DEFAULT 'published' CHECK (status IN ('pending','published','flagged')),
  votes integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Votes table
CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  voter_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (post_id, voter_hash)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_badge ON posts(badge);
CREATE INDEX IF NOT EXISTS idx_votes_post_id ON votes(post_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();