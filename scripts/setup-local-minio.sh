#!/bin/bash

# Configuration MinIO local pour le développement
# Usage: ./scripts/setup-local-minio.sh

echo "🔧 Configuration MinIO local..."

# Variables MinIO local
MINIO_ENDPOINT="http://localhost:9000"
MINIO_ACCESS_KEY="salete"
MINIO_SECRET_KEY="salete123"
BUCKET_NAME="salete-media"

echo "📦 Installation du client MinIO..."
# Installer mc si nécessaire (MacOS)
if ! command -v mc &> /dev/null; then
    echo "Installation de minio/mc via Docker..."
    docker pull minio/mc:latest
fi

echo "🔑 Configuration de l'alias MinIO..."
docker run --rm -it --network host minio/mc:latest config host add local $MINIO_ENDPOINT $MINIO_ACCESS_KEY $MINIO_SECRET_KEY

echo "📂 Création du bucket $BUCKET_NAME..."
docker run --rm -it --network host minio/mc:latest mb local/$BUCKET_NAME --ignore-existing

echo "🌐 Configuration des permissions publiques pour le dossier /audio/..."
# Politique pour autoriser les lectures publiques sur /audio/*
cat > /tmp/minio-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": ["*"]
      },
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::$BUCKET_NAME/audio/*"]
    }
  ]
}
EOF

# Appliquer la politique
docker run --rm -it --network host -v /tmp/minio-policy.json:/tmp/policy.json minio/mc:latest policy set-json /tmp/policy.json local/$BUCKET_NAME

echo "✅ Configuration MinIO terminée !"
echo "🔗 URLs de test:"
echo "   Interface web: http://localhost:9001 (salete/salete123)"
echo "   API endpoint: $MINIO_ENDPOINT"
echo "   Bucket: $BUCKET_NAME"

echo "🧪 Test d'accès..."
docker run --rm -it --network host minio/mc:latest ls local/$BUCKET_NAME/