# Saleté Sincère

Une plateforme « mur vocal » pour partager vos petites victoires "Wafer" et "Charbon" du quotidien, voter pour vos coups de coeur, et faire naître des épisodes longs.

---

## 🚀 Stack technique

- **Backend** : Fastify 5.x + Pug (SSR)
- **Styling** : Tailwind CSS v4 + PostCSS
- **Base de données** : PostgreSQL
- **Stockage** : S3 (MinIO en dev)
- **Déploiement** : CleverCloud
- **Dev** : Nodemon + Docker Compose

---

## 📦 Structure du projet

```
salete-sincere/
├── server.js            # Serveur Fastify principal
├── server/
│   └── views/           # Templates Pug
├── public/              # Assets statiques (CSS compilé)
├── routes/              # Routes API
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

### 3. Lancer les services (PostgreSQL + S3)
```bash
docker compose up db s3 -d
```

### 4. Lancer le serveur de dev
```bash
npm run dev          # Serveur avec live reload
npm run dev:css      # Watch CSS (optionnel, terminal séparé)
```

### 5. Accéder à l'application
- **App** : http://localhost:3000
- **S3 Console** : http://localhost:9001 (admin/password: salete/salete123)

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
- **Fastify 5.x** : Framework web rapide
- **Pug** : Moteur de templates
- **Tailwind CSS v4** : Framework CSS utilitaire
- **PostCSS** : Processeur CSS
- **Nodemon** : Live reload en développement

### Structure du code
- Serveur principal dans `server.js`
- Templates Pug dans `server/views/`
- Routes API dans `routes/`
- CSS source dans `style.css` (compilé vers `public/style.css`)

### Tips de dev
- Gardez les DevTools ouverts avec cache désactivé
- Utilisez `npm run dev` pour le live reload
- Les variables d'env sont dans `.env` pour le dev local

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
