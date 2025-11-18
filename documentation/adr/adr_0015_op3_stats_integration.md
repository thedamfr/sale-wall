# ADR-0015: Intégration Stats OP3 pour Preuve Sociale

**Date**: 18 novembre 2025  
**Statut**: ✅ Décision prise (API validée)  
**Décideurs**: @thedamfr  
**Tags**: `op3`, `analytics`, `stats`, `social-proof`, `api`

---

## Contexte

### Besoin métier : Preuve sociale (US1.3)

**Objectif** : Afficher nombre d'écoutes OP3 sur page épisode
- "🎧 **1 234 écoutes** ces 7 derniers jours"
- Augmenter conversion (crédibilité du contenu)
- Transparent sur méthode de comptage (infobulle OP3)

**Contraintes** :
- Masquer si < 10 écoutes (éviter effet "podcast vide")
- Cache 24h (éviter rate limiting OP3)
- Fallback gracieux si API OP3 down
- Performance : < 100ms latence ajoutée page load

### Infrastructure existante

**Proxy audio déjà en place** (ADR-0014) :
- ✅ Endpoint `/api/audio/proxy` avec tracking OP3
- ✅ Headers `X-Forwarded-For` + `X-Real-IP` envoyés
- ✅ Play counts OP3 préservés (1 user = 1 play)
- ⚠️ Geo stats = serveur IP (pas whitelisté OP3)

**Services distincts** :
- `platformAPIs.js` : Résolution URLs écoute (Spotify/Apple/Deezer)
  - Cycle : 1× résolution → cache DB → fini
  - Table : `episode_links` (URLs stables)
- `op3Service.js` (nouveau) : Métriques d'écoute
  - Cycle : Fetch → cache 24h → re-fetch continu
  - Table : `op3_stats` (métriques + timestamp)

---

## Phase exploratoire

### 🔍 Option 1 : OP3 Public API (préféré si existe)

**Hypothèse** : OP3 expose API publique pour stats podcast

**À investiguer** :
- [ ] Documentation OP3 API : https://op3.dev/api/docs (si existe)
- [ ] Endpoints stats publiques : `/api/v1/shows/{show_id}/stats` ?
- [ ] Auth required : API key, OAuth, ou accès public ?
- [ ] Rate limits : Requêtes/jour, cache recommandé ?
- [ ] Granularité : Stats par épisode ou seulement show global ?
- [ ] Données disponibles : Downloads, plays, unique listeners ?
- [ ] Période : 7d, 30d, all-time ?

**Avantages** :
- ✅ Officiel, stable, maintenable
- ✅ Pas de parsing HTML fragile
- ✅ Respect ToS OP3

**Inconvénients** :
- ❌ Peut nécessiter auth (API key à gérer)
- ❌ Rate limits potentiels

**Test exploratoire** :
```bash
# Tester si API publique existe
curl -I https://op3.dev/api/v1/
curl https://op3.dev/api/docs

# Tester avec URL audio OP3 connue
curl "https://op3.dev/api/stats?url=https://op3.dev/e,pg=..."
```

---

### 🔍 Option 2 : Scraping OP3 Dashboard (fallback)

**Hypothèse** : Pas d'API → parser page stats OP3

**À investiguer** :
- [ ] OP3 dashboard public : `https://op3.dev/show/{show_id}` ?
- [ ] Structure HTML : Classes CSS stables ?
- [ ] JavaScript rendering : SSR ou client-side ?
- [ ] Besoin authentification : Compte OP3 créateur ?
- [ ] Fréquence acceptable : ToS permet scraping ?

**Avantages** :
- ✅ Fonctionne si pas d'API
- ✅ Données visuelles = données disponibles

**Inconvénients** :
- ❌ Fragile (changements HTML cassent parsing)
- ❌ Potentiel violation ToS
- ❌ Rate limiting agressif probable
- ❌ Besoin auth si dashboard privé

**Test exploratoire** :
```bash
# Tester accès dashboard
curl -L https://op3.dev/show/castopod-show-id

# Vérifier si JavaScript rendering
curl -L https://op3.dev/show/... | grep "downloads"
```

---

### 🔍 Option 3 : RSS Podcast Namespace (alternatif)

**Hypothèse** : Stats exposées via `<podcast:valueTimeSplit>` ou tags custom

**À investiguer** :
- [ ] Castopod supporte Podcast Namespace 2.0 ?
- [ ] OP3 injecte stats dans RSS feed ?
- [ ] Tag `<podcast:value>` ou custom `<op3:stats>` ?
- [ ] Données : Downloads ou plays ?

**Avantages** :
- ✅ Déjà parsé (service `castopodRSS.js` existe)
- ✅ Pas de requête API supplémentaire
- ✅ Pas de cache séparé (RSS cache existant)

**Inconvénients** :
- ❌ Dépend support Castopod + OP3
- ❌ Freshness = RSS TTL (peut être > 24h)

**Test exploratoire** :
```bash
# Parser RSS actuel
curl https://podcasts.saletesincere.fr/feed.xml | grep -i "podcast:" | head -20
curl https://podcasts.saletesincere.fr/feed.xml | grep -i "op3"
```

---

### 🔍 Option 4 : OP3 Email Reports (manuel)

**Hypothèse** : OP3 envoie rapports email → extraction manuelle

**À investiguer** :
- [ ] OP3 envoie rapports hebdo/mensuels ?
- [ ] Format : HTML, CSV, JSON ?
- [ ] Automatisable : Webhook, IMAP parsing ?

**Avantages** :
- ✅ Données officielles OP3

**Inconvénients** :
- ❌ Pas temps réel
- ❌ Complexité parsing email
- ❌ Pas scalable

**Rejeté** : Trop manuel, pas adapté US1.3

---

## Décision

### ✅ Option 1 retenue : OP3 Public API

**Résultats exploration (Sprint 0)** :
- ✅ API publique existe : https://op3.dev/api/docs
- ✅ Auth : Bearer token (OP3_API_TOKEN dans .env)
- ✅ Endpoint validé : `/api/1/queries/episode-download-counts?showUuid={uuid}`
- ✅ Granularité : Par épisode (itemGuid)
- ✅ Données : `downloads1`, `downloads3`, `downloads7`, `downloads30`, `downloadsAll`
- ✅ Latence : ~340ms (acceptable pour cache 24h)
- ✅ Rate limits : Non restrictifs (testé 3 req/s OK)

**Architecture finale** :

```javascript
// 1. Lookup show UUID depuis GUID au boot
const showInfo = await fetch(`https://op3.dev/api/1/shows/${OP3_GUID}`, {
  headers: { 'Authorization': `Bearer ${OP3_API_TOKEN}` }
});
const { showUuid } = await showInfo.json();
// Cache en mémoire (1× au démarrage)

// 2. Fetch episode stats (quotidien via cron ou lazy loading)
const res = await fetch(
  `https://op3.dev/api/1/queries/episode-download-counts?showUuid=${showUuid}`,
  { headers: { 'Authorization': `Bearer ${OP3_API_TOKEN}` } }
);
const { episodes } = await res.json();

// 3. Stocker en BDD (cache 24h)
for (const ep of episodes) {
  await db.query(`
    INSERT INTO op3_stats (item_guid, downloads_all, downloads_30, fetched_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (item_guid) DO UPDATE
    SET downloads_all = $2, downloads_30 = $3, fetched_at = NOW()
  `, [ep.itemGuid, ep.downloadsAll, ep.downloads30]);
}
```

**Affichage UI** :
- Badge : "🎧 **{downloadsAll} écoutes**" (all-time)
- Condition : Affiché si `downloadsAll >= 10`
- Stocké aussi : `downloads30` (future feature trending)
- Infobulle : "Comptage OP3 (méthode IAB certifiée)"

**Variables .env** :
```bash
OP3_API_TOKEN=8P8Q59LPDLqUYLUxmybmetkSwmfHzUAK1ZKsRrBnwHbx
OP3_GUID=bb74e9c5-20e5-5226-8491-d512ad8ebe04
```

---

## Phase exploratoire (complétée)

### Critères de décision

**Must-have** :
1. Données par épisode (pas seulement show global)
2. Freshness < 24h (cache acceptable)
3. Fallback gracieux si API down
4. Respect ToS OP3

**Nice-to-have** :
1. Unique listeners (pas seulement downloads)
2. Période configurable (7d/30d/all-time)
3. Pas d'auth requise (public)

### Architecture cible (provisoire)

```javascript
// server/services/op3Service.js

/**
 * Fetch OP3 stats pour un épisode
 * @param {string} audioUrl - URL audio OP3 (ex: https://op3.dev/e,pg=.../episode.mp3)
 * @param {object} options - { period: '7d', forceRefresh: false }
 * @returns {Promise<{ downloads: number, period: string, cached: boolean }>}
 */
export async function getEpisodeStats(audioUrl, options = {}) {
  const { period = '7d', forceRefresh = false } = options;
  
  // 1. Check cache (< 24h)
  if (!forceRefresh) {
    const cached = await getOP3StatsFromCache(audioUrl, period);
    if (cached && !isStale(cached, 24 * 60 * 60 * 1000)) {
      return { ...cached, cached: true };
    }
  }
  
  // 2. Fetch OP3 (méthode déterminée après exploration)
  let stats;
  try {
    stats = await fetchOP3StatsViaAPI(audioUrl, period); // Option 1
  } catch (err) {
    console.warn('OP3 API failed, trying fallback', err);
    stats = await fetchOP3StatsViaScraping(audioUrl, period); // Option 2
  }
  
  // 3. Cache result
  await cacheOP3Stats(audioUrl, period, stats);
  
  return { ...stats, cached: false };
}

/**
 * Format stats pour affichage UI
 * @param {number} downloads - Nombre d'écoutes
 * @returns {string|null} - "1.2k écoutes" ou null si < 10
 */
export function formatStatsForDisplay(downloads) {
  if (!downloads || downloads < 10) return null;
  
  if (downloads >= 1000) {
    return `${(downloads / 1000).toFixed(1)}k écoutes`;
  }
  return `${downloads} écoutes`;
}
```

**Table SQL** (schema final) :
```sql
-- Migration 007_op3_stats.sql
CREATE TABLE IF NOT EXISTS op3_stats (
  item_guid TEXT PRIMARY KEY,  -- itemGuid from RSS (clé unique)
  downloads_all INTEGER NOT NULL,  -- Affichage UI
  downloads_30 INTEGER,  -- Future feature trending
  fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_op3_stats_fetched ON op3_stats(fetched_at);
```

**Route API** (optionnel, pour dashboard créateur) :
```javascript
// GET /api/episodes/:season/:episode/stats
app.get('/api/episodes/:season/:episode/stats', async (request, reply) => {
  const { season, episode } = request.params;
  
  // 1. Get episode from RSS
  const episodeData = await getEpisodeFromRSS(season, episode);
  if (!episodeData) return reply.code(404).send({ error: 'Episode not found' });
  
  // 2. Fetch OP3 stats
  const stats = await getEpisodeStats(episodeData.audioUrl);
  
  return {
    season,
    episode,
    stats: {
      downloads: stats.downloads,
      period: stats.period,
      displayText: formatStatsForDisplay(stats.downloads),
      cached: stats.cached,
      updatedAt: stats.fetchedAt
    }
  };
});
```

**Template integration** (`podcast.hbs`) :
```handlebars
{{#if episodeStats}}
  {{#if episodeStats.displayText}}
    <div class="flex items-center gap-2 text-gray-400 text-sm mb-4">
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
      </svg>
      <span>{{episodeStats.displayText}}</span>
      <button 
        class="text-purple-400 hover:text-purple-300 transition-colors"
        title="Nombre d'écoutes suivies par OP3 (Open Podcast Prefix Project) sur les 7 derniers jours. Compte les téléchargements d'épisode, pas nécessairement les écoutes complètes."
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
        </svg>
      </button>
    </div>
  {{/if}}
{{/if}}
```

---

## Tâches phase exploratoire

### 🔍 Sprint 0 : Investigation (1-2h) ✅ TERMINÉ

- [x] Tester OP3 API docs : https://op3.dev/api/docs
- [x] Valider auth bearer token
- [x] Lookup show UUID depuis GUID : `206968ed9aeb4449beef992c4f84e8d0`
- [x] Test endpoint `/queries/episode-download-counts`
- [x] Analyser structure données : `downloads1/3/7/30/All`
- [x] Mesurer latence API : ~340ms (acceptable)
- [x] Vérifier rate limits : Non restrictifs
- [x] **Résultat** : 8 épisodes, 128 max downloads, API stable ✅

- [ ] **Task 1** : Tester API OP3 publique
  - Curl endpoints potentiels
  - Lire docs si disponibles
  - Vérifier auth requirements
  - **Livrable** : Script `scripts/test-op3-api.js` avec résultats

- [ ] **Task 2** : Tester scraping OP3 dashboard
  - Identifier URL show dashboard
  - Parser HTML structure
  - Vérifier JavaScript rendering
  - **Livrable** : Script `scripts/test-op3-scraping.js`

- [ ] **Task 3** : Analyser RSS Castopod
  - Chercher tags `<podcast:*>` ou custom
  - Vérifier support Podcast Namespace 2.0
  - **Livrable** : Extrait RSS avec tags pertinents

- [ ] **Task 4** : Décision architecture
  - Choisir option principale + fallback
  - Valider schéma SQL
  - Définir endpoints API
  - **Livrable** : Update ADR-0015 avec décision finale

### 📝 Sprint 1 : Implémentation (2-3h)

- [ ] Migration SQL `007_op3_stats.sql`
- [ ] Service `server/services/op3Service.js`
- [ ] Tests unitaires fetch + cache + format
- [ ] Intégration route `/api/episodes/:s/:e/stats`
- [ ] Update template `podcast.hbs` avec stats UI
- [ ] Tests E2E : affichage conditionnel, fallback

### 🧪 Sprint 2 : Tests & monitoring (1h)

- [ ] Tests edge cases : < 10 écoutes, API down, cache stale
- [ ] Logs monitoring : OP3 API errors, rate limiting
- [ ] Performance : Latence page load < 100ms ajoutée
- [ ] Documentation : README + API specs

**Durée totale estimée** : 4-6h (US1.3 complète)

---

## Risques OWASP

### A03 - Injection
- ✅ URL audio déjà validée (whitelist domains ADR-0014)
- ✅ SQL queries paramétrées (PostgreSQL)

### A05 - Security Misconfiguration
- ⚠️ API key OP3 si required : Variable env `OP3_API_KEY`
- ✅ Pas d'exposition credentials côté client

### A07 - Identification Failures
- ✅ Pas d'auth user (stats publiques)
- ⚠️ Rate limiting si scraping (respecter robots.txt)

---

## Critères d'acceptation

**Given** : Épisode avec ≥ 10 écoutes OP3 (7 derniers jours)  
**When** : Chargement page `/podcast/:season/:episode`  
**Then** :
- Badge "🎧 X écoutes" affiché sous titre épisode
- Nombre formaté : "1.2k" si ≥ 1000, sinon "234"
- Infobulle explicative au survol icône info
- Cache DB utilisé (pas de requête OP3 si < 24h)

**Given** : Épisode avec < 10 écoutes  
**When** : Chargement page  
**Then** :
- Badge **non affiché** (pas de preuve sociale négative)

**Given** : API OP3 down ou timeout  
**When** : Fetch stats  
**Then** :
- Fallback silencieux (pas d'affichage stats)
- Log warning serveur
- Pas d'erreur UI visible utilisateur

**Given** : Cache stale (> 24h)  
**When** : Fetch stats  
**Then** :
- Requête OP3 effectuée
- Cache mis à jour avec nouveau timestamp
- Réponse utilisateur < 200ms (async background update acceptable)

---

## Interfaces publiques

**Service API** :
```typescript
interface OP3Stats {
  downloads: number;
  period: '7d' | '30d' | 'all';
  cached: boolean;
  fetchedAt: Date;
}

interface OP3Service {
  getEpisodeStats(audioUrl: string, options?: {
    period?: '7d' | '30d' | 'all';
    forceRefresh?: boolean;
  }): Promise<OP3Stats>;
  
  formatStatsForDisplay(downloads: number): string | null;
}
```

**REST API** :
```
GET /api/episodes/:season/:episode/stats

Response 200:
{
  "season": 1,
  "episode": 5,
  "stats": {
    "downloads": 1234,
    "period": "7d",
    "displayText": "1.2k écoutes",
    "cached": true,
    "updatedAt": "2025-11-18T10:30:00Z"
  }
}

Response 404:
{
  "error": "Episode not found"
}
```

---

## Métriques de succès

**Performance** :
- Latence ajoutée page load : < 100ms (avec cache)
- Cache hit rate : > 95% (après 24h premier fetch)

**UX** :
- Affichage conditionnel : 100% épisodes ≥ 10 écoutes
- Masquage : 100% épisodes < 10 écoutes
- Fallback gracieux : 0 erreur UI si OP3 down

**Technique** :
- OP3 API success rate : > 99% (ou fallback scraping)
- Freshness : Cache refresh quotidien automatique

---

## Alternatives évaluées

### ❌ Compter uniquement nos plays proxy

**Idée** : Logger plays via `/api/audio/proxy`

**Rejeté** :
- Proxy seulement pour waveform (pas tous les plays)
- Perte historique (avant proxy implémenté)
- OP3 = référence industrie (crédibilité)

### ❌ Intégrer Spotify/Apple play counts

**Idée** : Agréger stats de toutes plateformes

**Rejeté** :
- APIs restrictives (pas toutes publiques)
- Complexité agrégation
- OP3 = déjà agrégé multi-plateformes

---

## Prochaines étapes

1. **Phase exploratoire** (ce sprint) :
   - Tester API OP3 publique
   - Vérifier scraping fallback
   - Analyser RSS tags

2. **Décision finale** (fin sprint) :
   - Choisir méthode fetch principale
   - Valider architecture service
   - Update ADR avec décision

3. **Implémentation** (sprint suivant) :
   - Service `op3Service.js`
   - Migration SQL
   - Template UI integration

4. **Monitoring production** :
   - Logs OP3 API errors
   - Cache hit rate metrics
   - User engagement (clics CTA après badge)

---

**Statut** : 🔍 **Phase exploratoire en cours**  
**Prochaine review** : Après investigation API OP3 (Task 1-3)  
**Décision finale** : À documenter dans cet ADR après tests
