#!/bin/bash

# Configuration bucket Cellar pour Castopod
# Usage: ./scripts/setup-cellar-castopod.sh

set -e

echo "🎙️ Configuration bucket Cellar pour Castopod..."

# Variables Cellar (à adapter avec vos credentials)
CELLAR_HOST="cellar-c2.services.clever-cloud.com"
CELLAR_ACCESS_KEY="${CELLAR_ADDON_KEY_ID:-AL5E4LISGQCYHU5G83BU}"
CELLAR_SECRET_KEY="${CELLAR_ADDON_KEY_SECRET:-CKANsz4JnnpLmJbfD0MyhR0gOmIGkYZIbZ7hL8Zq}"
BUCKET_NAME="salete-media-podcast"

echo "📦 Bucket: $BUCKET_NAME"
echo "🌐 Host: $CELLAR_HOST"

# Configuration s3cmd temporaire
cat > /tmp/s3cfg-castopod << EOF
[default]
access_key = $CELLAR_ACCESS_KEY
secret_key = $CELLAR_SECRET_KEY
host_base = $CELLAR_HOST
host_bucket = %(bucket)s.$CELLAR_HOST
use_https = True
signature_v2 = False
EOF

# Créer le bucket
echo "📦 Création du bucket $BUCKET_NAME..."
if s3cmd --config=/tmp/s3cfg-castopod mb s3://$BUCKET_NAME 2>/dev/null; then
    echo "✅ Bucket créé avec succès"
else
    echo "ℹ️  Bucket existe déjà ou erreur de création"
fi

# Configuration CORS pour Castopod
echo "🔧 Configuration CORS..."
cat > /tmp/castopod-cors.xml << 'EOF'
<CORSConfiguration>
    <CORSRule>
        <AllowedOrigin>https://saletesincere.fr</AllowedOrigin>
        <AllowedOrigin>https://www.saletesincere.fr</AllowedOrigin>
        <AllowedOrigin>http://localhost:8000</AllowedOrigin>
        <AllowedMethod>GET</AllowedMethod>
        <AllowedMethod>HEAD</AllowedMethod>
        <AllowedMethod>PUT</AllowedMethod>
        <AllowedMethod>POST</AllowedMethod>
        <AllowedMethod>DELETE</AllowedMethod>
        <AllowedHeader>*</AllowedHeader>
        <MaxAgeSeconds>3600</MaxAgeSeconds>
    </CORSRule>
</CORSConfiguration>
EOF

s3cmd --config=/tmp/s3cfg-castopod setcors /tmp/castopod-cors.xml s3://$BUCKET_NAME

if [ $? -eq 0 ]; then
    echo "✅ Configuration CORS appliquée"
else
    echo "❌ Erreur lors de l'application CORS"
fi

# Politique de lecture publique pour les médias podcast
echo "🔒 Configuration de la politique de lecture publique..."
cat > /tmp/castopod-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadPodcastFiles",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$BUCKET_NAME/podcast/*"
        }
    ]
}
EOF

s3cmd --config=/tmp/s3cfg-castopod setpolicy /tmp/castopod-policy.json s3://$BUCKET_NAME

if [ $? -eq 0 ]; then
    echo "✅ Politique de bucket appliquée (lecture publique pour /podcast/*)"
else
    echo "⚠️  Erreur lors de l'application de la politique"
fi

# Vérifier la configuration
echo ""
echo "🔍 Informations du bucket:"
s3cmd --config=/tmp/s3cfg-castopod info s3://$BUCKET_NAME

# Nettoyer
rm -f /tmp/s3cfg-castopod /tmp/castopod-cors.xml /tmp/castopod-policy.json

echo ""
echo "🎉 Configuration terminée!"
echo ""
echo "📋 Prochaines étapes:"
echo "1. Créer un addon MariaDB sur CleverCloud (plan DEV minimum)"
echo "2. Créer un addon Redis (optionnel mais recommandé)"
echo "3. Créer une application Docker pour Castopod"
echo "4. Configurer les variables d'environnement (voir castopod/.env.castopod.example)"
