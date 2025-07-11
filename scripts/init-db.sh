#!/bin/bash

# Database initialization script for Saleté Sincère

# Configuration
DB_NAME="salewall_dev"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

echo "🔧 Initializing database $DB_NAME..."

# Create database if it doesn't exist
echo "Creating database if it doesn't exist..."
createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME 2>/dev/null || echo "Database $DB_NAME already exists"

# Run SQL migrations
echo "Running SQL migrations..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f sql/001_init.sql

if [ $? -eq 0 ]; then
    echo "✅ Database initialized successfully"
else
    echo "❌ Error initializing database"
    exit 1
fi

# Insert some test data
echo "Inserting test data..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << EOF
-- Test posts
INSERT INTO posts (title, transcription, badge, audio_filename, audio_path, status, votes, created_at)
VALUES 
  ('Un jour de boîte à jouet', 'J''ai trouvé cette vieille boîte à jouets dans le grenier de ma grand-mère. Elle contenait tous mes souvenirs d''enfance, mes petites voitures, mes poupées cassées. En les touchant, j''ai ressenti cette nostalgie douce-amère qui me rappelle que le temps passe mais que les souvenirs restent.', 'wafer', 'test_wafer.webm', '/uploads/test_wafer.webm', 'published', 23, NOW() - INTERVAL '2 days'),
  ('Quand j''ai croisé un chaton', 'Il pleuvait ce jour-là et je rentrais du boulot, trempé et de mauvaise humeur. C''est alors que j''ai vu ce petit chaton abandonné sous un porche. Il m''a regardé avec ses grands yeux et j''ai pas pu résister. Maintenant il vit avec moi et c''est lui qui me réveille chaque matin.', 'charbon', 'test_charbon.webm', '/uploads/test_charbon.webm', 'published', 45, NOW() - INTERVAL '1 day'),
  ('Le premier café du matin', 'Il y a quelque chose de magique dans ce premier café du matin. L''odeur qui se répand dans la cuisine, la chaleur de la tasse entre les mains, ce moment de silence avant que la journée ne commence vraiment. C''est mon rituel, ma petite bulle de bonheur quotidien.', 'wafer', 'test_wafer2.webm', '/uploads/test_wafer2.webm', 'published', 12, NOW() - INTERVAL '6 hours');

-- Test votes
INSERT INTO votes (post_id, voter_hash, created_at)
SELECT 
  p.id,
  md5(random()::text || p.id::text),
  NOW() - INTERVAL '1 hour'
FROM posts p
WHERE p.votes > 0;

EOF

if [ $? -eq 0 ]; then
    echo "✅ Test data inserted successfully"
    echo "🎉 Database setup complete!"
else
    echo "❌ Error inserting test data"
    exit 1
fi
