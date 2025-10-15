# Castopod — Configuration locale & CleverCloud

Cette arborescence regroupe tout ce qu'il faut pour piloter Castopod à côté de l'application Fastify « Saleté Sincère », en suivant l'ADR 0006.

## 🎯 Objectif
- Lancer Castopod en local via l'image officielle `castopod/castopod`.
- Partager le réseau Docker avec PostgreSQL/MinIO tout en gardant MariaDB/Redis isolés.
- Préparer la configuration pour un déploiement sur CleverCloud (MariaDB + Cellar bucket dédié).

## ✅ Pré-requis
- Docker + Docker Compose v2 (Colima sur macOS)
- `s3cmd` (ou `mc`) pour gérer MinIO/Cellar
- Bucket `salete-media-podcast` (voir README racine pour la procédure) et des credentials S3 dédiés à Castopod
- Variables d'environnement dans `.env.castopod` (à la racine du projet)

> ⚠️ **Note pour Apple Silicon (M1/M2/M3)** : Les images MariaDB et Castopod sont configurées pour `linux/amd64` (émulation Rosetta). C'est nécessaire car Castopod n'est pas encore disponible en version ARM64 native.

## 🔧 Mise en place locale
1. Copier l'exemple d'environnement **à la racine du projet** :
   ```bash
   cp castopod/.env.castopod.example .env.castopod
   ```
2. Éditer `.env.castopod` avec :
   - Les secrets MariaDB (mot de passe root + user Castopod)
   - Un salt analytics (`CP_ANALYTICS_SALT`)
   - Les credentials S3 dédiés Castopod (`CASTOPOD_S3_KEY`, `CASTOPOD_S3_SECRET`)
3. Créer le bucket MinIO si ce n'est pas déjà fait et, idéalement, un utilisateur restreint :
   ```bash
   s3cmd mb s3://salete-media-podcast
   # ou via 'mc' (voir README racine)
   ```

> 💡 Le fichier `.env.castopod` doit être à la racine du projet (pas dans `castopod/`) pour être correctement lu par Docker Compose.

## ▶️ Démarrage local
Depuis la racine du projet :
```bash
# S'assurer que Docker est démarré (Colima sur macOS)
colima start

# Lancer (ou vérifier) les services communs : PostgreSQL + MinIO
docker compose up db s3 -d

# Démarrer Castopod (MariaDB, Redis, app)
docker compose \
  -f docker-compose.yml \
  -f castopod/docker-compose.castopod.yml \
  --profile castopod \
  up -d
```

- Le service Castopod écoute sur `http://localhost:8000`
- Les données persistantes sont stockées dans les volumes Docker `castopod_db`, `castopod_cache`, `castopod_media`
- Pour arrêter :
  ```bash
  docker compose -f docker-compose.yml -f castopod/docker-compose.castopod.yml --profile castopod down
  ```

> 💡 **Tip** : Vérifier l'état des conteneurs avec `docker ps` ou `docker compose ps`

> ℹ️ Les services `db` (PostgreSQL) et `s3` (MinIO) du `docker-compose.yml` principal restent nécessaires pour le mur Fastify et pour exposer l'API S3 à Castopod.

## ☁️ CleverCloud (aperçu)
- Créer une application Docker Castopod séparée et lui associer :
  - Un addon MariaDB minimal (plan DEV)
  - Un addon Redis (fortement recommandé)
  - Un bucket Cellar dédié (`salete-media-podcast`) avec des credentials séparés
- Router `saletesincere.fr/podcast*` vers l'application Castopod via le reverse proxy CleverCloud (cf. ADR 0006)
- Injecter les variables d'environnement produites depuis CleverCloud dans l'application Castopod (équivalentes à celles du `.env.castopod`)

## 🧪 Tests à prévoir
- Vérifier `http://localhost:8000/cp-install` et réaliser l'installation initiale
- Uploader un épisode et contrôler que le média est bien stocké dans le bucket `salete-media-podcast`
- Exécuter le script d'audit sécurité (`./scripts/prepare_audit.sh full`) une fois l'intégration `/podcast` câblée

Pour plus de détails, se référer à `documentation/adr/adr_0006_castopod_integration.md` et aux sections CleverCloud du `README.md` racine.
