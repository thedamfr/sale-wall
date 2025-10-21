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
- **📧 Newsletter intégrée** : Inscription double opt-in via API Brevo (backend-only)
- **🎨 Design responsive** : Interface adaptée mobile/desktop avec Tailwind CSS v4
- **♿ Accessibilité** : Labels ARIA, navigation au clavier, contraste élevé
- **🔒 Sécurité renforcée** : Rate limiting, validation stricte, audit OWASP Top 10
- **☁️ Stockage cloud** : Upload automatique sur S3/Cellar en production
- **🚀 Production ready** : Déployé sur CleverCloud avec base PostgreSQL

---

## 🚀 Stack technique

- **Backend** : Fastify 5.x
- **Templates** : 🔄 **Migration Pug → HTML en cours** (voir ci-dessous)
- **Frontend** : Vanilla JS + MediaRecorder API
- **Styling** : Tailwind CSS v4 + PostCSS + CSS custom
- **Base de données** : PostgreSQL avec UUID
- **Stockage** : S3 (MinIO en dev) pour les fichiers audio
- **Déploiement** : CleverCloud avec Docker
- **Dev** : Nodemon + Docker Compose

---

## 🔄 Système de Templates : Migration Pug → HTML

### Statut actuel

Le projet est en **migration progressive** de Pug vers HTML pur pour améliorer la **lisibilité** et **maintenabilité** du code.

### Pourquoi cette migration ?

- ✅ **Lisibilité universelle** : HTML est un standard connu de tous
- ✅ **Pas de courbe d'apprentissage** : Pas de syntaxe propriétaire à apprendre
- ✅ **Meilleur support IDE** : Autocomplétion et validation natives
- ✅ **Debugging simplifié** : Pas d'erreurs de syntaxe cryptiques
- ✅ **Contribution facilitée** : Barrière à l'entrée plus basse

### Règles de développement

| Situation | Action | Exemple |
|-----------|--------|---------|
| **Nouvelle page** | ✅ Créer en `.html` | `server/views/podcast.html` |
| **Modification légère** | ⚠️ Garder le `.pug` | Correction typo → pas de migration |
| **Refonte feature** | ✅ Migrer vers `.html` | Redesign page → passer en HTML |
| **Page très dynamique** | 🤔 Évaluer au cas par cas | Beaucoup de logique serveur → peut rester Pug |

### Comment servir les templates ?

```javascript
// ✅ NOUVEAU : HTML pur
app.get("/podcast", { config: { rateLimit: pageLimiter }}, (req, reply) =>
  reply.sendFile("podcast.html", path.join(__dirname, "server", "views"))
);

// ⚠️ LEGACY : Pug (à migrer progressivement)
app.get("/manifeste", { config: { rateLimit: pageLimiter }}, (req, reply) =>
  reply.view("manifeste.pug", { title: "Manifeste" })
);
```

### Vues actuelles

#### ✅ HTML (moderne)
- `/podcast` → `podcast.html` - Page liens podcast (Linktree style)

#### ⚠️ Pug (legacy - à migrer)
- `/` → `index.pug` - Homepage avec enregistrement vocal
- `/manifeste` → `manifeste.pug` - Page manifeste
- `/newsletter` → `newsletter.pug` - Formulaire inscription
- `layout.pug` - Layout principal (header/footer)

### Checklist de migration

Quand vous migrez une vue Pug → HTML :

1. [ ] Créer le fichier `.html` équivalent
2. [ ] Convertir la syntaxe Pug en HTML standard
3. [ ] Remplacer `reply.view()` par `reply.sendFile()` dans `server.js`
4. [ ] Tester la page en local (http://localhost:3000)
5. [ ] Vérifier le responsive mobile
6. [ ] Supprimer le fichier `.pug` une fois validé
7. [ ] Commit : `refactor(views): migrate [page] from Pug to HTML`

**📚 Documentation complète** : [`documentation/adr/adr_0008_migration_pug_vers_html.md`](documentation/adr/adr_0008_migration_pug_vers_html.md)

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
- **Newsletter** : 5 inscriptions/heure par IP
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
│   ├── views/           # 🔄 Templates (migration Pug → HTML en cours)
│   │   ├── *.html       # ✅ Nouvelles vues (HTML pur)
│   │   └── *.pug        # ⚠️ Vues legacy (à migrer progressivement)
│   ├── middleware/      # Middleware Fastify
│   │   ├── rateLimiter.js
│   │   └── security.js
│   ├── validators/      # Validation données
│   │   └── audioValidator.js
│   └── newsletter/      # Module newsletter Brevo
│       ├── brevoClient.js  # Client API Brevo
│       └── routes.js       # Routes newsletter (/newsletter/*)
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
│   └── adr/             # Architecture Decision Records
│       └── adr_0008_migration_pug_vers_html.md  # 📄 Décision migration
├── castopod/            # Config Docker & docs Castopod (image officielle)
├── style.css            # CSS source (Tailwind)
├── .env                 # Variables d'environnement (dev local)
├── docker-compose.yml   # PostgreSQL + MinIO
├── Dockerfile           # Build production
└── package.json         # Dépendances et scripts
```

---

## ⚙️ Développement local

### Prérequis
- **Node.js** ≥ 24
- **Docker** (via Colima sur macOS)

```bash
# Installation Docker via Colima (macOS)
brew install colima docker docker-compose
colima start

# Vérifier que Docker fonctionne
docker --version
```

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

### 3. Démarrer les services
```bash
# S'assurer que Docker est démarré
colima status    # Devrait afficher "Running"
# Si arrêté : colima start

# DÉVELOPPEMENT : Lancer PostgreSQL + MinIO/S3
docker-compose up -d

# Vérifier que les services sont UP
docker-compose ps
```

### 4. Initialiser la base de données
```bash
# Initialiser les tables et données de test
docker exec -i salete_pg psql -U salete -d salete < sql/001_init.sql
```

### 5. Compiler le CSS (OBLIGATOIRE)
```bash
# ⚠️ IMPORTANT : Compiler le CSS avant le premier lancement
npm run build:css
```
**🚨 Cette étape est cruciale** : Sans compilation CSS, les styles Tailwind ne seront pas appliqués et l'interface sera cassée.

### 6. Lancer le serveur de dev
```bash
# Mode développement : serveur local avec live reload
npm run dev          # Serveur avec nodemon (port 3000)
npm run dev:css      # Watch CSS (optionnel, terminal séparé)
```

**Note** : En mode développement, seuls PostgreSQL et MinIO tournent dans Docker. Le serveur Node.js tourne en local pour le live reload.

### 7. Accéder à l'application
- **App** : http://localhost:3000
- **S3 Console** : http://localhost:9001 (admin/password: salete/salete123)

---

## 🎙️ Castopod - Plateforme Podcast (Optionnel)

Castopod est une plateforme open-source pour héberger et gérer des podcasts. Elle est intégrée au projet pour publier des épisodes longs à partir des posts audio.

### Démarrage rapide

```bash
# 1. Créer le fichier de configuration
cp castopod/.env.castopod.example castopod/.env.castopod

# 2. Démarrer Castopod (nécessite PostgreSQL + MinIO déjà lancés)
docker-compose -f castopod/docker-compose.castopod.yml --profile castopod up -d

# 3. Accéder à Castopod
# Interface web : http://localhost:8000
```

### Services Castopod

Castopod démarre 3 services supplémentaires :
- **castopod** : Application web PHP (port 8000)
- **castopod-db** : Base MariaDB 11.4 dédiée
- **castopod-cache** : Cache Redis pour les performances

### Configuration S3

Castopod utilise un bucket S3 dédié `salete-media-podcast` pour stocker les médias podcast :
- Bucket séparé du bucket principal (`salete-media`)
- Préfixe : `podcast/`
- Configuration dans `castopod/.env.castopod`

### Arrêt de Castopod

```bash
docker-compose -f castopod/docker-compose.castopod.yml --profile castopod down
```

### Documentation complète

Consultez [`castopod/README.md`](castopod/README.md) pour :
- Configuration détaillée
- Création utilisateur admin
- Intégration avec MinIO/Cellar
- Déploiement CleverCloud

**Référence** : [ADR 0006 - Intégration Castopod](documentation/adr/adr_0006_castopod_integration.md)

---

## 🚀 Démarrer TOUS les serveurs en une commande

```bash
# 1. Démarrer PostgreSQL + MinIO/S3
docker-compose up -d

# 2. Démarrer Castopod (MariaDB + Redis + Castopod)
docker-compose -f castopod/docker-compose.castopod.yml --profile castopod up -d

# 3. Démarrer le serveur Fastify
npm run dev
```

**Accès aux services** :
- 🎙️ **App principale** : http://localhost:3000
- 📻 **Castopod** : http://localhost:8000
- 📦 **Console S3** : http://localhost:9001 (salete/salete123)

---

## 🆘 Troubleshooting Rapide

### ❌ Interface cassée / Styles non appliqués
**Symptôme** : L'interface semble cassée, boutons invisibles, pas de styles

**Solution** :
```bash
# Recompiler le CSS Tailwind
npm run build:css
```

**Explication** : Les classes Tailwind CSS ne sont générées que lors de la compilation. Si vous modifiez les templates `.pug` ou ajoutez de nouvelles classes, il faut recompiler.

### ❌ Erreur de connexion base de données
**Symptôme** : `Connection refused` ou `database salete does not exist`

**Solution** :
```bash
# Vérifier que Docker tourne
colima status
docker-compose ps

# Redémarrer les services si nécessaire  
docker-compose up db s3 -d
```

### ❌ Permissions micro non accordées
**Symptôme** : L'enregistrement vocal ne fonctionne pas

**Solution** : Autoriser le micro dans votre navigateur (icône 🔒 dans la barre d'adresse)

---

### 📋 Modes d'utilisation

#### 🛠️ Mode Développement (recommandé)
```bash
# 1. Services seulement (DB + S3)
docker-compose up db s3 -d

# 2. Serveur en local avec live reload
npm run dev
```
✅ **Avantages** : Live reload, debug facile, performance optimale

#### 🐳 Mode Production/Tests
```bash
# Tout dans Docker
docker-compose --profile production up -d
```
✅ **Avantages** : Environnement identique à la production

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
- **Stockage** : Local en dev (`/uploads/`), S3/Cellar en production (`salete-media` pour le mur, `salete-media-podcast` pour Castopod)
- **URLs publiques** : `https://cellar-c2.services.clever-cloud.com/salete-media/audio/[filename]`

---

## 🏗️ Scripts disponibles

```bash
npm run dev          # Développement avec nodemon (serveur seulement)
npm run dev:css      # Watch compilation CSS (optionnel, terminal séparé)
npm run build        # Build complet (CSS + views) pour production
npm run build:css    # ⚠️ OBLIGATOIRE : Compilation CSS Tailwind
npm start            # Démarrage production
```

**💡 Quand utiliser `npm run build:css` ?**
- ✅ **Toujours** avant le premier lancement  
- ✅ Après modification des templates Pug  
- ✅ Après ajout de nouvelles classes Tailwind CSS  
- ✅ Si l'interface semble cassée ou les boutons invisibles

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

#### Variables automatiques (Addons CleverCloud)
- `POSTGRESQL_ADDON_URI` : URL de connexion PostgreSQL
- `CELLAR_ADDON_HOST` : Endpoint S3 Cellar
- `CELLAR_ADDON_KEY_ID` : Clé d'accès S3
- `CELLAR_ADDON_KEY_SECRET` : Clé secrète S3

#### Variables Newsletter (à configurer)
- `BREVO_BASEURL="https://api.brevo.com/v3"` : URL API Brevo
- `BREVO_API_KEY="xkeysib-xxx"` : Clé API Brevo (obligatoire)
- `BREVO_LIST_ID="3"` : ID liste "Saleté Sincère" dans Brevo
- `BREVO_DOI_TEMPLATE_ID="TBD"` : ID template email double opt-in
- `SALENEWS_PUBLIC_BASEURL="https://saletesincere.fr"` : URL publique pour redirections

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
s3cmd mb s3://salete-media-podcast
```

> ℹ️ `salete-media` reste dédié au mur Fastify tandis que `salete-media-podcast` héberge les médias Castopod. Pensez à générer une paire `ACCESS_KEY/SECRET` spécifique pour Castopod et à la restreindre à ce bucket (ou au préfixe `podcast/` si vous mutualisez le bucket).

```bash
# MinIO (exemple) : créer un utilisateur Castopod et attacher une policy restreinte
mc alias set local http://localhost:9000 salete salete123
mc admin user add local castopod castopod-secret
mc admin policy create local castopod-policy <<'EOF'
{
	"Version": "2012-10-17",
	"Statement": [{
		"Effect": "Allow",
		"Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject"],
		"Resource": ["arn:aws:s3:::salete-media-podcast/*"]
	}]
}
EOF
mc admin policy attach local castopod-policy --user castopod
```

> Sur Cellar, créez le bucket équivalent depuis la console CleverCloud et générez un jeu de credentials séparé (menu **Access keys**) pour l'appli Castopod.

### 6. Statut du déploiement
✅ **Application déployée** : https://app-cb755f4a-25da-4a25-b40c-c395f5086569.cleverapps.io/  
✅ **Base de données** : PostgreSQL opérationnelle  
✅ **Stockage S3** : Buckets `salete-media` (mur) & `salete-media-podcast` (Castopod) créés  
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

### Routes Newsletter
- **GET /newsletter** : Formulaire d'inscription
- **POST /newsletter/subscribe** : Traitement inscription (double opt-in)
- **GET /newsletter/confirmed** : Page confirmation après clic email

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
