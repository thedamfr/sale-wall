# ADR-0010: Mise en avant épisode podcast via paramètre URL

**Date**: 2025-10-29  
**Statut**: ✅ VALIDÉ (prêt implémentation TDD)  
**Contexte**: Feature marketing smartlink podcast

---

## Contexte

**Besoin business**: Partager un lien direct vers un épisode spécifique du podcast "Charbon & Wafer" pour :
- Campagnes réseaux sociaux ciblées par épisode
- Prévisualisation enrichie (Open Graph meta dynamiques)
- Améliorer taux de conversion écoute vs smartlink générique

**Contraintes techniques**:
- Route `/podcast` actuelle = fichier HTML statique (`server/views/podcast.html`)
- Stack: Fastify + PostgreSQL (pool configuré) + Cloudflare CDN proxy actif
- RSS Castopod disponible : `https://podcasts.saletesincere.fr/@charbonwafer/feed.xml`
- Pas d'auth requise (lecture publique)
- Performance critique : ~500ms max cold start acceptable

**Contraintes sécurité**:
- OWASP A03 (Injection) : Validation stricte params URL
- OWASP A05 (Misconfiguration) : Timeout fetch RSS, pas de SSRF
- OWASP A10 (SSRF) : URL RSS hardcodée uniquement

---

## Décision

### Architecture retenue: **SSR Fastify + fetch RSS Castopod direct**

**URL pattern**:
```
GET /podcast?season=1&episode=2
```

**Flux de données** (3 niveaux cache):
```
Request 
  → Cloudflare Edge cache (HIT: <50ms, TTL 1h)
  → [MISS] Fastify route handler
  → Fetch RSS Castopod (timeout 5s)
  → Parse XML (fast-xml-parser)
  → Match saison/épisode
  → Render template Handlebars enrichi
  → Response HTML (Cache-Control: s-maxage=3600)
  → Cloudflare cache stocke
```

**Fallback gracieux**: RSS timeout/erreur → page classique (liens plateformes uniquement), pas d'erreur 500.

---

## Alternatives considérées et écartées

### ❌ Option A: Cache PostgreSQL failover

**Proposition**: Persister épisodes RSS dans table `podcast_episodes_cache` comme backup.

**Pourquoi rejetée**:
1. **Cloudflare Edge cache suffit** ✅
   - Cache CDN global (multi-région) > cache BDD local
   - Performance Edge < 50ms vs BDD locale ~100ms
   - Gratuit (plan existant) vs cycles CPU/stockage BDD
   - Invalidation API Cloudflare disponible

2. **Complexité évitée** ✅
   - Pas de table SQL supplémentaire
   - Pas de logique upsert/staleness (7 jours TTL à gérer)
   - Pas de migration `007_podcast_episodes_cache.sql`
   - **Dette technique minimale**: 1 route + 1 parser RSS (~150 lignes)

3. **RSS = Source de vérité unique** ✅
   - Castopod RSS toujours à jour (metadata épisodes)
   - Pas de sync manuel entre BDD locale et RSS distant
   - Invalidation automatique (changement RSS = nouveau hash cache)

4. **Résilience acceptable** ✅
   - Timeout RSS 5s → fallback page classique (pas de 500)
   - Cloudflare absorbe 99% du trafic après 1er hit (cold start rare)
   - En cas d'indisponibilité Castopod prolongée : smartlink classique reste fonctionnel

**Trade-off accepté**:
- ❌ Cold start post-expiration cache = latence ~500ms (fetch RSS + parse XML)
- ✅ Mais : Cold start rare (<1% requêtes si TTL 1h bien configuré)
- ✅ **Principe YAGNI** : Pas de sur-ingénierie tant que Castopod stable

**Déclencheur réouverture** : Si monitoring montre >10% timeout RSS → reconsidérer cache BDD.

---

### ❌ Option B: Client-side JavaScript fetch RSS

**Proposition**: Garder fichier HTML statique + fetch RSS côté client (AJAX).

**Pourquoi rejetée**:
1. **Meta OG non crawlables** ❌
   - Facebook/Twitter/LinkedIn crawlers n'exécutent pas JS
   - Prévisualisation partage social = page vide
   - Perte objectif business (partage enrichi)

2. **SEO impacté** ❌
   - Contenu épisode non indexable (Google JS rendering limité)
   - Pas de rich snippets possibles

3. **CORS complexe** ❌
   - Nécessite config Castopod `Access-Control-Allow-Origin`
   - Dépendance configuration externe

4. **Performance variable** ❌
   - Latence réseau client (3G/4G) vs cache Edge constant
   - Pas de cache navigateur possible (CORS + fetch dynamique)

---

### ℹ️ Option C: API JSON Castopod (À INVESTIGUER)

**Proposition**: Utiliser `/api/episodes/{season}/{episode}` si disponible (JSON > XML parsing).

**Statut**: **TODO avant implémentation** (Phase 0 TDD)
- Consulter doc Castopod API : https://docs.castopod.org/
- Tester endpoint : `curl https://podcasts.saletesincere.fr/api/episodes/1/1`
- **Si JSON disponible** : Parse < 50ms vs XML ~200ms
- **Si non** : RSS XML standard suffisant

---

## Conséquences

### ✅ Bénéfices

**Performance**:
- Cache Cloudflare Edge global (multi-région) < 50ms (99% requêtes)
- Cold start acceptable ~500ms (fetch RSS + parse XML)
- Pas de cycles BDD consommés (pool PostgreSQL préservé)

**Simplicité**:
- **Zéro duplication données** : RSS = Single Source of Truth
- **Maintenance nulle** : Nouveaux épisodes automatiquement disponibles
- **Dette technique minimale** : +1 route + +1 service (~150 lignes total)

**Sécurité**:
- Validation stricte params (`/^\d+$/`)
- Timeout fetch RSS (pas de DOS)
- URL RSS hardcodée (pas de SSRF)
- Handlebars auto-escape XSS

**SEO/Marketing**:
- Meta OG dynamiques crawlables (partages sociaux)
- Rich snippets possibles (structured data future)

### ❌ Coûts/Risques

**Performance**:
- Cold start ~500ms post-expiration cache (acceptable si <1% requêtes)
- Latence réseau Fastify → Castopod variable (CleverCloud → Castopod hosting)

**Disponibilité**:
- **Dépendance externe Castopod** : Indisponible = fallback page classique
- Pas de backup local (assumé : Castopod stable)

**Monitoring requis**:
- Alertes si taux timeout RSS >5% (Sentry/logs Fastify)
- Métriques Cloudflare cache hit rate (objectif >95%)

### ⚠️ Dette technique identifiée

**Court terme** (MVP suffisant):
- Solution SSR actuelle OK si Castopod stable
- Pas de cache BDD tant que <5% timeout RSS

**Moyen terme** (trigger réouverture ADR):
- **Si monitoring montre >10% timeout RSS** → Ajouter cache BDD failover
- **Si latence cold start >1s fréquente** → Investiguer cache PostgreSQL
- **Si traffic >10k req/jour** → Envisager cache Redis (overkill actuellement)

---

## Critères d'acceptation (Given/When/Then)

### Test 1: Affichage épisode valide
- **Given**: URL `/podcast?season=1&episode=2` ET RSS Castopod répond S1E2
- **When**: Page chargée (cache miss Cloudflare)
- **Then**: 
  - HTML contient `<h2>Titre épisode S1E2</h2>`
  - Badge "Saison 1 • Épisode 2" visible
  - Meta OG `<meta property="og:title" content="S1E2 - Titre | Charbon & Wafer">`
  - Header `Cache-Control: public, max-age=3600, s-maxage=3600`

### Test 2: Validation params invalides
- **Given**: URL `/podcast?season=abc&episode=2`
- **When**: Route handler valide params
- **Then**: 
  - Response 200 (pas 400, fallback gracieux)
  - HTML = page classique (liens plateformes uniquement)
  - Log warning Fastify (production silencieux)

### Test 3: Fallback timeout RSS
- **Given**: URL `/podcast?season=1&episode=1` ET Castopod timeout >5s
- **When**: Route handler timeout AbortController
- **Then**: 
  - Response 200 après 5s max (pas blocage)
  - HTML = page classique
  - Log warning Fastify
  - Header `Cache-Control: public, max-age=300` (5min cache erreur)

### Test 4: Épisode introuvable RSS
- **Given**: URL `/podcast?season=99&episode=99` ET épisode absent RSS
- **When**: Parse RSS terminé, aucun match
- **Then**: 
  - HTML = page classique
  - Log info "Episode S99E99 not found"

### Test 5: Cache Cloudflare actif
- **Given**: Request `/podcast?season=1&episode=1` (2e fois, cache hit)
- **When**: Cloudflare Edge cache actif
- **Then**: 
  - Response header `CF-Cache-Status: HIT`
  - Temps réponse < 50ms (vs ~500ms 1ère fois)
  - Pas de fetch RSS (économie bandwidth)

### Test 6: Sécurité XSS
- **Given**: URL `/podcast?season=1&episode=<script>alert(1)</script>`
- **When**: Validation params regex
- **Then**: 
  - Params rejetés (regex `/^\d+$/` fail)
  - Pas d'exécution script
  - Page classique affichée

---

## Interfaces publiques

### Route Fastify
```javascript
app.get('/podcast', {
  config: { rateLimit: pageLimiter }
}, async (request, reply) => {
  const { season, episode } = request.query
  
  // Validation stricte (OWASP A03)
  if (season && episode && /^\d+$/.test(season) && /^\d+$/.test(episode)) {
    try {
      const episodeData = await fetchEpisodeFromRSS(
        parseInt(season), 
        parseInt(episode), 
        5000 // timeout ms
      )
      
      if (episodeData) {
        reply.header('Cache-Control', 'public, max-age=3600, s-maxage=3600')
        return reply.view('podcast-episode.hbs', { episodeData })
      }
    } catch (err) {
      request.log.warn('RSS fetch failed, rendering classic page')
    }
  }
  
  // Fallback: page classique
  reply.header('Cache-Control', 'public, max-age=3600')
  return reply.sendFile('podcast.html', path.join(__dirname, 'server/views'))
})
```

### Service RSS Parser
```javascript
// server/services/castopodRSS.js

/**
 * Fetch episode metadata from Castopod RSS feed
 * @param {number} season - Season number (1-based)
 * @param {number} episode - Episode number (1-based)
 * @param {number} timeout - Fetch timeout in ms (default 5000)
 * @returns {Promise<EpisodeData|null>} Episode data or null if not found
 * @throws {Error} On network timeout or parse error
 */
export async function fetchEpisodeFromRSS(season, episode, timeout = 5000) {
  // Implementation details...
}

/**
 * @typedef {Object} EpisodeData
 * @property {number} season - Season number
 * @property {number} episode - Episode number
 * @property {string} title - Episode title
 * @property {string} description - Episode summary (plain text)
 * @property {string} pubDate - Formatted date "15 janvier 2025"
 * @property {string} duration - Formatted duration "45:30"
 * @property {string|null} image - Episode cover URL or null
 * @property {string} audioUrl - MP3 direct link
 */
```

### Template Handlebars
```handlebars
{{!-- server/views/podcast-episode.hbs --}}
{{#if episodeData}}
<div class="mb-8 bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-2xl p-6 border border-purple-600/30">
  <div class="text-purple-400 text-sm uppercase mb-2">
    Saison {{episodeData.season}} • Épisode {{episodeData.episode}}
  </div>
  <h2 class="text-2xl font-bold text-white mb-3">{{episodeData.title}}</h2>
  <p class="text-gray-300 mb-4">{{episodeData.description}}</p>
  <div class="flex gap-4 text-sm text-gray-400">
    <span>📅 {{episodeData.pubDate}}</span>
    <span>⏱️ {{episodeData.duration}}</span>
  </div>
</div>
{{/if}}

{{!-- Existing platform links --}}
<div class="space-y-3">
  <!-- Apple Podcasts, Spotify, etc. -->
</div>
```

---

## Risques OWASP ciblés

### A03 - Injection (XSS)
**Vecteur** : Params URL `season`/`episode` injectés dans HTML.

**Mesures** :
```javascript
// ✅ Validation stricte whitelist (digits uniquement)
const seasonRegex = /^\d+$/
const episodeRegex = /^\d+$/
if (!seasonRegex.test(season)) return renderClassicPage()

// ✅ Handlebars auto-escape par défaut
{{episodeData.title}} // Safe (échappement automatique)
{{{episodeData.title}}} // ❌ À éviter (pas d'échappement)
```

**Tests sécurité** :
- Payload XSS : `?season=1&episode=<script>alert(1)</script>` → Rejeté
- Payload SQL : `?season=1' OR '1'='1` → Rejeté (pas de SQL, juste parseInt)

### A05 - Security Misconfiguration
**Vecteur** : Timeout RSS infini → DOS, headers cache absents.

**Mesures** :
```javascript
// ✅ Timeout fetch strict (évite slow loris)
const controller = new AbortController()
setTimeout(() => controller.abort(), 5000)
fetch(RSS_URL, { signal: controller.signal })

// ✅ Headers sécurisés (déjà configurés via setupSecurityHeaders)
// ✅ Rate limiting actif (pageLimiter: 60 req/min)

// ✅ Cache headers explicites
reply.header('Cache-Control', 'public, max-age=3600, s-maxage=3600')
reply.header('X-Content-Type-Options', 'nosniff')
```

### A10 - SSRF (Server-Side Request Forgery)
**Vecteur** : Manipulation URL RSS vers intranet/localhost.

**Mesures** :
```javascript
// ✅ URL RSS hardcodée (pas de param utilisateur)
const RSS_URL = 'https://podcasts.saletesincere.fr/@charbonwafer/feed.xml'

// ✅ Pas de suivi redirections (évite rebond vers intranet)
fetch(RSS_URL, { redirect: 'manual' })

// ✅ Timeout strict (pas de connexions infinies)
// ✅ Pas de résolution DNS custom (utilise Node.js par défaut)
```

---

## Performance & Monitoring

### Métriques cibles (SLO)

| Métrique | Objectif | Critique si |
|----------|----------|-------------|
| Cache hit rate Cloudflare | >95% | <90% |
| Latence cold start (fetch RSS) | <500ms | >1s |
| Timeout rate RSS | <5% | >10% |
| Disponibilité endpoint | >99.5% | <99% |

### Monitoring requis

**Logs Fastify** (déjà actifs) :
```javascript
request.log.warn('RSS fetch timeout, fallback to classic page', { season, episode })
request.log.error('RSS parse error', { error: err.message })
```

**Alertes Sentry** (si configuré) :
- Error rate `/podcast` >1%
- Timeout rate RSS >5%

**Cloudflare Analytics** (dashboard) :
- Cache hit rate par route `/podcast*`
- Bandwidth économisé via cache

---

## Stack technique

**Dépendances ajoutées** :
```json
{
  "dependencies": {
    "fast-xml-parser": "^4.3.2"
  }
}
```

**Parser XML choisi** : `fast-xml-parser`
- **Performance** : ~200ms parse RSS complet (<500 épisodes)
- **Taille** : 50KB (vs xml2js 200KB)
- **Support iTunes namespace** : Natif

---

## Plan d'implémentation TDD

### Pré-requis STOP (Phase 0)

Avant d'écrire 1 ligne de code :

- [ ] **Tester RSS Castopod structure** :
  ```bash
  curl https://podcasts.saletesincere.fr/@charbonwafer/feed.xml | head -200
  ```
  → Confirmer présence `<itunes:season>`, `<itunes:episode>`, `<itunes:duration>`

- [ ] **Vérifier API JSON Castopod** :
  ```bash
  curl https://podcasts.saletesincere.fr/api/episodes/1/1
  ```
  → Si 200 OK : préférer JSON, sinon XML OK

- [ ] **Consulter ADRs existants** : `documentation/adr_*.md` (aucun conflit attendu)

- [ ] **Lire audits sécurité** : `security/reports/audit_*.md` (OWASP A03, A05, A10)

- [ ] **Mettre à jour `todolist.md`** : Ajouter tâche "Podcast episode highlight"

### Phases TDD (cycles ≤10 min)

#### Phase 1: Service RSS Parser (RED → GREEN → REFACTOR)

**RED 1**: Test parser RSS trouve épisode S1E1
```javascript
// test/services/castopodRSS.test.js
test('should parse episode S1E1 from RSS', async () => {
  const episode = await fetchEpisodeFromRSS(1, 1)
  expect(episode).toBeTruthy()
  expect(episode.season).toBe(1)
  expect(episode.episode).toBe(1)
  expect(episode.title).toBeTruthy()
})
```

**GREEN 1**: Parser XML basique avec `fast-xml-parser`

**REFACTOR 1**: Extraire logique match saison/épisode

**RED 2**: Test timeout fetch RSS (5s)

**GREEN 2**: Ajouter `AbortController`

**PAUSE STATE 1**:
- Tests: 4 verts (parser + timeout + validation + not found)
- Fichiers: `server/services/castopodRSS.js` créé
- TODO: Intégrer service dans route `/podcast`
- Commit: `feat(podcast): add RSS parser service with timeout`

#### Phase 2: Route dynamique (RED → GREEN → REFACTOR)

**RED 3**: Test route avec params valides → encart visible

**GREEN 3**: Intégrer parser RSS dans route handler

**REFACTOR 3**: Extraire template Handlebars

**RED 4**: Test fallback timeout → page classique

**GREEN 4**: Gestion erreurs gracieuse

**PAUSE STATE 2**:
- Tests: 8 verts (service + route + fallback + validation)
- Fichiers: `server.js` modifié, `server/views/podcast-episode.hbs` créé
- TODO: Ajouter meta OG dynamiques
- Commit: `feat(podcast): add episode highlight route`

#### Phase 3: Meta OG + Cache (RED → GREEN)

**RED 5**: Test meta OG titre dynamique crawlable

**GREEN 5**: Template meta OG conditionnels

**RED 6**: Test header `Cache-Control` présent

**GREEN 6**: Ajouter headers cache

**PAUSE STATE 3**:
- Tests: 10 verts (feature complète)
- TODO: Documentation `README.md`
- Commit: `feat(podcast): add dynamic OG meta and cache headers`

#### Phase 4: Documentation (pas de tests)

- [ ] Mettre à jour `readme.md` : Section "Partage épisode podcast"
- [ ] Mettre à jour `todolist.md` : Marquer tâche terminée
- [ ] Commit: `docs(podcast): document episode highlight feature`

---

## Références

**Documentation externe** :
- Castopod RSS spec : https://docs.castopod.org/
- iTunes podcast namespace : https://github.com/Podcast-Standards-Project/PSP-1-Podcast-RSS-Specification
- Cloudflare cache control : https://developers.cloudflare.com/cache/

**ADRs projet liés** :
- Aucun conflit identifié (première feature podcast dynamique)

**Audits sécurité référencés** :
- `security/reports/audit_owasp_a03.md` (validation entrées)
- `security/reports/audit_owasp_a05.md` (timeouts)

---

## Validation finale

**Checklist avant implémentation** :
- [x] ADR rédigé et structuré
- [x] Alternatives considérées (cache BDD écartée)
- [x] Risques OWASP identifiés (A03, A05, A10)
- [x] Critères d'acceptation écrits (6 tests)
- [x] Interfaces publiques définies
- [x] Monitoring plan défini
- [ ] **ACTION REQUISE** : Tester RSS Castopod structure (Phase 0)
- [ ] **ACTION REQUISE** : Vérifier API JSON Castopod (Phase 0)

---

**Prochain cycle TDD** : Phase 0 (investigation RSS structure) → Phase 1 (RED service parser)
