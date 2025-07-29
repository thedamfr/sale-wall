-- Add duration column to posts table
ALTER TABLE posts ADD COLUMN duration_seconds INTEGER;

-- Update existing posts with a default duration (45 seconds)
UPDATE posts SET duration_seconds = 45 WHERE duration_seconds IS NULL;
