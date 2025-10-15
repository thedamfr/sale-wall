# Déploiement Castopod sur CleverCloud

Guide complet pour déployer Castopod sur CleverCloud avec intégration au projet Saleté Sincère.

## ⚠️ Configuration DNS Requise

**Castopod doit être déployé sur un sous-domaine, pas un sous-chemin.**

- ✅ **Bon** : `podcast.saletesincere.fr`
- ❌ **Mauvais** : `saletesincere.fr/podcast` (génère des 404, Castopod ne supporte pas les sous-chemins)

**Action requise avant finalisation** :
1. Configurer DNS Cloudflare : CNAME `podcast` → `app_eaed31f5-389b-4324-9136-dd3392ba6224.cleverapps.io`
2. Mettre à jour `CP_BASEURL` avec le sous-domaine final
3. Redéployer l'application

## 📋 Prérequis

- Compte CleverCloud actif
- CLI CleverCloud installée : `brew install clever-tools`
- Credentials Cellar S3 (disponibles dans les variables d'environnement de l'app principale)
- `s3cmd` installé : `brew install s3cmd`
- Accès DNS Cloudflare pour configurer le sous-domaine

## 🗂️ Étape 1 : Créer le bucket Cellar pour Castopod

```bash
# Créer le bucket et configurer les permissions
./scripts/setup-cellar-castopod.sh
```

Ce script va :
- ✅ Créer le bucket `salete-media-podcast`
- ✅ Configurer CORS pour autoriser les origines du site
- ✅ Définir la politique de lecture publique pour `/podcast/*`

### Vérification

```bash
# Lister les buckets
s3cmd ls

# Vérifier le contenu (vide pour l'instant)
s3cmd ls s3://salete-media-podcast/
```

## 💾 Étape 2 : Créer l'addon MySQL

### Via l'interface web CleverCloud

1. Aller sur https://console.clever-cloud.com
2. Sélectionner votre organisation
3. Cliquer sur "Create" → "Add-on"
4. Sélectionner **MySQL**
5. Choisir le plan **DEV** (le moins cher, gratuit)
   - **DEV** : 10 MB stockage, 5 connexions max (gratuit)
   - Suffisant pour démarrer Castopod
6. Nommer l'addon : `castopod-mysql`
7. Région : **par** (Paris) pour la proximité
8. Créer l'addon

> **Note** : Castopod fonctionne avec MySQL 8.0+ (compatible avec les fonctionnalités MariaDB nécessaires)

### Via la CLI

```bash
# Lister les plans disponibles
clever addon providers show mysql-addon

# Créer l'addon MySQL (plan DEV gratuit)
clever addon create mysql-addon castopod-mysql \
  --plan dev \
  --region par \
  --yes
```

### Récupérer les credentials

```bash
# Afficher les informations de connexion
clever addon env castopod-mysql

# Ou par ID si besoin
clever addon env addon_<votre-id>

# Variables disponibles :
# - MYSQL_ADDON_HOST
# - MYSQL_ADDON_PORT
# - MYSQL_ADDON_DB
# - MYSQL_ADDON_USER
# - MYSQL_ADDON_PASSWORD
# - MYSQL_ADDON_URI
# - MYSQL_ADDON_VERSION
```

**Note** : Gardez ces informations, elles seront nécessaires pour configurer l'application Castopod.

## 🔴 Étape 3 : Créer l'addon Redis (optionnel mais recommandé)

Redis améliore considérablement les performances de Castopod pour le cache.

### Via l'interface web

1. "Create" → "Add-on"
2. Sélectionner **Redis**
3. Choisir le plan **XXS Redis** (le moins cher)
   - **XXS** : ~5€/mois, 25 MB RAM
4. Nommer l'addon : `castopod-redis`
5. Région : **EU-FR-1** (Paris)
6. Créer l'addon

### Via la CLI

```bash
# Créer l'addon Redis (plan XXS)
clever addon create redis castopod-redis \
  --org <votre-org> \
  --region eu-par-1 \
  --plan redis_xxs
```

### Récupérer les credentials

```bash
clever addon env castopod-redis

# Variables disponibles :
# - REDIS_HOST
# - REDIS_PORT
# - REDIS_PASSWORD (si configuré)
```

## 📦 Étape 4 : Créer l'application Docker Castopod

### Via l'interface web

1. "Create" → "Application"
2. Sélectionner **Docker**
3. Choisir votre dépôt Git ou utiliser le déploiement manuel
4. Configuration :
   - **Nom** : `salete-castopod`
   - **Région** : EU-FR-1 (Paris)
   - **Taille** : Nano (gratuit) ou XS (~4€/mois) pour commencer
5. **Important** : Désactiver l'auto-deploy si vous voulez contrôler les déploiements

### Via la CLI

```bash
# Créer l'application Docker
clever create --type docker salete-castopod \
  --org <votre-org> \
  --region eu-par-1 \
  --alias castopod
```

## 🔗 Étape 5 : Lier les addons à l'application

```bash
# Lier MySQL
clever service link-addon castopod-mysql

# Lier Redis
clever service link-addon castopod-redis
```

Ou via l'interface web :
1. Aller dans l'application `salete-castopod`
2. Section "Service dependencies"
3. "Link an add-on" → Sélectionner `castopod-mysql` et `castopod-redis`

## ⚙️ Étape 6 : Configurer les variables d'environnement

### Variables obligatoires

Dans la console CleverCloud, section "Environment variables" de l'application `salete-castopod` :

```bash
# Base de données (récupérées automatiquement via l'addon)
CP_DATABASE_HOSTNAME=${MYSQL_ADDON_HOST}
CP_DATABASE_NAME=${MYSQL_ADDON_DB}
CP_DATABASE_USERNAME=${MYSQL_ADDON_USER}
CP_DATABASE_PASSWORD=${MYSQL_ADDON_PASSWORD}

# Redis (si addon lié)
CP_CACHE_HANDLER=redis
CP_REDIS_HOST=${REDIS_HOST}
CP_REDIS_PORT=${REDIS_PORT}
CP_REDIS_PASSWORD=${REDIS_PASSWORD}
CP_REDIS_DATABASE=0

# Stockage S3/Cellar
CP_MEDIA_S3_ENDPOINT=https://cellar-c2.services.clever-cloud.com
CP_MEDIA_S3_REGION=us-east-1
CP_MEDIA_S3_BUCKET=salete-media-podcast
CP_MEDIA_S3_KEY=<VOTRE_CELLAR_ACCESS_KEY>
CP_MEDIA_S3_SECRET=<VOTRE_CELLAR_SECRET_KEY>
CP_MEDIA_S3_KEY_PREFIX=podcast/
CP_MEDIA_S3_PATH_STYLE_ENDPOINT=false
CP_MEDIA_S3_PROTOCOL=https

# Configuration Castopod
# ⚠️ À MODIFIER après configuration DNS Cloudflare
CP_BASEURL=https://app_eaed31f5-389b-4324-9136-dd3392ba6224.cleverapps.io
# Une fois le DNS configuré, changer pour :
# CP_BASEURL=https://podcast.saletesincere.fr

CP_MEDIA_BASEURL=https://cellar-c2.services.clever-cloud.com/salete-media-podcast
CP_DISABLE_HTTPS=0
CP_ANALYTICS_SALT=<GÉNÉRER_UN_SALT_ALÉATOIRE>

# Port (pour CleverCloud)
PORT=8080
```

### Générer un salt analytics

```bash
# Générer un salt aléatoire sécurisé
openssl rand -hex 32
# Exemple : 916d8ab2d640d405dd5ffc6bdb447e2897bf307f5802dbf9226c05e33584955a
```

### Via la CLI

```bash
# Définir les variables d'environnement
clever env set CP_DATABASE_HOSTNAME '${MYSQL_ADDON_HOST}'
clever env set CP_DATABASE_NAME '${MYSQL_ADDON_DB}'
clever env set CP_DATABASE_USERNAME '${MYSQL_ADDON_USER}'
clever env set CP_DATABASE_PASSWORD '${MYSQL_ADDON_PASSWORD}'

# S3/Cellar
clever env set CP_MEDIA_S3_ENDPOINT "https://cellar-c2.services.clever-cloud.com"
clever env set CP_MEDIA_S3_BUCKET "salete-media-podcast"
# ... etc
```

## 🐳 Étape 7 : Préparer le Dockerfile pour CleverCloud

Le Dockerfile est dans `castopod/Dockerfile` :

```dockerfile
FROM castopod/castopod:latest

# Configuration pour CleverCloud
# CleverCloud attend que l'application écoute sur le port défini par la variable PORT
# Castopod utilise Apache qui écoute sur le port 8000 par défaut

# Exposer le port 8080 pour CleverCloud
EXPOSE 8080

# Modifier la configuration Apache pour écouter sur $PORT au lieu de 8000
RUN sed -i 's/Listen 8000/Listen ${PORT}/' /etc/apache2/ports.conf && \
    sed -i 's/:8000/:${PORT}/' /etc/apache2/sites-available/000-default.conf

# Démarrer Apache en avant-plan
CMD ["apache2-foreground"]
```

**Note** : La variable `CC_DOCKERFILE=castopod/Dockerfile` est configurée pour indiquer à CleverCloud d'utiliser ce Dockerfile.

## 🚀 Étape 8 : Déployer

### Option A : Via Git

```bash
# Ajouter le remote CleverCloud (si pas déjà fait)
clever link <app-id>

# Créer une branche pour Castopod
git checkout -b deploy/castopod

# Déployer
git push clever deploy/castopod:master
```

### Option B : Déploiement manuel

```bash
# Build et push de l'image Docker
docker build -f Dockerfile.castopod -t castopod-salete .
docker tag castopod-salete registry.clever-cloud.com/<app-id>/castopod:latest
docker push registry.clever-cloud.com/<app-id>/castopod:latest
```

## 🔧 Étape 9 : Configuration post-déploiement

### Accéder à l'installation

1. Visiter `https://<app-id>.cleverapps.io/cp-install`
2. Suivre l'assistant d'installation Castopod
3. Créer le compte super-admin
4. Configurer votre premier podcast

### Activer le 2FA (IMPORTANT pour la sécurité)

1. Se connecter à l'admin : `https://<app-id>.cleverapps.io/cp-admin`
2. Aller dans votre profil utilisateur
3. Activer l'authentification à deux facteurs

## 🌐 Configuration DNS et accès final

### ⚠️ Important : Castopod nécessite un sous-domaine

Castopod **ne fonctionne pas** sur un sous-chemin (`/podcast`). Il doit être configuré sur un sous-domaine dédié.

### Configuration Cloudflare requise

1. **Ajouter un enregistrement CNAME dans Cloudflare** :
   - Type : `CNAME`
   - Name : `podcast`
   - Target : `app_eaed31f5-389b-4324-9136-dd3392ba6224.cleverapps.io`
   - TTL : Auto
   - Proxy : ✅ Activé (orange cloud)

2. **Mettre à jour les variables d'environnement** :
   ```bash
   clever env set CP_BASEURL 'https://podcast.saletesincere.fr' --alias castopod
   clever env set CP_MEDIA_BASEURL 'https://cellar-c2.services.clever-cloud.com/salete-media-podcast' --alias castopod
   clever restart --alias castopod --without-cache
   ```

3. **Accéder au wizard d'installation** :
   - URL : https://podcast.saletesincere.fr/cp-install
   - Créer le compte super-admin
   - ✅ **Activer 2FA obligatoirement**

### Pourquoi pas `/podcast` ?

Tentative effectuée avec `CP_BASEURL='https://saletesincere.fr/podcast'` → **404 systématiques**.

Castopod génère des URLs absolues et ne gère pas la réécriture de chemin. Solution alternative (reverse proxy avec réécriture) trop complexe et fragile.

## 💰 Estimation des coûts

| Service | Plan | Coût mensuel |
|---------|------|--------------|
| Application Docker | Nano | Gratuit |
| MySQL | DEV | Gratuit |
| Redis | XXS | ~5€ |
| Cellar S3 | Usage | ~0-2€ (selon stockage) |
| **Total** | | **~5-7€/mois** |

### Upgrade recommandés pour la production

- **Application** : XS (4€) ou S (8€) pour plus de performance
- **MySQL** : xxs_sml (7€) pour plus de stockage (512 MB) et connexions (15)
- **Redis** : XS (10€) pour plus de cache

## 🔍 Vérification et tests

```bash
# Vérifier que l'application est déployée
clever status

# Voir les logs en temps réel
clever logs

# Vérifier les variables d'environnement
clever env

# Tester l'accès
curl -I https://<app-id>.cleverapps.io
```

## 🐛 Troubleshooting

### L'application ne démarre pas

```bash
# Vérifier les logs
clever logs --follow

# Problèmes courants :
# - Port incorrect (doit être 8080)
# - Variables d'environnement manquantes
# - Credentials S3 incorrects
```

### Erreur de connexion base de données

```bash
# Vérifier que l'addon est bien lié
clever services

# Vérifier les variables MariaDB
clever env | grep MYSQL
```

### Problèmes S3/Cellar

```bash
# Tester l'accès au bucket
s3cmd ls s3://salete-media-podcast/

# Vérifier les permissions CORS
s3cmd info s3://salete-media-podcast/
```

## 📚 Ressources

- [Documentation Castopod](https://docs.castopod.org/)
- [CleverCloud Documentation](https://www.clever-cloud.com/doc/)
- [ADR 0006 - Intégration Castopod](../documentation/adr/adr_0006_castopod_integration.md)
- [Security Audit Guide](../security/audit_guide.md)

## 🔐 Sécurité

- ✅ Activer le 2FA pour tous les comptes admin
- ✅ Utiliser HTTPS uniquement (`CP_DISABLE_HTTPS=0`)
- ✅ Restreindre l'accès admin par IP si possible
- ✅ Effectuer des audits réguliers (voir `security/audit_guide.md`)
- ✅ Monitorer les logs pour détecter les tentatives d'intrusion

## 📝 Checklist de déploiement

- [x] Bucket Cellar `salete-media-podcast` créé
- [x] Addon MySQL créé (castopod-mysql)
- [x] Addon Redis créé (castopod-redis)
- [x] Application Docker créée (castopod-server)
- [x] Addons liés à l'application (MySQL, Redis, S3)
- [x] Variables d'environnement configurées
- [x] Salt analytics généré (916d8ab2d640d405dd5ffc6bdb447e2897bf307f5802dbf9226c05e33584955a)
- [x] Dockerfile préparé (castopod/Dockerfile)
- [x] Application déployée ✅
- [ ] Installation Castopod complétée (accéder à /cp-install)
- [ ] Compte super-admin créé
- [ ] 2FA activé
- [ ] Test d'upload d'épisode réussi
- [ ] Routing `/podcast` configuré (à venir)

## 🎉 Application déployée

**URL** : https://app-eaed31f5-389b-4324-9136-dd3392ba6224.cleverapps.io/

**Installation** : https://app-eaed31f5-389b-4324-9136-dd3392ba6224.cleverapps.io/cp-install
