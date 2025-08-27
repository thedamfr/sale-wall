---
title: Saleté Sincère
description: Plateforme audio pour partager victoires "Wafer" et "Charbon" du quotidien avec système de votes
owner: @thedamfr
status: active
review_after: 2026-01-01
canonical_url: https://github.com/thedamfr/sale-wall
tags: [audio, platform, fastify, postgresql, tdd]
production_url: https://app-cb755f4a-25da-4a25-b40c-c395f5086569.cleverapps.io/
---

# Saleté Sincère

Une plateforme « mur vocal » pour partager vos petites victoires "Wafer" et "Charbon" du quotidien, voter pour vos coups de coeur, et faire naître des épisodes longs.

## ✨ Fonctionnalités

- **🎙️ Enregistrement vocal** : Formulaire intégré dans le hero avec MediaRecorder API
- **📝 Transcription manuelle** : Transcription obligatoire pour l'accessibilité  
- **🏷️ Système de badges** : Classement "Wafer" (léger) et "Charbon" (intense)
- **👍 Système de votes** : Vote par IP pour les posts préférés
- **🎨 Design responsive** : Interface adaptée mobile/desktop avec Tailwind CSS v4
- **♿ Accessibilité** : Labels ARIA, navigation au clavier, contraste élevé
- **🔒 Sécurité renforcée** : Rate limiting, validation stricte, audit OWASP Top 10
- **☁️ Stockage cloud** : Upload automatique sur S3/Cellar en production
- **🚀 Production ready** : Déployé sur CleverCloud avec base PostgreSQL

---

## 🚀 Stack technique

- **Backend** : Fastify 5.x + Pug (SSR)
- **Frontend** : Vanilla JS + MediaRecorder API
- **Styling** : Tailwind CSS v4 + PostCSS + CSS custom
- **Base de données** : PostgreSQL avec UUID
- **Stockage** : S3 (MinIO en dev) pour les fichiers audio
- **Déploiement** : CleverCloud avec Docker
- **Dev** : Nodemon + Docker Compose

---

## � Sécurité

### 🛡️ Statut de Sécurité : ✅ SÉCURISÉ

- **Audit OWASP Top 10** : ✅ Conforme (Score 11/11)
- **Vulnérabilités critiques** : 0 détectée
- **Dernier audit** : 15 juillet 2025
- **Système de protection** : Rate limiting, validation stricte, headers sécurisés

### 🚦 Protections Actives

#### Rate Limiting
- **Posts audio** : 3 uploads/heure par IP
- **Votes** : 10 votes/heure par IP  
- **Navigation** : 100 pages/minute par IP

#### Validation des Données
- **Audio** : Format WebM/Opus, durée 30s-3min, taille max 10MB
- **Champs** : Validation stricte titre/transcription/badge
- **IDs** : Validation UUID pour tous les identifiants

#### Headers de Sécurité
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

#### Gestion des Erreurs
- Messages d'erreur sanitisés (pas de stack traces)
- Logging sécurisé côté serveur
- Pas d'exposition d'informations techniques

### 🔍 Audit et Monitoring

```bash
# Lancer un audit de sécurité complet
./scripts/prepare_audit.sh full

# Résultats dans security/reports/
```

**📋 Documentation complète** : [`security/README.md`](security/README.md)

---

## �📦 Structure du projet

```
salete-sincere/
├── server.js            # Serveur Fastify principal
├── CLAUDE.md            # Framework TDD générique (base contributeurs)
├── server/
│   ├── views/           # Templates Pug
│   ├── middleware/      # Middleware Fastify
│   │   ├── rateLimiter.js
│   │   └── security.js
│   └── validators/      # Validation données
│       └── audioValidator.js
├── .github/
│   └── copilot-instructions.md  # Instructions TDD spécifiques projet
├── public/              # Assets statiques
│   ├── style.css        # CSS compilé
│   ├── custom.css       # CSS custom
│   └── js/
│       └── record.js    # Gestion enregistrement vocal
├── uploads/             # Fichiers audio uploadés
├── sql/                 # Scripts SQL
├── scripts/             # Scripts utilitaires et audit
├── security/            # Audit et documentation sécurité
│   ├── README.md        # Vue d'ensemble sécurité
│   ├── audit_guide.md   # Guide d'utilisation
│   ├── plans/           # Plans d'audit
│   └── reports/         # Rapports de sécurité
├── documentation/       # ADR et docs
├── style.css            # CSS source (Tailwind)
├── .env                 # Variables d'environnement (dev local)
├── docker-compose.yml   # PostgreSQL + MinIO
├── Dockerfile           # Build production
└── package.json         # Dépendances et scripts
```

---

## ⚙️ Développement local

### 1. Installation
```bash
git clone <repo>
cd salete-sincere
npm install

# Outils pour la production (optionnel)
brew install clever-tools postgresql s3cmd
```

### 2. Configuration
```bash
# Copier et adapter les variables d'environnement
cp .env.example .env
```

### 3. Initialiser la base de données
```bash
# Lancer les services (PostgreSQL + S3)
docker compose up db s3 -d

# Initialiser les tables et données de test
docker exec -i salete_pg psql -U salete -d salete < sql/001_init.sql
```

### 4. Lancer le serveur de dev
```bash
npm run dev          # Serveur avec live reload
npm run dev:css      # Watch CSS (optionnel, terminal séparé)
```

### 5. Accéder à l'application
- **App** : http://localhost:3000
- **S3 Console** : http://localhost:9001 (admin/password: salete/salete123)

## 🎙️ Fonctionnalité d'enregistrement vocal

### Utilisation
1. Cliquer sur le bouton "**+ Enregistrer votre histoire**" dans le hero
2. Remplir le titre de l'histoire
3. Cliquer sur "**Commencer l'enregistrement**" (permission micro requise)
4. Parler pendant max 3 minutes
5. Cliquer sur "**Arrêter l'enregistrement**"
6. Écouter la prévisualisation
7. Transcrire manuellement le contenu
8. Choisir le badge (Wafer/Charbon)
9. Cliquer sur "**Partager votre histoire**"

### Contraintes techniques
- **Format audio** : WebM/Opus (navigateurs modernes)
- **Durée max** : 3 minutes
- **Transcription** : Obligatoire pour l'accessibilité
- **Stockage** : Local en dev (`/uploads/`), S3/Cellar en production (`salete-media` bucket)
- **URLs publiques** : `https://cellar-c2.services.clever-cloud.com/salete-media/audio/[filename]`

---

## 🏗️ Scripts disponibles

```bash
npm run dev          # Développement avec nodemon
npm run dev:css      # Watch compilation CSS
npm run build        # Build complet (CSS + views)
npm run build:css    # Compilation CSS seule
npm start            # Production
```

---

## 🐳 Production Docker

```bash
# Build et lancement complet
docker compose build --no-cache
docker compose up -d

# Accès : http://localhost:3000
```

---

## 🚀 Déploiement CleverCloud

### 1. Configuration
L'application est déployée sur CleverCloud avec les addons suivants :
- **PostgreSQL** : Base de données principale
- **Cellar S3** : Stockage des fichiers audio

### 2. Variables d'environnement
Les variables sont automatiquement configurées via les addons :
- `POSTGRESQL_ADDON_URI` : URL de connexion PostgreSQL
- `CELLAR_ADDON_HOST` : Endpoint S3 Cellar
- `CELLAR_ADDON_KEY_ID` : Clé d'accès S3
- `CELLAR_ADDON_KEY_SECRET` : Clé secrète S3

### 3. Déploiement
```bash
# Lier le repository à l'application CleverCloud
clever link <app-id>

# Déployer via Git hook
git push origin main
```

### 4. Initialisation de la base de données
```bash
# Avec Clever CLI et PostgreSQL client
brew install clever-tools postgresql
clever addon env <postgresql-addon-id>
PGPASSWORD="<password>" psql -h <host> -p <port> -U <user> -d <database> -f sql/001_init.sql
```

### 5. Configuration S3/Cellar
```bash
# Avec s3cmd
brew install s3cmd
s3cmd --configure
s3cmd mb s3://salete-media
```

### 6. Statut du déploiement
✅ **Application déployée** : https://app-cb755f4a-25da-4a25-b40c-c395f5086569.cleverapps.io/  
✅ **Base de données** : PostgreSQL opérationnelle  
✅ **Stockage S3** : Bucket `salete-media` créé  
✅ **Upload audio** : Testé et fonctionnel  
✅ **Accès public** : Fichiers accessibles via navigateur

---

## 🧪 Tests en production

### Vérification des fonctionnalités
✅ **Enregistrement audio** : 3 fichiers testés avec succès  
✅ **Upload S3/Cellar** : Stockage automatique opérationnel  
✅ **Base de données** : Connexion PostgreSQL stable  
✅ **URLs publiques** : Fichiers audio accessibles  
✅ **Interface utilisateur** : Formulaire et feedback fonctionnels  

### Fichiers de test créés
- `audio_1752304442181.webm` (3.4 KB) - 12/07/2025 07:14
- `audio_1752304625905.webm` (1.5 KB) - 12/07/2025 07:17  
- `audio_1752304733570.webm` (1.1 KB) - 12/07/2025 07:18

### Commandes de vérification
```bash
# Vérifier les fichiers S3
s3cmd ls s3://salete-media/audio/

# Tester l'accessibilité HTTP
curl -I https://cellar-c2.services.clever-cloud.com/salete-media/audio/audio_[timestamp].webm

# Vérifier la base de données
psql <connection-string> -c "SELECT COUNT(*) FROM posts;"
```

---

## 🧪 Développement

### Technologies utilisées
- **Fastify 5.x** : Framework web rapide + @fastify/multipart
- **Pug** : Moteur de templates SSR
- **Tailwind CSS v4** : Framework CSS utilitaire
- **PostCSS** : Processeur CSS
- **MediaRecorder API** : Enregistrement audio natif
- **PostgreSQL** : Base de données avec UUID et triggers
- **Nodemon** : Live reload en développement

### Structure du code
- Serveur principal dans `server.js` avec routes API intégrées
- Templates Pug dans `server/views/` (layout + pages)
- JavaScript client dans `public/js/record.js` (classe VoiceRecorder)
- CSS source dans `style.css` (compilé vers `public/style.css`)
- CSS custom dans `public/custom.css` (polices, boutons personnalisés)

### API Endpoints
- **POST /api/posts** : Création d'un post vocal (multipart/form-data)
- **POST /api/posts/:id/vote** : Vote pour un post
- **GET /audio/:filename** : Accès aux fichiers audio

### Tips de dev
- Gardez les DevTools ouverts avec cache désactivé
- Utilisez `npm run dev` pour le live reload
- Rebuilder le CSS avec `npm run build:css` si les classes Tailwind n'apparaissent pas
- Les variables d'env sont dans `.env` pour le dev local
- Permissions micro requises pour l'enregistrement vocal

---

## 🤝 Contribution

### Méthodologie TDD-first
Ce projet suit une approche **Test-Driven Development** stricte :
- **Documentation requis** : [`CLAUDE.md`](CLAUDE.md) - Framework TDD générique à personnaliser
- **Instructions spécifiques** : [`.github/copilot-instructions.md`](.github/copilot-instructions.md) - Guide pour ce projet
- **Cycle obligatoire** : ADR + sécurité → tests → code minimal → refactor → pause state

### Processus de contribution
1. **Consulter la documentation** : Lire `CLAUDE.md` et `.github/copilot-instructions.md`
2. Fork le projet
3. Créez une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
4. **Suivre TDD** : ADR minimal + tests d'abord + implémentation minimale
5. Committez vos changements (`git commit -am 'Ajout nouvelle fonctionnalité'`)
6. Push sur la branche (`git push origin feature/nouvelle-fonctionnalite`)
7. Ouvrez une Pull Request

---

## 📄 Licence

MIT License - voir le fichier [LICENSE](LICENSE) pour plus de détails.
