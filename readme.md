
# Saleté Sincère

Une plateforme « mur vocal » pour partager vos petites victoires »Wafer« et »Charbon« du quotidien, voter pour vos coups de coeur, et faire naître des épisodes longs.

---

## 🚀 Pourquoi Saleté Sincère ?

> **Solo-builder** – je code le soir quand mon fils dort, je garde l’essentiel.  
> **Pragmatique** – Fastify 5 + Svelte 5 SSR pour des perfs fulgurantes.  
> **Souverain** – tout tourne sur Clever Cloud (Node 24, PostgreSQL, Cellar S3).  
> **Ouvert** – code MIT, contributions bienvenues.

---

## 📦 Structure du projet

```

salete-sincere/
├── client/               # Front Svelte 5 + Tailwind
│   ├── index.html        # Entrée Vite
│   └── src/              # Composants & pages
├── server/               # API Fastify 5 + SSR
│   ├── server.js         # Point d’entrée
│   └── dist/             # Build SSR & assets
├── Dockerfile            # Multi-stage build monorepo
├── docker-compose.yml    # Postgres + MinIO + API (dev local)
├── .env.docker.example   # Vars d’env local Docker
├── package.json          # Workspaces npm (client + server)
└── README.md             # Ce fichier

````

---

## ⚙️ Prérequis

- **Node.js 24+** (via nvm ou Homebrew)  
- **Docker & Docker Compose** (Docker Desktop ou Colima)  
- **Clever Cloud CLI** (pour déployer)  
- **git & GitHub** (repo public MIT)

---

## 🛠 Installation & Dev

1. **Clone**  
   ```bash
   git clone git@github.com:<votre-utilisateur>/salete-sincere.git
   cd salete-sincere
````

2. **Env local Docker**

   ```bash
   cp .env.docker.example .env.docker
   # (ajuste si tu veux modifier les ports / credentials)
   ```

3. **Lancer la stack**

   ```bash
   docker compose up --build -d
   # ↳ Postgres + MinIO + API  
   ```

4. **Tester**

   * API health : `curl http://localhost:3000/health`
   * Front SSR : [http://localhost:3000](http://localhost:3000)
   * Console MinIO : [http://localhost:9001](http://localhost:9001) (salete / salete123)

5. **Dev mode**

   ```bash
   npm install           # monorepo
   npm run dev           # lance server dev (Fastify) + Vite HMR
   ```

---

## 📦 Build & Production

* **Local build**

  ```bash
  npm run build         # build client + server
  ```

* **Docker image**

  ```bash
  docker compose build api
  docker compose up -d
  ```

* **Deployment Clever Cloud**

  1. `npm run build`
  2. `git push clever main`
  3. Vérifie dans le dashboard que Node 24, PG et Cellar sont configurés.
  4. Cloudflare gère le cache & le SSL.

---

## 📝 Configuration

Crée dans le dashboard Clever Cloud ou `.env.docker` :

```dotenv
# PostgreSQL
DATABASE_URL=postgres://salete:salete@db:5432/salete
# MinIO / Cellar S3
S3_ENDPOINT=http://s3:9000
S3_ACCESS_KEY=salete
S3_SECRET_KEY=salete123
S3_BUCKET=salete-media
# Node
NODE_ENV=development
PORT=3000
```

---

## 📚 Ressources & liens

* **Docs Fastify** 5 → [https://www.fastify.io](https://www.fastify.io)
* **Docs Svelte** 5 → [https://svelte.dev](https://svelte.dev)
* **Clever Cloud** → [https://www.clever-cloud.com](https://www.clever-cloud.com)
* **Cloudflare DNS & CDN** → [https://dash.cloudflare.com](https://dash.cloudflare.com)

---

## 🤝 Contribution

1. Ouvre une issue ou un PR
2. Respecte les tests & le linter
3. Utilise des branches `feature/…`
4. Amuse-toi bien ! 🎉

---

© 2025 Saleté Sincère – code MIT

```
