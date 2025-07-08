# TODO MVP « Saleté Sincère »
*Solo-builder – sessions de 45 – 90 min pendant que le fiston dort.*

**Légende**  
- ⏱ 15′ : mini-tâche faisable même crevé  
- ⚠︎ : point de vigilance / risque  
- 🔄 : dépend d’une tâche précédente  

---

## Bloc 1 — Domaine, DNS & Cloudflare
- [x] ⏱ 15′ Acheter **saletesincere.fr** chez Gandi / OVH  
- [x] ⏱ 15′ Ajouter le domaine dans **Cloudflare** (plan Free)  
- [x] ⏱ 10′ Changer les *nameservers* chez le registrar → Cloudflare  
- [ ] ⏱ 10′ Activer **DNSSEC** (copier l’enregistrement DS)  
- [x] ⏱ 10′ Créer les enregistrements : CNAME
- [ ] ⏱ 5′ Ajouter **CAA = letsencrypt.org**  
- [ ] ⏱ 5′ Vérifier la propagation : `dig +trace saletesincere.fr`

---

## Bloc 2 — Environnement Clever Cloud (Node 24)
- [x] ⏱ 10′ Créer l’**addon PostgreSQL** (plan XS)  
- [x] ⏱ 10′ Créer le **bucket Cellar** (S3-compatible)  
- [x] ⏱ 10′ Générer clé/secret Cellar + copier `DATABASE_URL`  
- [x] ⏱ 10′ Créer une **app Node 24** (runtime natif)  
- [x] ⏱ 5′ Ajouter les variables d’env (`DATABASE_URL`, `CELLAR_*`) dans Clever  
- [x] ⏱ 15′ Pousser un **hello-world** → `git push clever main`  - en fait on est en synchro directe avec github qui est ouvert
- [ ] ⚠︎ 10′ Vérifier dans les logs que Clever détecte **Node v24.x**

---

## Bloc 3 — Monorepo Fastify 5 + Pug
- [x] ⏱ 15′ Installer **pnpm** et initialiser les *workspaces*  
- [x] ⏱ 30′ Générer le squelette **Fastify 5** avec **@fastify/view** (Pug)  
- [x] ⏱ 20′ Créer le dossier `src/server/views/` et ajouter les templates de base Pug (`layout.pug`, `index.pug`, `error.pug`)  
- [ ] ⏱ 10′ Ajouter **Tailwind CSS** + config Purge  
- [ ] ⏱ 10′ Configurer **ESLint & Prettier** et définir les scripts `dev | build | start`  
- [ ] ⏱ 15′ Tester en local : `npm dev` → vérifier que la page SSR Pug s’affiche  

---

## Bloc 4 — Front SSR & Pages
- [ ] ⏱ 30′ Landing **/** (Tailwind, responsive)  
- [ ] ⏱ 20′ Page **/mur** (liste Wafer / Charbon, filtres)  
- [ ] ⏱ 15′ Composant **Vote +1** (fetch POST, re-render)  
- [ ] ⏱ 15′ SEO : `<title>`, OpenGraph, favicon  
- [ ] ⚠︎ 15′ Vérifier **Lighthouse LCP < 1 s**

---

## Bloc 5 — Upload & Stockage
- [ ] ⏱ 20′ Script SQL : tables `recordings` & `votes`  
- [ ] ⏱ 20′ Route **POST /api/recordings** → URL signée Cellar  
- [ ] ⏱ 15′ Client : **MediaRecorder** → upload direct S3  
- [ ] ⏱ 10′ Limiter la durée à **90 s** côté client  
- [ ] ⏱ 15′ Route **GET /api/recordings?status=published** (liste)

---

## Bloc 6 — Modération minimale
- [ ] ⏱ 10′ Script CLI `flip_status.js id → published`  
- [ ] ⏱ 20′ Page admin **/admin/pending** (table HTMX, BasicAuth)  
- [ ] ⏱ 10′ Whitelist IP familiale (middleware Fastify)  
- [ ] ⚠︎ 15′ Rejeter fichiers > 10 Mo ou MIME ≠ audio

---

## Bloc 7 — Cache & Perf Cloudflare
- [ ] ⏱ 10′ Règle **Cache-Everything** sur `GET /` & `/mur*`  
- [ ] ⏱ 5′ **Bypass** cache `/api/*`, `/health`  
- [ ] ⏱ 15′ Webhook **PURGE** après upload publié (Fastify → API CF)  
- [ ] ⏱ 15′ Bench `wrk -t4 -c32 -d30s` → viser ≥ 1 000 req/s Edge

---

## Bloc 8 — Pré-lancement & Métrologie
- [ ] ⏱ 10′ Banner **cookies / RGPD**  
- [ ] ⏱ 10′ Page **Privacy Policy** statique  
- [ ] ⏱ 10′ Générer `sitemap.xml` & `robots.txt`  
- [ ] ⏱ 10′ Intégrer **Plausible** (`<script … data-domain=`)  
- [ ] ⏱ 30′ Dry-run : upload ⇒ modération ⇒ vote ⇒ publication  
- [ ] ⏱ 15′ Purger cache, poster annonce Twitter / LinkedIn (*soft-launch*)

---

## Backlog post-MVP
- Auth **JWT + RLS** (si passage Supabase / Keycloak)  
- **WebSockets Realtime** pour les votes live  
- **Transcription auto** (SEO & accessibilité)  
- **Export RSS** vers studio podcast  
- **Internationalisation** EN / ES  
