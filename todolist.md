---
title: Todolist MVP Saleté Sincère
description: Liste des tâches et roadmap
---

## 🎵 Audio Player Enhancement (US1.1)

### Phase 1: MVP Native Player ✅ TERMINÉ (17/11/2025)
- [x] ⏱ 120′ **Player HTML5 basique** : Lecture complète épisode dans Episode Highlight
- [x] ⏱ 30′ **Permissions MinIO** : `/og-images/*` public + fix bucket policy
- [x] ⏱ 45′ **Cleanup UI** : Supprimer player dupliqué, design épuré
- [x] ⏱ 30′ **Documentation** : ADR-0013 + update README troubleshooting
- **Commit** : `69d1404` - feat: add audio player to podcast smartlink

### Phase 2: Waveform Player (EN COURS)
- [ ] 🎨 60′ **Integration wavesurfer.js** : Player avec visualisation waveform
  - Installation: `npm install wavesurfer.js`
  - CDN alternatif si problème build
  - Style custom purple/indigo pour match design
  - Play/pause + progress bar cliquable
  - Durée affichée (current / total)

- [ ] 🎨 30′ **Design responsive** : Mobile-friendly avec waveform adaptatif
  - Hauteur waveform: 80px desktop, 60px mobile
  - Couleurs: gradient purple (#9333EA) → indigo (#4F46E5)
  - Bouton play circulaire avec icon
  - Timeline en dessous du waveform

- [ ] 📝 15′ **Update ADR-0013** : Documenter upgrade vers wavesurfer.js
  - Raison: UX moderne type SoundCloud
  - Taille bundle: ~50KB (acceptable pour feature premium)

### Phase 3: Optimisation Audio (POST-MVP)
- [ ] 🔧 **Audio Clip Service** : Générer previews 60-90s avec ffmpeg
  - Service: `server/services/audioClipService.js`
  - Queue job pour génération asynchrone
  - Stockage S3: `/previews/s1e5.mp3`
  - Fade out automatique sur dernières 5s

- [ ] 📊 **Analytics** : Tracking écoute avec OP3 ou Podsights
  - Events: play, pause, complete (>80% écouté)
  - Metrics: taux d'écoute, drop-off points

**🎯 Objectif Phase 2** : Player visuellement attractif qui incite à l'écoute

---

## 🎙️ Castopod Integration (Podcasting Platform)

### Infrastructure CleverCloud ✅ TERMINÉ
- [x] ⏱ 30′ **Bucket Cellar S3** : `salete-media-podcast` avec CORS et permissions publiques
- [x] ⏱ 20′ **MySQL addon** : Plan DEV (gratuit) avec 10MB stockage
- [x] ⏱ 15′ **Redis addon** : Plan S (~5€/mois) pour cache Castopod
- [x] ⏱ 45′ **Application Docker** : Configuration complète avec variables d'environnement
- [x] ⏱ 30′ **Déploiement initial** : Build et tests multiples pour corriger configuration

### Configuration DNS et Routage ⏳ EN ATTENTE
- [ ] ⚠️ 10′ **Cloudflare DNS** : Ajouter CNAME `podcast` → `app_eaed31f5-389b-4324-9136-dd3392ba6224.cleverapps.io`
  - Type: CNAME
  - Name: podcast
  - Target: app_eaed31f5-389b-4324-9136-dd3392ba6224.cleverapps.io
  - Proxy: ✅ Activé (orange cloud)

- [ ] 🔄 5′ **Mise à jour variables** : Après configuration DNS
  ```bash
  clever env set CP_BASEURL 'https://podcast.saletesincere.fr' --alias castopod
  clever restart --alias castopod --without-cache
  ```

### Installation et Configuration ⏳ À FAIRE
- [ ] 🔄 15′ **Wizard d'installation** : Accéder à `/cp-install` une fois DNS configuré
  - URL: https://podcast.saletesincere.fr/cp-install
  - Créer compte super-admin
  - ⚠️ **Activer 2FA obligatoirement** (sécurité production)

- [ ] 🔄 20′ **Test upload podcast** : Vérifier intégration S3
  - Créer un podcast de test
  - Uploader un épisode audio
  - Vérifier URLs média Cellar
  - Tester flux RSS

### Documentation ✅ TERMINÉ
- [x] ⏱ 60′ **ADR 0007** : Décision architecture sous-domaine vs sous-chemin
- [x] ⏱ 30′ **DEPLOY_CLEVERCLOUD.md** : Mise à jour avec contraintes routing
- [x] ⏱ 10′ **Index ADRs** : Ajout ADR-0007 dans l'index
- [x] ⏱ 5′ **Todolist** : Documentation des prochaines étapes

**📋 Raison du sous-domaine** :
- ❌ Castopod ne supporte PAS les sous-chemins (`/podcast` → 404 systématiques)
- ✅ Sous-domaine requis : `podcast.saletesincere.fr`
- Voir ADR-0007 pour détails techniques

**💰 Coûts mensuels** :
- Application Docker: Gratuit (plan Nano)
- MySQL DEV: Gratuit
- Redis S: ~5€
- S3 Storage: ~0-2€
- **Total: ~5-7€/mois**

---

## 🐛 Bugs à corriger projet audio ave## Bloc 3 — Monorepo Fastify 5 + Pug ✅ TERMINÉ
- [x] ⏱ 15′ Installer **pnpm** et initialiser les *workspaces*  
- [x] ⏱ 30′ Générer le squelette **Fastify 5** avec **@fastify/view** (Pug)  
- [x] ⏱ 20′ Créer le dossier `server/views/` et ajouter les templates de base Pug (`layout.pug`, `index.pug`, `manifeste.pug`)  
- [x] ⏱ 10′ Ajouter **Tailwind CSS** + config Purge  
- [x] ⏱ 10′ Configurer **ESLint & Prettier** et définir les scripts `dev | build | start`  
- [x] ⏱ 15′ Tester en local : `npm dev` → vérifier que la page SSR Pug s'afficheités et estimations
owner: @thedamfr
status: active
review_after: 2025-12-01
canonical_url: https://github.com/thedamfr/sale-wall/blob/main/todolist.md
tags: [todolist, mvp, roadmap, tasks]
---

# TODO MVP « Saleté Sincère » ✅ LIVRÉ !

*Solo-builder – sessions de 45 – 90 min*

**🎉 MVP DÉPLOYÉ EN PRODUCTION !**  
**URL** : https://app-cb755f4a-25da-4a25-b40c-c395f5086569.cleverapps.io/  
**Date de livraison** : 12 juillet 2025

**Légende**  
- ⏱ 15′ : mini-tâche faisable même crevé  
- ⚠︎ : point de vigilance / risque  
- 🔄 : dépend d'une tâche précédente  

---

## 🏖️ Sécurité Vacances (Urgent) ✅ TERMINÉ !
- [x] ⚠️ 30′ **Rate Limiting** : `@fastify/rate-limit` avec stockage in-memory
  - Upload audio : 3/heure par IP
  - Votes : 10/heure par IP  
  - Pages : 100/minute par IP
- [x] ⚠️ 40′ **Validation audio 30s** : Client + Serveur + réorganisation architecture
- [x] ⚠️ 25′ **Headers sécurisés** : Suppression headers techniques + ajout headers sécurité
- [x] ⚠️ 5′ **Limiter autoscaler** : 1 seule VM CleverCloud (`clever scale --max-instances 1`)
- [x] ⚠️ 20′ **Tests & déploiement** : Scripts automatisés + validation complète

**🎉 Application sécurisée et prête pour les vacances !**

---

## � Audit OWASP Top 10 ✅ TERMINÉ !
- [x] ⏱ 60′ **Plan d'audit OWASP** : Rédaction du plan markdown complet
  - ✅ Analyse des 10 risques OWASP Top 10 2021
  - ✅ Identification des fonctionnalités concernées
  - ✅ Définition des tests spécifiques par risque
  - ✅ Critères de réussite et échec
- [x] ⏱ 90′ **Script d'audit automatisé** : Génération du script bash
  - ✅ Tests A01-A10 : Access Control, Crypto, Injection, Design, etc.
  - ✅ Génération de fichiers de test (audio, corrompu, etc.)
  - ✅ Validation des headers de sécurité
  - ✅ Tests de rate limiting et validation
  - ✅ Rapport markdown automatique
- [x] ⏱ 20′ **Script de préparation** : Environnement et exécution
  - ✅ Vérification des prérequis (Node, npm, curl, jq, ffmpeg)
  - ✅ Installation des dépendances
  - ✅ Configuration environnement de test
  - ✅ Démarrage/arrêt serveur automatique
  - ✅ Nettoyage après audit

**📋 Fichiers créés :**
- `security/plans/owasp_top10_audit_plan.md` : Plan d'audit complet
- `security/audit_guide.md` : Guide d'utilisation
- `security/reports/audit_final_report.md` : Rapport final
- `scripts/audit_owasp.sh` : Script d'audit automatisé
- `scripts/prepare_audit.sh` : Script de préparation

**🎯 Utilisation :**
```bash
# Audit complet automatique
./scripts/prepare_audit.sh full

# Résultats dans security/reports/
```

---

## �🐛 Bugs à corriger
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

## Bloc 4 — Front SSR & Pages ✅ TERMINÉ
- [x] ⏱ 30′ Landing **/** (Tailwind, responsive)  
- [x] ⏱ 20′ Page **/mur** (liste Wafer / Charbon, filtres)  
- [x] ⏱ 15′ Composant **Vote +1** (fetch POST, re-render)  
- [x] ⏱ 15′ SEO : `<title>`, OpenGraph, favicon  
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
- [x] ✅ 20′ **Système de votes** par IP avec prévention double vote ✅ **CORRIGÉ**  
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

### 🧪 Tests & Qualité
- [ ] ⚠️ 60′ **Framework de tests** : Mise en place testing complet
  - Choix stack : Node.js test runner ou Vitest
  - Tests unitaires : validators, middleware, utils
  - Tests d'intégration : API endpoints avec base de test
  - Tests E2E : parcours utilisateur audio complet
  - CI/CD : automatisation sur GitHub Actions
- [ ] ⚠️ 120′ **Migration TypeScript** : Amélioration qualité code
  - Configuration tsconfig.json + types @fastify
  - Migration progressive server.js → server.ts
  - Types pour schemas validation et base données
  - Types pour interfaces S3/PostgreSQL
  - Refactor VoiceRecorder class en TS strict

### 🚀 Fonctionnalités
- Auth **JWT + RLS** (si passage Supabase / Keycloak)  
- **WebSockets Realtime** pour les votes live  
- **Transcription auto** (SEO & accessibilité)  
- **Export RSS** vers studio podcast  
- **Internationalisation** EN / ES  
