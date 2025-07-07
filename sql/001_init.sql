CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wav_url text NOT NULL,
  type varchar(16) CHECK (type IN ('wafer','charbon')),
  status varchar(16) DEFAULT 'pending' CHECK (status IN ('pending','published','flagged')),
  votes integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS votes (
  recording_id uuid REFERENCES recordings(id) ON DELETE CASCADE,
  voter_hash text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (recording_id, voter_hash)
);