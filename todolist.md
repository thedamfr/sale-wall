# TODO MVP « Saleté Sincère » ✅ LIVRÉ !
*Solo-builder – sessions de 45 – 90 min pendant que le f## 🏖️ Sécurité Vacances (Urgent)
- [x] ⚠️ 30′ **Rate Limiting** : `@fastify/rate-limit` avec stockage in-memory
  - Upload audio : 3/heure par IP
  - Votes : 10/heure par IP  
  - Pages : 100/minute par IP
- [x] ⚠️ 40′ **Validation audio 30s** : Client + Serveur + réorganisation architecture
- [x] ⚠️ 25′ **Headers sécurisés** : Suppression headers techniques + ajout headers sécurité
- [x] ⚠️ 5′ **Limiter autoscaler** : 1 seule VM CleverCloud (`clever scale --max-instances 1`)
- [ ] ⚠️ 10′ **Tests & déploiement** : Validation avant vacances

---

## 🐛 Bugs à corriger
- [x] ⚠️ **Système de votes** : Le vote ne fonctionne pas correctement en production
  - ✅ Vérifier la route POST `/api/posts/:id/vote`
  - ✅ Vérifier la logique de hachage IP
  - ✅ Tester le feedback utilisateur (toast, compteur)
  - ✅ Vérifier les requêtes SQL de voteStatut : MVP DÉPLOYÉ EN PRODUCTION !**  
**URL : https://app-cb755f4a-25da-4a25-b40c-c395f5086569.cleverapps.io/**  
**Date de livraison : 12 juillet 2025**

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

## Bloc 5 — Upload & Stockage ✅ TERMINÉ
- [x] ✅ 20′ Script SQL : tables `posts` & `votes` avec UUID  
- [x] ✅ 20′ Route **POST /api/posts** → upload direct S3 + base  
- [x] ✅ 15′ Client : **MediaRecorder** → envoi multipart/form-data  
- [x] ✅ 10′ Limiter la durée à **3 min** côté client avec timer  
- [x] ✅ 15′ Route **GET /** (homepage) avec liste des posts

---

## Bloc 6 — Fonctionnalités vocales ✅ TERMINÉ
- [x] ✅ 30′ **Formulaire d'enregistrement** vocal inline dans le hero  
- [x] ✅ 20′ **MediaRecorder API** avec feedback visuel et timer  
- [x] ✅ 15′ **Transcription manuelle** obligatoire pour accessibilité  
- [x] ✅ 10′ **Système de badges** Wafer/Charbon avec validation  
- [x] ✅ 15′ **Preview audio** avant envoi avec contrôles

---

## Bloc 7 — Base de données & Production ✅ TERMINÉ
- [x] ✅ 15′ **PostgreSQL** : connexion et requêtes optimisées  
- [x] ✅ 10′ **Initialisation** via script SQL avec données de test  
- [x] ⚠️ 20′ **Système de votes** par IP avec prévention double vote *(BUG : à débugger)*  
- [x] ✅ 15′ **Stockage S3/Cellar** avec URLs publiques  
- [x] ✅ 10′ **Variables d'environnement** auto-injectées CleverCloud
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

## �️ Sécurité Vacances (Urgent)
- [ ] ⚠️ 30′ **Rate Limiting** : `@fastify/rate-limit` avec stockage in-memory
  - Upload audio : 3/heure par IP
  - Votes : 10/heure par IP  
  - Pages : 100/minute par IP
- [ ] ⚠️ 20′ **Validation audio 30s** : Client + Serveur
- [ ] ⚠️ 15′ **Headers sécurisés** : Supprimer `X-Powered-By`, `Server`
- [ ] ⚠️ 15′ **Limiter autoscaler** : 1 seule VM CleverCloud
- [ ] ⚠️ 10′ **Messages discrets** : "Revenez demain !" sans détails techniques
- [ ] ⚠️ 10′ **Tests & déploiement** : Validation avant vacances

---

## �🐛 Bugs à corriger
- [ ] ⚠️ **Système de votes** : Le vote ne fonctionne pas correctement en production
  - Vérifier la route POST `/api/posts/:id/vote`
  - Vérifier la logique de hachage IP
  - Tester le feedback utilisateur (toast, compteur)
  - Vérifier les requêtes SQL de vote

---

## Backlog post-MVP
- Auth **JWT + RLS** (si passage Supabase / Keycloak)  
- **WebSockets Realtime** pour les votes live  
- **Transcription auto** (SEO & accessibilité)  
- **Export RSS** vers studio podcast  
- **Internationalisation** EN / ES  
