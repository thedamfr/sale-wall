# Saleté Sincère

Une plateforme « mur vocal » pour partager vos petites victoires "Wafer" et "Charbon" du quotidien, voter pour vos coups de coeur, et faire naître des épisodes longs.

## ✨ Fonctionnalités

- **🎙️ Enregistrement vocal** : Formulaire intégré dans le hero avec MediaRecorder API
- **📝 Transcription manuelle** : Transcription obligatoire pour l'accessibilité
- **🏷️ Système de badges** : Classement "Wafer" (léger) et "Charbon" (intense)
- **👍 Système de votes** : Vote par IP pour les posts préférés
- **🎨 Design responsive** : Interface adaptée mobile/desktop avec Tailwind CSS v4
- **♿ Accessibilité** : Labels ARIA, navigation au clavier, contraste élevé

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

## 📦 Structure du projet

```
salete-sincere/
├── server.js            # Serveur Fastify principal
├── server/
│   └── views/           # Templates Pug
├── public/              # Assets statiques
│   ├── style.css        # CSS compilé
│   ├── custom.css       # CSS custom
│   └── js/
│       └── record.js    # Gestion enregistrement vocal
├── uploads/             # Fichiers audio uploadés
├── sql/                 # Scripts SQL
├── scripts/             # Scripts utilitaires
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
- **Stockage** : Local en dev (`/uploads/`), S3 en production

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
```bash
# Créer une app Node.js sur CleverCloud
clever create --type node

# Ajouter PostgreSQL
clever addon create postgresql-addon

# Variables d'environnement (voir cleverapps.json)
```

### 2. Déploiement
```bash
git push clever main
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

1. Fork le projet
2. Créez une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Committez vos changements (`git commit -am 'Ajout nouvelle fonctionnalité'`)
4. Push sur la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrez une Pull Request

---

## 📄 Licence

MIT License - voir le fichier [LICENSE](LICENSE) pour plus de détails.
