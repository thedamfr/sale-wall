#!/bin/bash

# Configuration CORS pour Cellar CleverCloud avec s3cmd
# Usage: ./scripts/setup-cellar-cors.sh

echo "🔧 Configuration CORS pour Cellar S3 avec s3cmd..."

# Variables Cellar
CELLAR_HOST="cellar-c2.services.clever-cloud.com"
CELLAR_ACCESS_KEY="AL5E4LISGQCYHU5G83BU"
CELLAR_SECRET_KEY="CKANsz4JnnpLmJbfD0MyhR0gOmIGkYZIbZ7hL8Zq"
BUCKET_NAME="salete-media"

# Configuration CORS XML pour s3cmd
cat > /tmp/cellar-cors.xml << 'EOF'
<CORSConfiguration>
    <CORSRule>
        <AllowedOrigin>https://saletesincere.fr</AllowedOrigin>
        <AllowedOrigin>https://www.saletesincere.fr</AllowedOrigin>
        <AllowedMethod>GET</AllowedMethod>
        <AllowedMethod>HEAD</AllowedMethod>
        <AllowedHeader>*</AllowedHeader>
        <MaxAgeSeconds>3600</MaxAgeSeconds>
    </CORSRule>
</CORSConfiguration>
EOF

echo "📋 Configuration CORS créée:"
cat /tmp/cellar-cors.xml

# Configurer s3cmd temporairement pour Cellar
cat > /tmp/s3cfg << EOF
[default]
access_key = $CELLAR_ACCESS_KEY
secret_key = $CELLAR_SECRET_KEY
host_base = $CELLAR_HOST
host_bucket = %(bucket)s.$CELLAR_HOST
use_https = True
signature_v2 = False
EOF

echo "🚀 Application de la configuration CORS..."

# Appliquer la configuration CORS avec s3cmd
s3cmd --config=/tmp/s3cfg setcors /tmp/cellar-cors.xml s3://$BUCKET_NAME

if [ $? -eq 0 ]; then
    echo "✅ Configuration CORS appliquée avec succès!"
    
    # Appliquer une politique de lecture publique SEULEMENT pour les fichiers audio
    echo "🔒 Configuration de la politique de lecture publique pour /audio/*..."
    
    cat > /tmp/bucket-policy.json << 'POLICY_EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadAudioFiles",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::salete-media/audio/*"
        }
    ]
}
POLICY_EOF
    
    s3cmd --config=/tmp/s3cfg setpolicy /tmp/bucket-policy.json s3://$BUCKET_NAME
    
    if [ $? -eq 0 ]; then
        echo "✅ Politique de bucket appliquée (lecture publique limitée à /audio/*)"
    else
        echo "⚠️  Erreur lors de l'application de la politique de bucket"
    fi
    
    # Vérifier la configuration
    echo "🔍 Vérification de la configuration:"
    s3cmd --config=/tmp/s3cfg info s3://$BUCKET_NAME
else
    echo "❌ Erreur lors de l'application de la configuration CORS"
    exit 1
fi

# Nettoyer
rm -f /tmp/cellar-cors.xml /tmp/s3cfg /tmp/bucket-policy.json

echo "🎉 Configuration CORS terminée!"
