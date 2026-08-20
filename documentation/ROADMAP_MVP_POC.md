# 🚀 Roadmap MVP POC - Sale-Wall (Smartlink Podcast)

**Objectif** : Transformer le POC podcast actuel en **SaaS smartlink** viable à 3€/mois  
**Horizon** : Features must-have avant lancement commercial  
**Date** : 13 novembre 2025  
**Statut** : DRAFT - Priorisation en cours

---

## 📊 État des lieux technique (13 nov 2025)

### ✅ Infrastructure existante (réutilisable)

**Backend solide** :
- ✅ Fastify + PostgreSQL + MinIO/S3 fonctionnels
- ✅ Rate limiting + sécurité OWASP configurés
- ✅ Migrations SQL automatiques (CleverCloud)
- ✅ pg-boss queue (background jobs)
- ✅ Tests Node.js native runner configurés

**Smartlink fondations** :
- ✅ Table `episode_links` (cache providers) - migrations 005, 006
- ✅ Route `/podcast/:season/:episode` avec validation
- ✅ Service `castopodRSS.js` (fetch + parse RSS)
- ✅ Service `platformAPIs.js` (Spotify/Apple/Deezer/Podcast Addict)
- ✅ Queue worker `episodeQueue.js` (résolution async)
- ✅ Service `ogImageGenerator.js` (Jimp blur background)
- ✅ Service `s3Service.js` (upload/delete S3)
- ✅ Template `podcast.hbs` (page épisode basique)

**Ce qui fonctionne actuellement** :
- Page `/podcast/:season/:episode` charge
- Fetch RSS Castopod OK (timeout 5s)
- APIs providers testées individuellement
- OG images générées en background (blur effect)
- Cache DB pour éviter requêtes répétées

### ❌ Gaps critiques vs US must-have

**US1.1 - Pré-écoute 60-90s** : ❌ Pas d'extrait audio
- Besoin : Découpe audio automatique (ffmpeg)
- Stockage S3 séparé (`/previews/`)
- Player HTML5 embarqué page

**US1.2 - Page mobile claire** : 🟡 Template basique existe mais incomplet
- Manque : Design mobile-first propre
- Manque : Cibles tactiles ≥ 44px
- Manque : Contrastes AA WCAG

**US1.3 - Preuve sociale OP3** : ✅ Implémentée, activation production à préparer
- ✅ Proxy audio `/api/audio/proxy` tracking OP3 (ADR-0014)
- ✅ Téléchargements OP3 rafraîchis quotidiennement dans PostgreSQL
- ✅ Fenêtres glissantes 7/30 jours calculées en arrière-plan
- ✅ Encart populaire sur `/podcast` et badge historique sur les épisodes
- ✅ Wording exact « téléchargements mesurés par OP3 » et explication accessible
- ✅ Affichage contrôlé par `OP3_PUBLIC_STATS_ENABLED`
- ⛔ Activation bloquée avant rotation des secrets et migration/configuration autorisées

**US2.1 - Choix appli sans redirect auto** : 🟡 Liens existent mais UX à améliorer
- Template affiche boutons providers
- Manque : Hiérarchie visuelle claire

**US2.2 - Mémoriser choix (opt-in)** : ❌ Pas implémenté
- Besoin : Cookie 1st-party opt-in
- Checkbox "Se souvenir"
- Lien "Oublier mon choix"

**US3.1/3.2/3.3 - Dashboard créateur** : ❌ Pas d'interface admin
- Besoin : Route `/admin/episodes` (auth à définir)
- Affichage statuts résolution (✅/⚠️/❌)
- Bouton "Rafraîchir" manuel
- Édition URL + verrou 🔒

**US4.1 - OG tags** : 🟡 Générées mais pas dynamiques
- OG images générées en background ✅
- Manque : Balises og: spécifiques par épisode

**US4.2 - JSON-LD** : ❌ Pas implémenté
- Besoin : Génération schema.org PodcastEpisode

**US5.1/5.2/5.3 - Analytics privacy-first** : ❌ Rien d'implémenté
- Besoin : Table `analytics_events` (vues/clics/pré-écoutes)
- Service `analyticsService.js` (sendBeacon, DNT/GPC respect)
- Dashboard créateur (courbes 7j/30j)
- Intégration OP3 créateur (downloads/jour)

**US7.1/7.2/7.3 - Performance & légal** : 🟡 Partiellement OK
- Cache headers existent ✅
- Vary: User-Agent à vérifier
- Pages Mentions légales/Vie privée : ❌ Manquantes

---

## 🗺️ Roadmap par épopées (priorité MVP)

### 🎯 Épopée 1 — Page épisode & pré-écoute (CRITIQUE)

**Objectif** : Visiteur comprend l'épisode en 2s et peut pré-écouter

**US1.1 - Extrait audio 60-90s** ⭐⭐⭐
- [ ] ADR : Stratégie découpe audio (ffmpeg serverless vs pre-gen)
- [ ] Service `audioClipService.js` (extract 60-90s, fade-out, normalize)
- [ ] Storage S3 `/previews/s{season}e{episode}.webm` (< 500KB)
- [ ] Player HTML5 intégré template (mobile-friendly)
- [ ] Tests : Durée, taille, volume normalisé
- [ ] **Effort** : 2-3 sessions

**US1.2 - Design mobile-first** ⭐⭐
- [ ] Refonte template `podcast.hbs` (TailwindCSS)
- [ ] Cover + titre + durée + date lisibles (hierarchy)
- [ ] Boutons providers ≥ 44px tactile
- [ ] Tests contrastes AA (WCAG 2.1)
- [ ] Preview responsive (iPhone SE → desktop)
- [ ] **Effort** : 1 session

**US1.3 - OP3 preuve sociale** ⭐⭐⭐
- [x] ADR-0014 : Proxy audio pour tracking OP3 ✅
- [x] Proxy `/api/audio/proxy` avec headers X-Forwarded-For ✅
- [x] Documentation trade-offs OP3 (play counts OK, geo = serveur) ✅
- [x] ADR-0015 révisé selon le contrat officiel actuel ✅
- [x] PRD traction podcast et preflight produit/technique/sécurité ✅
- [x] Migration additive `008_op3_rolling_downloads.sql` ✅
- [x] Service validé : fenêtre glissante 7/30, total historique, pagination ✅
- [x] Refresh quotidien dédupliqué sur le singleton `pg-boss` ✅
- [x] `/podcast` : populaire hebdomadaire, fallback historique et fallback éditorial ✅
- [x] Pages épisode : seuil, wording téléchargement et explication accessible ✅
- [x] Tests seuils, fraîcheur, pannes, read-only, singleton et secrets ✅
- [ ] Rotation/révocation OP3 et Spotify avant activation production
- [ ] Migration et variables Clever, uniquement après autorisation explicite
- [ ] Remplissage et inspection read-only du cache avant activation du flag public
- **Référence** : [`prd_traction_podcast_op3.md`](prd_traction_podcast_op3.md)

**Durée totale Épopée 1** : ~4-6 sessions (8-12h)

---

### 🎯 Épopée 2 — Choix appli utilisateur (UX)

**Objectif** : Visiteur choisit son app sans friction

**US2.1 - Boutons providers clairs** ⭐⭐
- [ ] Hiérarchie visuelle (icônes + labels)
- [ ] Ordre dynamique : Castopod → Spotify/Apple/Deezer/Podcast Addict
- [ ] État "Résolution en cours..." pour providers non résolus
- [ ] Tests A11y : Navigation clavier, screen readers
- [ ] **Effort** : 1 session

**US2.2 - Mémoriser choix (opt-in)** ⭐
- [ ] Checkbox "Se souvenir de mon app" (désactivée par défaut)
- [ ] Cookie 1st-party `preferred_app` (30j max)
- [ ] Redirect automatique si cookie présent
- [ ] Lien "Oublier mon choix" footer
- [ ] Tests : Cookie set/unset, expiration
- [ ] **Effort** : 1 session

**Durée totale Épopée 2** : ~2 sessions (4h)

---

### 🎯 Épopée 3 — Résolution providers + Dashboard créateur (CRITIQUE)

**Objectif** : Créateur contrôle les liens résolus

**US3.1 - Voir statuts résolution** ⭐⭐⭐
- [ ] ADR : Auth strategy (sessions vs JWT vs basic auth)
- [ ] Route `/admin/episodes` (protected)
- [ ] Template dashboard : Liste épisodes avec colonnes par provider
- [ ] Badges ✅ (résolu) / ⚠️ (match partiel) / ❌ (non trouvé)
- [ ] Affichage URL + date dernière vérif
- [ ] Boutons "Ouvrir les URLs" (external links)
- [ ] Tests : Auth required, badges corrects
- [ ] **Effort** : 2-3 sessions

**US3.2 - Rafraîchir manuellement** ⭐⭐
- [ ] Bouton "🔄 Rafraîchir" par épisode (ou tous)
- [ ] État "En cours..." (spinner)
- [ ] Cooldown 5 min (anti-spam)
- [ ] Message d'erreur lisible si API KO
- [ ] Re-queue job pg-boss avec priorité haute
- [ ] Tests : Cooldown respecté, job créé
- [ ] **Effort** : 1 session

**US3.3 - Override manuel + verrou** ⭐⭐⭐
- [ ] ADR : Colonnes DB `{provider}_locked BOOLEAN`
- [ ] Champ éditable par provider (input + save)
- [ ] Toggle 🔒 "Verrouiller (ne pas écraser)"
- [ ] Worker respecte verrous (skip si locked=true)
- [ ] Bouton "Retirer verrou & rafraîchir"
- [ ] Tests : Verrou prioritaire sur auto-résolution
- [ ] **Effort** : 2 sessions

**Durée totale Épopée 3** : ~5-6 sessions (10-12h)

---

### 🎯 Épopée 4 — SEO & partages sociaux

**Objectif** : Cartes sociales propres + indexation Google

**US4.1 - OG tags dynamiques** ⭐⭐
- [ ] Balises og:title/description/image par épisode (déjà partiellement OK)
- [ ] Vérifier bots jamais redirigés (Vary: User-Agent)
- [ ] Tests : Validateur Open Graph (LinkedIn/Twitter)
- [ ] **Effort** : 0.5 session (déjà 80% fait)

**US4.2 - JSON-LD PodcastEpisode** ⭐
- [ ] Génération schema.org automatique (template helper)
- [ ] Propriétés : name, datePublished, duration, image, partOfSeries
- [ ] Validation Google Rich Results Test
- [ ] Tests : JSON valide, pas d'erreurs warnings
- [ ] **Effort** : 0.5 session

**Durée totale Épopée 4** : ~1 session (2h)

---

### 🎯 Épopée 5 — Analytics privacy-first (DIFFÉRENCIANT)

**Objectif** : Dashboard créateur type Bit.ly sans tracer users

**US5.1 - Collecte respectueuse** ⭐⭐⭐
- [ ] ADR : Architecture analytics (table events vs logs agrégés)
- [ ] Table `analytics_events` (type, episode_id, timestamp, referrer, device, ip_hash)
- [ ] Service `analyticsService.js` (sendBeacon, DNT/GPC check)
- [ ] Hashing IP + salt quotidien (uniques/jour non corrélables)
- [ ] Opt-out visible "Ne pas me compter" (cookie)
- [ ] Rétention : 30-60j bruts, 12 mois agrégats
- [ ] Tests : DNT=1 → 0 collecte, opt-out OK
- [ ] **Effort** : 2-3 sessions

**US5.2 - Dashboard 7j/30j** ⭐⭐
- [ ] Route `/admin/analytics/:season/:episode`
- [ ] Tuiles : Vues, Pré-écoutes, Clics, Top referrers, Device split
- [ ] Courbe empilée (Chart.js ou Recharts simple)
- [ ] Parts plateformes (Spotify 40%, Apple 30%, etc.)
- [ ] Tests : Agrégats corrects, pas de PII
- [ ] **Effort** : 2 sessions

**US5.3 - OP3 dashboard créateur** ⭐
- [ ] Intégration OP3 API (downloads/jour par épisode)
- [ ] Affichage dans dashboard analytics
- [ ] Mention "downloads ≠ écoutes complètes"
- [ ] Cache 24h (même que US1.3)
- [ ] Tests : Fallback si API KO
- [ ] **Effort** : 0.5 session

**Durée totale Épopée 5** : ~4-5 sessions (8-10h)

---

### 🎯 Épopée 7 — Performance & légal

**Objectif** : LCP < 2.5s + conformité RGPD

**US7.1 - Perf page** ⭐⭐
- [ ] Audit Lighthouse mobile (LCP, FID, CLS)
- [ ] Lazy load images (loading="lazy")
- [ ] CSS/JS minifiés (PostCSS + esbuild)
- [ ] Extrait < 500KB (compression)
- [ ] Tests : WebPageTest budget
- [ ] **Effort** : 1 session

**US7.2 - Cache & bots** ⭐
- [ ] Vérifier Vary: User-Agent, Cookie
- [ ] Tests : curl -A "facebookexternalhit" → HTML complet
- [ ] Pas de 302 pour bots (déjà OK normalement)
- [ ] **Effort** : 0.5 session

**US7.3 - Pages légales** ⭐⭐
- [ ] Page `/mentions-legales` (hébergeur, éditeur)
- [ ] Page `/vie-privee` (DNT/GPC, opt-out, rétention, sous-traitants)
- [ ] Liens footer toutes pages
- [ ] Tests : Pages accessibles, infos complètes
- [ ] **Effort** : 1 session

**Durée totale Épopée 7** : ~2-3 sessions (4-6h)

---

## 📅 Planification MVP (estimation)

### Phase 1 : Fondations critiques (priorité absolue)
- **Épopée 1** (US1.1, US1.2, US1.3) : 8-12h
- **Épopée 3** (US3.1, US3.2, US3.3) : 10-12h
- **Total** : ~20-24h (5-6 jours à mi-temps)

### Phase 2 : UX & Différenciation
- **Épopée 2** (US2.1, US2.2) : 4h
- **Épopée 5** (US5.1, US5.2, US5.3) : 8-10h
- **Total** : ~12-14h (3 jours à mi-temps)

### Phase 3 : SEO & Conformité
- **Épopée 4** (US4.1, US4.2) : 2h
- **Épopée 7** (US7.1, US7.2, US7.3) : 4-6h
- **Total** : ~6-8h (1.5 jour à mi-temps)

**🎯 Total MVP POC : ~40-46h (9-11 jours mi-temps)**

---

## 🚧 Hors scope MVP (post-lancement)

**Multi-tenancy SaaS** (Phase 2 après validation POC) :
- Table `users`, `workspaces`, foreign keys
- Auth (OAuth social vs sessions)
- Onboarding créateur (import RSS)
- Billing Stripe (3€/mois)
- Custom domains/subdomains
- Templates/thèmes personnalisables

**Slug management & routes alternatives** :
- Route `/podcast/trailer/:season?` pour trailers sans numéro
- Route `/podcast/:slug` avec gestion slugs personnalisés
- ADR : Stratégie slug (auto-génération vs manuel)
- Migration colonne `slug` nullable table `episode_links`
- Backoffice éditeur slug par épisode
- Redirects 301 si slug change

**Analytics avancés** :
- Funnel conversion (vue → pré-écoute → clic)
- Heatmaps clics providers
- A/B testing layouts
- Export CSV/API

**Features premium** :
- Retargeting pixels (opt-in)
- Intégrations webhooks (Zapier)
- White-label (remove branding)
- Statistiques temps réel

---

## ✅ Critères de succès POC (Definition of Done)

**Technique** :
- [ ] LCP < 2.5s mobile (Lighthouse)
- [ ] 0 erreurs validation OG/JSON-LD
- [ ] DNT/GPC → 0 collecte (tests automatisés)
- [ ] < 3% épisodes non résolus après J+7
- [ ] Tous tests GREEN (couverture ≥ 70%)

**Fonctionnel** :
- [ ] Visiteur mobile comprend épisode en 2s
- [ ] Pré-écoute démarre < 1s (WebM optimisé)
- [ ] OP3 "X écoutes" visible si ≥ 10
- [ ] Créateur peut override liens manuellement
- [ ] Dashboard analytics 7j/30j opérationnel
- [ ] Opt-out analytics fonctionne

**Business** :
- [ ] 5 créateurs podcast testent (beta)
- [ ] NPS ≥ 8/10 sur facilité partage
- [ ] ≥ 50 clics/semaine vers providers
- [ ] Temps moyen page ≥ 30s (engagement)

---

## 📝 Prochaines actions immédiates

**Session 1 : Épopée 1 - US1.1 Pré-écoute** (CRITIQUE)
1. Rédiger ADR découpe audio (ffmpeg strategy)
2. Implémenter service `audioClipService.js` (TDD)
3. Storage S3 `/previews/`
4. Player HTML5 template

**Session 2 : Épopée 1 - US1.3 OP3 intégration** (DIFFÉRENCIANT)
1. Rédiger ADR OP3 API (authentification, rate limits)
2. Implémenter service `op3Service.js` (TDD)
3. Cache 24h
4. Affichage conditionnel template

**Session 3 : Épopée 3 - US3.1 Dashboard créateur**
1. ADR Auth strategy (basic auth suffisant pour POC?)
2. Route `/admin/episodes` protected
3. Template dashboard statuts résolution

---

## 🎯 Métriques suivi roadmap

| Épopée | US | Priorité | Effort | Status | Tests |
|--------|-------|----------|--------|--------|-------|
| 1 | US1.1 | ⭐⭐⭐ | 2-3 sessions | 🔴 TODO | 0/5 |
| 1 | US1.2 | ⭐⭐ | 1 session | 🔴 TODO | 0/3 |
| 1 | US1.3 | ⭐⭐⭐ | 1-2 sessions | 🔴 TODO | 0/7 |
| 2 | US2.1 | ⭐⭐ | 1 session | 🔴 TODO | 0/4 |
| 2 | US2.2 | ⭐ | 1 session | 🔴 TODO | 0/5 |
| 3 | US3.1 | ⭐⭐⭐ | 2-3 sessions | 🔴 TODO | 0/6 |
| 3 | US3.2 | ⭐⭐ | 1 session | 🔴 TODO | 0/4 |
| 3 | US3.3 | ⭐⭐⭐ | 2 sessions | 🔴 TODO | 0/6 |
| 4 | US4.1 | ⭐⭐ | 0.5 session | 🟡 80% | 2/3 |
| 4 | US4.2 | ⭐ | 0.5 session | 🔴 TODO | 0/2 |
| 5 | US5.1 | ⭐⭐⭐ | 2-3 sessions | 🔴 TODO | 0/8 |
| 5 | US5.2 | ⭐⭐ | 2 sessions | 🔴 TODO | 0/5 |
| 5 | US5.3 | ⭐ | 0.5 session | 🔴 TODO | 0/3 |
| 7 | US7.1 | ⭐⭐ | 1 session | 🔴 TODO | 0/4 |
| 7 | US7.2 | ⭐ | 0.5 session | 🟡 50% | 1/2 |
| 7 | US7.3 | ⭐⭐ | 1 session | 🔴 TODO | 0/3 |

**Légende** : 🔴 TODO | 🟡 En cours | 🟢 Fait

---

**Note TDD** : Chaque US suit **RED → GREEN → REFACTOR** strict (cycles ≤ 10 min)  
**Note sécurité** : Chaque feature inclut 1-2 tests OWASP pertinents (A01, A03, A05, A07)  
**Note documentation** : ADR minimal obligatoire avant toute implémentation nouvelle
