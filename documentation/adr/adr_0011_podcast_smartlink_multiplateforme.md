# ADR-0011: Smartlink podcast multi-plateformes (hub de redirection)

**Date**: 2025-10-29  
**Statut**: ✅ VALIDÉ (prêt implémentation TDD)  
**Contexte**: Partage épisode podcast avec redirection intelligente  
**Remplace**: ADR-0010 (besoin mal compris initialement)

**⚠️ Note 2025-10-31** : La génération d'images Open Graph (OG Images) initialement prévue dans cet ADR est **reportée à un ADR ultérieur**. Cette approche lean permet de livrer la feature de smartlink sans dépendance à la génération d'images. Les métadonnées Open Graph pourront être ajoutées progressivement (ADR futur avec canvas/Jimp). Cette décision réduit la complexité initiale et permet une mise en production plus rapide.

---

## Contexte

### Besoin business clarifié

**Problème utilisateur** : Quand un invité veut partager l'épisode où il est mentionné, il doit pouvoir partager **un seul lien** qui redirige chaque auditeur vers **l'épisode spécifique** sur **sa plateforme préférée**.

**Inspiration** : Ausha Smartlink, Linkfire podcast

**Audiences fragmentées** (analytics Castopod/OP3) :
- Apple Podcasts : 38.64%
- Podcast Addict : 26.14%
- Deezer : 11.36%
- LinkedIn (partage web) : 9.09%
- AntennaPod : 5.68%
- Pocket Casts : 3.41%
- Unknown Apple App : 3.41%
- Overcast : 2.27%
- **Spotify : Non détecté par OP3** (16 abonnés, 13h écoute confirmés via Spotify for Podcasters)

**Observations** :
- **Spotify présent mais invisible** : OP3 ne track pas User-Agent Spotify (problème connu)
- **Android dominant** : Podcast Addict (26%) + AntennaPod (6%) = 32% total
- **Apple fort** : 38.64% + Unknown Apple (3.41%) = 42% total
- **Deezer significatif** : 11.36% (audience française)
- **Spotify à inclure** : Audience réelle inconnue mais plateforme majeure (fallback Android)

**Contraintes** :

---

## Décision

### Architecture retenue : **Route courte + Queue PostgreSQL + Progressive Enhancement**

**URL pattern** :
```
https://saletesincere.fr/episode/2/1  (ou /e/2/1 en short)
```

**Flux de données** :

```
┌─────────────────────────────────────────────────────┐
│ User partage /episode/2/1                           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 1. Check cache BDD : episode_links(2,1)             │
│    ├─ HIT (résolu) → Detect User-Agent → Redirect  │
│    └─ MISS (vide) → Continue                        │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 2. Fetch RSS Castopod (metadata + link officiel)   │
│    ├─ Success → metadata épisode                    │
│    └─ Timeout → Redirect /podcast (fallback)        │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 3. Queue job pg-boss (singletonKey déduplication)  │
│    ├─ Job "resolve-episode" créé                    │
│    └─ Si déjà en queue (spam) → Skip                │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 4. Reply immédiat (200ms)                           │
│    └─ Page HTML placeholder avec:                   │
│       ├─ Castopod link ✅ (disponible)              │
│       ├─ Spotify ⏳ (recherche en cours...)         │
│       ├─ Apple ⏳ (recherche en cours...)           │
│       └─ Deezer ⏳ (recherche en cours...)          │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ [BACKGROUND] Worker pg-boss traite job              │
│    ├─ Appels APIs parallèles (5-10s):               │
│    │  ├─ Spotify Search API                         │
│    │  ├─ Apple Lookup API                           │
│    │  └─ Deezer Search API                          │
│    └─ UPDATE episode_links (cache complet)          │
│                                                      │
│    Note: OG Image generation reportée (ADR futur)   │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ 5. Visite suivante (cache HIT)                      │
│    ├─ User-Agent iOS → Redirect Apple (50ms)        │
│    ├─ User-Agent Android → Redirect Podcast Addict  │
│    │  (ou Deezer si indisponible, ou Spotify)       │
│    └─ Desktop → Redirect Spotify (ou Deezer si FR)  │
└─────────────────────────────────────────────────────┘
```

---

## Alternatives considérées

### ❌ Option A : Fire-and-forget (setImmediate)

**Proposition** : Lancer résolution en background avec `setImmediate()` sans queue.

```javascript
setImmediate(async () => {
  await generateOGImage(...)
  await resolveAPIs(...)
})
```

**Pourquoi rejetée** :
1. **Vulnérabilité DDoS** ❌
   - 100 users simultanés = 100 jobs parallèles
   - CPU saturé (100 × 2s = 200s génération image)
   - Event loop bloqué → timeout routes légitimes
   
2. **Rate limit APIs** ❌
   - Spotify rate limit : 180 req/min
   - 100 calls simultanés → HTTP 429 → échecs
   
3. **Pas de retry** ❌
   - API timeout → job perdu définitivement
   - Pas de backpressure (charge illimitée)
   
4. **Graceful shutdown impossible** ❌
   - CleverCloud redeploy → SIGTERM → jobs en cours tués
   - Pas de monitoring (combien de jobs actifs ?)

**Déclencheur réouverture** : Jamais (trop risqué pour production).

---

### ❌ Option B : FaaS externe (Vercel, Netlify)

**Proposition** : Déporter résolution vers serverless function.

```javascript
await fetch('https://vercel.app/api/resolve-episode', {
  method: 'POST',
  body: JSON.stringify({ season, episode })
})
```

**Pourquoi rejetée** :
1. **Complexité infra** ❌
   - 2 services à déployer (Fastify + Vercel)
   - Auth entre services (tokens)
   - Monitoring distribué
   
2. **Latence réseau** ❌
   - +50-200ms call HTTP inter-services
   - Cold start FaaS ~500ms-2s
   
3. **Coût** ❌
   - Vercel gratuit = 100GB bandwidth/mois
   - Si succès podcast → coût variable imprévisible
   
4. **Dépendance externe** ❌
   - Vercel down → feature cassée
   - Pas de contrôle infra

**Déclencheur réouverture** : Si >1000 épisodes/jour (actuellement ~8/mois).

---

### ❌ Option C : BullMQ + Redis

**Proposition** : Queue Redis standard (BullMQ = leader marché).

**Pourquoi rejetée** :
1. **Infra supplémentaire** ❌
   - Redis à ajouter (CleverCloud +€5-10/mois)
   - PostgreSQL déjà présent et suffisant
   
2. **Backup complexifié** ❌
   - PostgreSQL backupé automatiquement
   - Redis nécessite backup séparé ou risque perte jobs
   
3. **Overkill performance** ❌
   - Redis : ~5000 jobs/sec
   - Besoin réel : ~10 jobs/mois
   - PostgreSQL : ~500 jobs/sec (largement suffisant)

**Déclencheur réouverture** : Si besoin >1000 jobs/sec (jamais prévu).

---

### ✅ Option D : pg-boss Queue (PostgreSQL)

**Choix retenu** ✅

**Architecture** :
- Queue jobs dans PostgreSQL (schema `pgboss`)
- Workers intégrés au process Fastify (zéro infra)
- Déduplication via idempotency key (`singletonKey` dans l'API pg-boss)
- Retry automatique (3 tentatives, backoff exponentiel)
- Graceful shutdown (jobs terminés avant restart)

**Avantages** :
1. **Zéro infra supplémentaire** ✅
   - PostgreSQL déjà présent (€0 coût)
   - Backup inclus (pg_dump capture jobs)
   - Monitoring SQL natif (`SELECT * FROM pgboss.job`)
   
2. **Protection DDoS native** ✅
   - Idempotency key (verrou distribué PostgreSQL) déduplique automatiquement
   - Contrainte UNIQUE sur `(name, singletonKey)` en BDD
   - Fonctionne avec plusieurs instances CleverCloud (verrou en BDD, pas en mémoire)
   - `teamSize=3` limite workers actifs
   - Event loop non saturé
   
3. **Retry robuste** ✅
   - API timeout → retry après 60s (3x max)
   - Backoff exponentiel (60s, 120s, 240s)
   - Jobs persistés (pas de perte si app crash)
   
4. **Simplicité** ✅
   - `npm install pg-boss` (500KB)
   - ~150 lignes code (worker + queue)
   - Compatible CleverCloud natif

**Inconvénients acceptés** :
- ❌ Performance limitée vs Redis (~500 jobs/sec vs 5000)
  - **Mitigé** : Besoin réel ~10 jobs/mois → largement suffisant
- ❌ Workers dans même process (pas isolé)
  - **Mitigé** : `teamSize=3` + timeout limite CPU/RAM
  - **Mitigé** : Crash worker = retry automatique

**Trade-off assumé** :
- Simplicité et coût €0 > Performance théorique jamais utilisée

---

## Architecture mono-process

### Déploiement CleverCloud

pg-boss tourne **dans le même process Node.js** que Fastify. Pas de worker séparé, pas de configuration supplémentaire.

```bash
# CleverCloud exécute
npm start
  ↓
node server.js
  ↓
┌─────────────────────────────────────┐
│ Process Node.js unique              │
│                                     │
│  ┌──────────────┐  ┌─────────────┐ │
│  │   Fastify    │  │  pg-boss    │ │
│  │   (HTTP)     │  │  (Workers)  │ │
│  │              │  │             │ │
│  │ Port :8080   │  │ teamSize: 3 │ │
│  └──────────────┘  └─────────────┘ │
│                                     │
│        Event Loop partagé           │
└─────────────────────────────────────┘
```

### Séquence démarrage

```javascript
// server.js
import Fastify from 'fastify'
import { initQueue, getBoss } from './server/queues/episodeQueue.js'

const fastify = Fastify({ logger: true })

// 1. Configuration Fastify
await fastify.register(/* plugins */)

// 2. ✅ Démarrage pg-boss (AVANT listen)
await initQueue()
console.log('✅ pg-boss workers started')

// 3. ✅ Démarrage HTTP server
await fastify.listen({ port: process.env.PORT || 8080, host: '0.0.0.0' })
console.log('✅ Server listening')

// 4. ✅ Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received')
  
  // Stop workers d'abord (max 30s pour finir jobs)
  await getBoss().stop({ graceful: true, timeout: 30000 })
  
  // Stop HTTP server
  await fastify.close()
  
  // Ferme pool BDD
  await db.end()
  
  console.log('✅ Shutdown complete')
  process.exit(0)
})
```

### Fonctionnement workers pg-boss

Les workers ne sont **pas des threads ou processes séparés**, mais des **timers dans l'event loop** :

```javascript
// Simplifié (interne pg-boss)
class PgBoss {
  async start() {
    // Polling interval dans event loop
    this.pollingInterval = setInterval(async () => {
      // SELECT jobs disponibles (FOR UPDATE SKIP LOCKED)
      const jobs = await this.db.query(`
        SELECT * FROM pgboss.job 
        WHERE state='created' AND name=$1 
        LIMIT $2
      `, [jobName, teamSize])
      
      // Exécute en parallèle (Promise.all)
      await Promise.all(jobs.map(job => this.executeJob(job)))
    }, 2000) // Poll toutes les 2s
  }
}
```

**Implications** :
- ✅ Zéro config infra (1 dyno CleverCloud suffit)
- ✅ Logs unifiés (HTTP + workers dans même stream)
- ⚠️ RAM/CPU partagés (limite workers actifs)
- ⚠️ Génération Jimp peut ralentir HTTP (50ms → 200ms latence)

### Impact performance

**Ressources process** (CleverCloud S dyno ~512MB RAM) :
```
├─ Fastify (HTTP)         ~50MB RAM
├─ pg-boss workers        ~100MB RAM (3 workers idle)
├─ PostgreSQL pool        ~50MB RAM
├─ Jimp génération active ~150MB RAM par job (temporaire)
└─ Total pic              ~500-600MB (3 jobs simultanés)
```

**Scénario charge** (10 requests `/episode/X/Y` simultanées, cache MISS) :
```
0ms   → 10 HTTP requests arrivent
50ms  → 10 boss.send() (INSERT jobs)
52ms  → singletonKey déduplique → 1 seul job créé ✅
200ms → 10 HTTP responses (placeholder)
2s    → Worker 1 poll → Trouve job
2-9s  → Worker traite (Jimp 2s + APIs 5s)
10s   → UPDATE BDD complete
```

**Event loop** : Requêtes HTTP restent non-bloquées pendant traitement job (I/O asynchrone).

**Latence HTTP** : Si worker génère image, latence peut passer de 50ms → 150-200ms (acceptable).

### Monitoring runtime

```javascript
// Log activité workers
boss.on('wip', ({ count }) => {
  const memUsage = process.memoryUsage()
  console.log(`📋 ${count} jobs active | RAM: ${(memUsage.heapUsed / 1024 / 1024).toFixed(0)}MB`)
})

// Alert si queue trop longue
setInterval(async () => {
  const queueSize = await boss.getQueueSize('resolve-episode')
  if (queueSize > 20) {
    console.error(`⚠️ Queue size: ${queueSize}`)
  }
}, 60000)
```

### Alternative: Worker process séparé (si besoin)

Si volume >100 jobs/jour ou latence HTTP critique :

```javascript
// worker.js (fichier séparé)
import { initQueue } from './server/queues/episodeQueue.js'

await initQueue() // SEULEMENT workers
console.log('✅ Worker process started')
// Pas de fastify.listen()
```

**Déploiement** : Nécessite 2 applications CleverCloud (web + worker) = 2× coût.

**Déclencheur** : Jamais prévu (volume actuel ~8 jobs/mois << capacité mono-process).

---

## Composants techniques

### 1. Data model PostgreSQL

```sql
-- Migration 008_episode_smartlinks.sql

CREATE TABLE IF NOT EXISTS episode_links (
  season INTEGER NOT NULL,
  episode INTEGER NOT NULL,
  
  -- Metadata RSS (pour affichage rapide)
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  
  -- Liens plateformes (NULL = pas encore résolu)
  castopod_link TEXT NOT NULL,           -- Toujours disponible (RSS)
  apple_episode_id TEXT,                 -- 38.64% audience
  podcast_addict_episode_id TEXT,        -- 26.14% audience (pas d'API)
  deezer_episode_id TEXT,                -- 11.36% audience
  antennapod_episode_id TEXT,            -- 5.68% audience (pas d'API, utilise RSS)
  pocket_casts_episode_id TEXT,          -- 3.41% audience
  overcast_episode_id TEXT,              -- 2.27% audience (pas d'API)
  spotify_episode_id TEXT,               -- Fallback universel (absent stats mais indexé)
  
  -- Image OG custom
  og_image_url TEXT,
  
  -- Statuts résolution
  resolution_status TEXT DEFAULT 'pending', -- pending|partial|complete|failed
  apple_status TEXT DEFAULT 'pending',      -- pending|resolved|failed
  podcast_addict_status TEXT DEFAULT 'unavailable', -- Pas d'API
  deezer_status TEXT DEFAULT 'pending',
  antennapod_status TEXT DEFAULT 'unavailable',     -- Utilise RSS
  pocket_casts_status TEXT DEFAULT 'pending',
  overcast_status TEXT DEFAULT 'unavailable',       -- Pas d'API
  spotify_status TEXT DEFAULT 'pending',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  
  PRIMARY KEY (season, episode)
);

CREATE INDEX idx_episode_links_status ON episode_links(resolution_status);
CREATE INDEX idx_episode_links_updated ON episode_links(updated_at DESC);
```

**URLs construites dynamiquement** :
```javascript
const PLATFORMS = {
  apple: {
    buildUrl: (id) => `https://podcasts.apple.com/podcast/id1846531745?i=${id}`,
    fallbackUrl: 'https://podcasts.apple.com/us/podcast/pas-de-charbon-pas-de-wafer/id1846531745',
    audience: 38.64
  },
  podcastAddict: {
    buildUrl: null, // Pas d'API pour deep link
    fallbackUrl: 'https://podcastaddict.com/podcast/pas-de-charbon-pas-de-wafer/6137997',
    audience: 26.14
  },
  deezer: {
    buildUrl: (id) => `https://www.deezer.com/fr/episode/${id}`,
    fallbackUrl: 'https://www.deezer.com/fr/show/1002292972',
    audience: 11.36
  },
  antennapod: {
    buildUrl: null, // Open-source, utilise RSS direct
    fallbackUrl: null, // Pas de web player
    rssUrl: 'https://podcasts.saletesincere.fr/@charbonwafer/feed.xml',
    audience: 5.68
  },
  pocketCasts: {
    buildUrl: (id) => `https://pca.st/episode/${id}`, // Si API trouvée
    fallbackUrl: 'https://pca.st/podcast/bb74e9c5-20e5-5226-8491-d512ad8ebe04',
    audience: 3.41
  },
  overcast: {
    buildUrl: null, // Pas d'API publique
    fallbackUrl: null, // Pas de web player (app iOS uniquement)
    audience: 2.27
  },
  spotify: {
    buildUrl: (id) => `https://open.spotify.com/episode/${id}`,
    fallbackUrl: 'https://open.spotify.com/show/07VuGnu0YSacC671s0DQ3a',
    audience: 'unknown' // 16 abonnés confirmés mais OP3 ne détecte pas User-Agent
  }
}
```

**Stratégie de matching des épisodes** (validée Phase 0 TDD) :

**Problème identifié** : Spotify ne renvoie PAS `season_number` ni `episode_number` dans l'API. Impossible de matcher par S01E01.

**Solution validée** : Matching par **date de publication** (`release_date`)
1. Extraire `pubDate` du RSS Castopod (format RFC 2822 : `Mon, 27 Oct 2025 22:13:48 +0000`)
2. Convertir en format ISO 8601 date-only (`YYYY-MM-DD` : `2025-10-27`)
3. Comparer avec `episode.release_date` de Spotify (déjà au format `YYYY-MM-DD`)
4. Match exact → Extraire `episode.external_urls.spotify`

**Workflow Spotify** :
```javascript
// 1. Authentification (Client Credentials)
const token = await getSpotifyToken(clientId, clientSecret)

// 2. Récupérer TOUS les épisodes du show (limite 50, paginer si besoin)
const episodes = await fetch(
  `https://api.spotify.com/v1/shows/${SPOTIFY_SHOW_ID}/episodes?market=FR&limit=50`,
  { headers: { Authorization: `Bearer ${token}` } }
)

// 3. Matcher par date
const rssDate = new Date(rssPubDate).toISOString().split('T')[0]
const match = episodes.items.find(ep => ep.release_date === rssDate)

// 4. Extraire deeplink
const deeplink = match?.external_urls.spotify // https://open.spotify.com/episode/{id}
```

**Tests Phase 0 validés** :
- ✅ Authentification Client Credentials (token 1h)
- ✅ Recherche show "Pas de Charbon, pas de Wafer" (ID: `07VuGnu0YSacC671s0DQ3a`)
- ✅ Récupération 6 épisodes du show
- ✅ Matching par date : RSS `Mon, 27 Oct 2025` = Spotify `2025-10-27` → Trouvé "Une collaboration… un peu spéciale 🌶️"
- ✅ Extraction deeplink : `https://open.spotify.com/episode/4uuRA1SjUKWPI3G0NmpCQx`

**Apple Podcasts** (validé Phase 0) :

**API disponible** : `GET /lookup?id={podcast_id}&entity=podcastEpisode&limit=200&country=fr`

**Workflow Apple** :
```javascript
// 1. Récupérer podcast + tous ses épisodes
const response = await fetch(
  'https://itunes.apple.com/lookup?id=1846531745&entity=podcastEpisode&limit=200&country=fr'
)
const data = await response.json()

// 2. Filtrer les épisodes
const episodes = data.results.filter(r => r.wrapperType === 'podcastEpisode')

// 3. Matcher par date
const rssDate = new Date(rssPubDate).toISOString().split('T')[0] // 2025-10-27
const match = episodes.find(ep => ep.releaseDate.split('T')[0] === rssDate)

// 4. Extraire deeplink
const deeplink = match?.trackViewUrl 
// https://podcasts.apple.com/podcast/id1846531745?i=1000733777469
```

**Tests Phase 0 validés** :
- ✅ Récupération 6 épisodes via `entity=podcastEpisode`
- ✅ Matching par date : RSS `Mon, 27 Oct 2025` = Apple `2025-10-27T22:13:48Z` → Trouvé trackId `1000733777469`
- ✅ Extraction deeplink : `https://podcasts.apple.com/fr/podcast/.../id1846531745?i=1000733777469`

**Deezer** (validé Phase 0) :

**API disponible** : `GET /podcast/{id}/episodes?limit=50`

**Workflow Deezer** :
```javascript
// 1. Récupérer les épisodes
const response = await fetch('https://api.deezer.com/podcast/1002292972/episodes?limit=50')
const data = await response.json()

// 2. Matcher par date
const rssDate = new Date(rssPubDate).toISOString().split('T')[0] // 2025-10-27
const match = data.data.find(ep => ep.release_date.split(' ')[0] === rssDate)

// 3. Construire deeplink
const deeplink = `https://www.deezer.com/fr/episode/${match.id}`
```

**Tests Phase 0 validés** :
- ✅ Récupération 6 épisodes
- ✅ Matching par date : RSS `Mon, 27 Oct 2025` = Deezer `2025-10-27 22:13:48` → Trouvé ID `804501282`
- ✅ Construction deeplink : `https://www.deezer.com/fr/episode/804501282`

**Podcast Addict** (validé Phase 0) :

**Pas d'API publique**, mais deeplink prévisible basé sur l'URL audio du RSS !

**Workflow Podcast Addict** :
```javascript
// 1. Extraire l'URL audio du RSS Castopod
const audioUrl = rssEpisode.enclosure.url
// https://op3.dev/e,pg=.../une-collaboration-un-peu-speciale.mp3?_from=podcastaddict.com

// 2. Encoder l'URL
const encodedUrl = encodeURIComponent(audioUrl)

// 3. Construire le deeplink
const deeplink = `https://podcastaddict.com/episode/${encodedUrl}&podcastId=6137997`
// Redirige (301) vers la page de l'épisode
```

**Tests Phase 0 validés** :
- ✅ Pattern découvert : `/episode/{encodedAudioUrl}&podcastId={id}`
- ✅ Test navigateur : 301 redirect vers l'épisode correct
- ✅ Deeplink : `https://podcastaddict.com/episode/https%3A%2F%2Fop3.dev%2F...%2Fune-collaboration-un-peu-speciale.mp3&podcastId=6137997`

**Note** : L'URL audio doit être celle du RSS (avec `?_from=podcastaddict.com` ou sans).

---

### 2. Queue pg-boss

```javascript
// server/queues/episodeQueue.js
import PgBoss from 'pg-boss'

let boss = null

export async function initQueue() {
  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    schema: 'pgboss',
    retryLimit: 3,           // 3 tentatives max
    retryDelay: 60,          // 60s entre tentatives
    retryBackoff: true,      // Exponentiel: 60s, 120s, 240s
    expireInHours: 24,       // Supprime jobs terminés après 24h
    archiveCompletedAfterSeconds: 3600 // Archive après 1h
  })
  
  await boss.start()
  
  // Worker unique pour tout (OG Image + APIs)
  await boss.work('resolve-episode', {
    teamSize: 3,          // Max 3 jobs en parallèle
    teamConcurrency: 1    // 1 job par worker
  }, async (job) => {
    const { season, episode, title, imageUrl } = job.data
    
    console.log(`[Job ${job.id}] 🔍 Resolving S${season}E${episode}`)
    
    try {
      // 1. Génération OG Image (Jimp 1-2s)
      const imageBuffer = await generateEpisodeOGImage(season, episode, title, imageUrl)
      const s3Key = `og-images/s${season}e${episode}.png`
      const ogImageUrl = await uploadToS3({
        key: s3Key,
        body: imageBuffer,
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000'
      })
      
      // 2. Résolution APIs (parallèle, timeout 10s chacune)
      // Note: Podcast Addict, AntennaPod, Overcast n'ont pas d'API publique
      const [appleResult, deezerResult, pocketCastsResult, spotifyResult] = await Promise.allSettled([
        searchAppleEpisode(title, '1846531745'),          // 38.64% audience
        searchDeezerEpisode(title, '1002292972'),         // 11.36% audience
        searchPocketCastsEpisode(title, 'bb74e9c5-...'),  // 3.41% audience
        searchSpotifyEpisode(title, '07VuGnu0YSacC671s0DQ3a') // Fallback universel
      ])
      
      // 3. Update BDD (atomique)
      await db.query(`
        UPDATE episode_links SET
          og_image_url = $3,
          apple_episode_id = $4,
          apple_status = $5,
          deezer_episode_id = $6,
          deezer_status = $7,
          pocket_casts_episode_id = $8,
          pocket_casts_status = $9,
          spotify_episode_id = $10,
          spotify_status = $11,
          resolution_status = $12,
          resolved_at = NOW(),
          updated_at = NOW()
        WHERE season = $1 AND episode = $2
      `, [
        season, episode,
        ogImageUrl,
        appleResult.status === 'fulfilled' ? appleResult.value : null,
        appleResult.status === 'fulfilled' ? 'resolved' : 'failed',
        deezerResult.status === 'fulfilled' ? deezerResult.value : null,
        deezerResult.status === 'fulfilled' ? 'resolved' : 'failed',
        pocketCastsResult.status === 'fulfilled' ? pocketCastsResult.value : null,
        pocketCastsResult.status === 'fulfilled' ? 'resolved' : 'failed',
        spotifyResult.status === 'fulfilled' ? spotifyResult.value : null,
        spotifyResult.status === 'fulfilled' ? 'resolved' : 'failed',
        // Status global
        [appleResult, deezerResult, pocketCastsResult, spotifyResult].every(r => r.status === 'fulfilled') ? 'complete' :
        [appleResult, deezerResult, pocketCastsResult, spotifyResult].some(r => r.status === 'fulfilled') ? 'partial' : 'failed'
      ])
      
      console.log(`[Job ${job.id}] ✅ Complete S${season}E${episode}`)
    } catch (err) {
      console.error(`[Job ${job.id}] ❌ Failed S${season}E${episode}:`, err)
      throw err // pg-boss retry automatique
    }
  })
  
  // Logs monitoring
  boss.on('error', (err) => console.error('pg-boss error:', err))
  boss.on('wip', ({ count }) => console.log(`📋 ${count} jobs in progress`))
  
  console.log('✅ pg-boss workers started')
  return boss
}

export async function queueEpisodeResolution(season, episode, title, imageUrl) {
  return boss.send('resolve-episode', 
    { season, episode, title, imageUrl },
    {
      singletonKey: `episode-${season}-${episode}`,  // Idempotency key (throttling)
      singletonSeconds: 300  // Throttle 5 min : max 1 job par slot temporel
      // Note: Pas de retryLimit (worker DOIT être idempotent, pas de retry auto)
    }
  )
}

// Note : Worker DOIT être idempotent
// - Vérifier si travail déjà fait avant d'appeler APIs (check episode_links.spotify_episode_id)
// - OK de rejouer job après expiration slot (300s) si nécessaire
// - Fonctionne avec plusieurs instances (verrou distribué PostgreSQL)

export function getBoss() {
  return boss
}
```

---

### 3. ~~Génération OG Image (Jimp)~~ → **REPORTÉ (ADR futur)**

**Décision 2025-10-31** : La génération d'images Open Graph est **retirée du scope de cet ADR** pour une approche lean. 

**Raisons** :
- ✅ Livraison plus rapide du smartlink (feature core)
- ✅ Réduit complexité initiale (pas de dépendance Jimp/Canvas)
- ✅ Permet validation user flow avant d'investir dans les images
- ✅ Progressive enhancement : OG metadata textuelles suffisent pour v1

**Plan futur** :
- ADR dédié pour génération images (canvas vs Jimp, fonts, style)
- Intégration pg-boss pour génération asynchrone
- Upload S3/MinIO avec CDN

**Fallback actuel** : Meta tags Open Graph avec texte uniquement (titre, description) extraits du RSS Castopod.

---

### 4. Routes Fastify

```javascript
// server.js

// Route smartlink courte
app.get('/episode/:season/:episode', async (req, reply) => {
  const { season, episode } = req.params
  
  // Validation
  if (!/^\d+$/.test(season) || !/^\d+$/.test(episode)) {
    return reply.redirect('/podcast')
  }
  
  const seasonInt = parseInt(season)
  const episodeInt = parseInt(episode)
  
  // 1. Check cache BDD
  let episodeData = await getEpisodeLinks(seasonInt, episodeInt)
  
  if (episodeData && episodeData.resolutionStatus === 'complete') {
    // Cache HIT + complet: redirect direct User-Agent
    const userAgent = req.headers['user-agent']
    
    // iOS → Apple Podcasts (38.64% audience)
    if (/iPhone|iPad|iPod/.test(userAgent) && episodeData.links.apple.isDirect) {
      reply.header('Cache-Control', 'public, max-age=3600')
      return reply.redirect(episodeData.links.apple.url)
    }
    
    // Android → Priorité Podcast Addict (26.14%) > Deezer (11.36%) > Spotify (hidden audience)
    if (/Android/.test(userAgent)) {
      if (episodeData.links.podcastAddict.isDirect) {
        reply.header('Cache-Control', 'public, max-age=3600')
        return reply.redirect(episodeData.links.podcastAddict.url)
      }
      if (episodeData.links.deezer.isDirect) {
        reply.header('Cache-Control', 'public, max-age=3600')
        return reply.redirect(episodeData.links.deezer.url)
      }
      if (episodeData.links.spotify.isDirect) {
        reply.header('Cache-Control', 'public, max-age=3600')
        return reply.redirect(episodeData.links.spotify.url)
      }
    }
    
    // Desktop → Priorité Spotify (universel) > Deezer (FR)
    if (episodeData.links.spotify.isDirect) {
      reply.header('Cache-Control', 'public, max-age=3600')
      return reply.redirect(episodeData.links.spotify.url)
    }
    if (episodeData.links.deezer.isDirect) {
      reply.header('Cache-Control', 'public, max-age=3600')
      return reply.redirect(episodeData.links.deezer.url)
    }
    
    // Desktop: page choix
    return reply.view('episode-smartlink.hbs', { episodeData })
  }
  
  // 2. Cache MISS ou partiel: fetch RSS + queue job
  const rssEpisode = await fetchEpisodeFromRSS(seasonInt, episodeInt, 3000).catch(() => null)
  
  if (!rssEpisode) {
    return reply.redirect('/podcast') // Épisode introuvable
  }
  
  // 3. Queue job (singletonKey déduplique spam)
  await queueEpisodeResolution(
    seasonInt, episodeInt,
    rssEpisode.title,
    rssEpisode.image
  )
  
  // 4. Reply immédiat avec placeholder
  episodeData = {
    metadata: {
      season: seasonInt,
      episode: episodeInt,
      title: rssEpisode.title,
      description: rssEpisode.description,
      imageUrl: rssEpisode.image
    },
    links: {
      castopod: { 
        url: rssEpisode.episodeLink, 
        status: 'resolved', 
        isDirect: true 
      },
      spotify: { 
        url: PLATFORMS.spotify.fallbackUrl, 
        status: 'pending', 
        isDirect: false 
      },
      apple: { 
        url: PLATFORMS.apple.fallbackUrl, 
        status: 'pending', 
        isDirect: false 
      },
      deezer: { 
        url: PLATFORMS.deezer.fallbackUrl, 
        status: 'pending', 
        isDirect: false 
      },
      podcastAddict: { 
        url: PLATFORMS.podcastAddict.fallbackUrl, 
        status: 'unavailable', 
        isDirect: false 
      }
    },
    resolutionStatus: 'pending'
  }
  
  return reply.view('episode-smartlink.hbs', { episodeData })
})

// Route fallback (compatibilité ADR-0010)
app.get('/podcast', async (req, reply) => {
  const { season, episode } = req.query
  
  if (season && episode && /^\d+$/.test(season) && /^\d+$/.test(episode)) {
    return reply.redirect(`/episode/${season}/${episode}`)
  }
  
  return reply.view('podcast.hbs') // Page classique
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, graceful shutdown...')
  await getBoss().stop({ graceful: true, timeout: 30000 })
  await fastify.close()
  console.log('✅ Shutdown complete')
  process.exit(0)
})
```

---

### 5. Template Handlebars

```handlebars
{{!-- server/views/episode-smartlink.hbs --}}
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{episodeData.metadata.title}} - Charbon & Wafer</title>
  
  <!-- Meta OG dynamiques -->
  <meta property="og:type" content="music.song">
  <meta property="og:title" content="{{episodeData.metadata.title}} - Charbon & Wafer">
  <meta property="og:description" content="{{episodeData.metadata.description}}">
  <meta property="og:image" content="{{#if episodeData.metadata.ogImageUrl}}{{episodeData.metadata.ogImageUrl}}{{else}}{{episodeData.metadata.imageUrl}}{{/if}}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="https://saletesincere.fr/episode/{{episodeData.metadata.season}}/{{episodeData.metadata.episode}}">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="{{episodeData.metadata.ogImageUrl}}">
  
  <link rel="stylesheet" href="/style.css">
</head>
<body class="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white min-h-screen p-6">
  <div class="max-w-2xl mx-auto">
    
    <!-- Episode header -->
    <div class="mb-8 text-center">
      <div class="text-purple-400 text-sm uppercase mb-2">
        Saison {{episodeData.metadata.season}} • Épisode {{episodeData.metadata.episode}}
      </div>
      <h1 class="text-3xl font-bold mb-3">{{episodeData.metadata.title}}</h1>
      <p class="text-gray-300">{{episodeData.metadata.description}}</p>
    </div>
    
    {{#if (eq episodeData.resolutionStatus 'pending')}}
    <!-- Résolution en cours -->
    <div class="mb-6 bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-4 text-center">
      <div class="animate-pulse text-yellow-400">⏳ Chargement des liens directs...</div>
      <div class="text-sm text-gray-400 mt-2">
        Cela prend quelques secondes la première fois. Actualisez dans 10 secondes.
      </div>
    </div>
    {{/if}}
    
    <!-- Platform links -->
    <div class="space-y-3">
      
      <!-- Castopod (toujours disponible) -->
      <a href="{{episodeData.links.castopod.url}}" target="_blank" rel="noopener noreferrer"
         class="block bg-white/10 hover:bg-white/20 rounded-xl px-6 py-4 transition">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center p-2" style="background: #009486;">
              <img src="/images/castopod-logo.svg" alt="Castopod" class="w-full h-full">
            </div>
            <div class="text-left">
              <div class="font-semibold text-black">Site officiel (Castopod)</div>
              <div class="text-xs text-gray-500">✅ Lien direct vers l'épisode</div>
            </div>
          </div>
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </a>
      
      <!-- Spotify -->
      <a href="{{episodeData.links.spotify.url}}" target="_blank" rel="noopener noreferrer"
         class="block bg-white/10 hover:bg-white/20 rounded-xl px-6 py-4 transition {{#unless episodeData.links.spotify.isDirect}}opacity-75{{/unless}}">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: #1DB954;">
              <img src="/images/spotify-logo.svg" alt="Spotify" class="w-6 h-6">
            </div>
            <div class="text-left">
              <div class="font-semibold text-black">Spotify</div>
              <div class="text-xs text-gray-500">
                {{#if episodeData.links.spotify.isDirect}}
                  ✅ Lien direct vers l'épisode
                {{else if (eq episodeData.links.spotify.status 'pending')}}
                  ⏳ Recherche en cours...
                {{else}}
                  ⚠️ Vers le podcast général
                {{/if}}
              </div>
            </div>
          </div>
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </a>
      
      <!-- Apple Podcasts, Deezer, Podcast Addict... même pattern -->
      
    </div>
    
    <!-- Footer -->
    <div class="mt-12 text-center text-sm text-gray-400">
      <p>Un podcast <a href="https://saletesincere.fr" class="text-purple-400 hover:underline">Saleté Sincère</a></p>
    </div>
    
  </div>
</body>
</html>
```

---

## Sécurité (OWASP Top 10)

### A03 - Injection (XSS, SQL)
**Vecteurs** : Params URL `season`/`episode`, metadata RSS.

**Mesures** :
```javascript
// ✅ Validation stricte params (digits only)
if (!/^\d+$/.test(season)) return reply.redirect('/podcast')

// ✅ Handlebars auto-escape
{{episodeData.metadata.title}} // Échappé automatiquement

// ✅ Parameterized queries
await db.query('SELECT * FROM episode_links WHERE season=$1 AND episode=$2', [season, episode])
```

### A05 - Security Misconfiguration
**Vecteurs** : Timeout infini, headers absents.

**Mesures** :
```javascript
// ✅ Timeout fetch RSS strict
const rssEpisode = await fetchEpisodeFromRSS(season, episode, 3000) // 3s max

// ✅ Timeout APIs (Promise.allSettled + AbortController)
const controller = new AbortController()
setTimeout(() => controller.abort(), 10000)

// ✅ Rate limiting actif (déjà configuré)
// ✅ Cache headers explicites
reply.header('Cache-Control', 'public, max-age=3600')
```

### A10 - SSRF (Server-Side Request Forgery)
**Vecteurs** : URLs RSS/API manipulées.

**Mesures** :
```javascript
// ✅ URLs hardcodées (pas de param utilisateur)
const RSS_URL = 'https://podcasts.saletesincere.fr/@charbonwafer/feed.xml'
const SPOTIFY_API = 'https://api.spotify.com/v1/search'

// ✅ Pas de suivi redirections
fetch(RSS_URL, { redirect: 'manual' })
```

### A04 - Insecure Design (DDoS Queue)
**Vecteur** : Spam URL → saturation queue.

**Mesures** :
```javascript
// ✅ Throttling pg-boss (idempotency key distribuée)
await boss.send('resolve-episode', data, {
  singletonKey: `episode-${season}-${episode}`,  // Clé d'idempotence (anti-doublon)
  singletonSeconds: 300  // Throttle 5 min → 100 calls = 1 seul job créé dans ce slot
})

// Note terminologie : pg-boss nomme ça "singletonKey" mais c'est techniquement
// un THROTTLING avec idempotency key distribuée PostgreSQL.
// Garantit max 1 job par time slot même avec plusieurs instances CleverCloud.

// ✅ Backpressure workers
teamSize: 3 // Max 3 jobs actifs (CPU/RAM contrôlé)
```

**Explication technique** :
- `singletonKey` + `singletonSeconds` = throttling "one per time slot"
- Si job existe déjà dans le slot : `boss.send()` retourne `null` (skip)
- Verrou expire après le time slot OU quand le job est `completed`
- Mécanisme distribué : fonctionne avec plusieurs instances (verrou en BDD, pas en mémoire)

**⚠️ Design idempotent requis** :
- Le worker DOIT vérifier si le travail est déjà fait (partiellement ou totalement)
- Rejouable sans effets de bord : OK de rejouer un job après expiration du slot
- Pas de retry automatique pg-boss (risque doublon APIs) → gérer manuellement si nécessaire
- Exemple : Avant d'appeler API Spotify, vérifier si `episode_links.spotify_episode_id` existe déjà

---

## Performance & Monitoring

### Métriques cibles (SLO)

| Métrique | Objectif | Critique si |
|----------|----------|-------------|
| Première visite (cache MISS) | <3s | >5s |
| Visites suivantes (cache HIT) | <200ms | >1s |
| Rate success jobs pg-boss | >90% | <80% |
| Timeout RSS | <5% | >20% |
| Queue size max | <10 | >50 |

### Monitoring pg-boss

```javascript
// Endpoint admin
app.get('/admin/jobs', async (req, reply) => {
  const boss = getBoss()
  
  const stats = await Promise.all([
    boss.getQueueSize('resolve-episode'),
    boss.getQueueSize('resolve-episode', { state: 'completed' }),
    boss.getQueueSize('resolve-episode', { state: 'failed' }),
    boss.getQueueSize('resolve-episode', { state: 'active' })
  ])
  
  return {
    pending: stats[0],
    completed: stats[1],
    failed: stats[2],
    active: stats[3]
  }
})

// SQL monitoring direct
SELECT state, count(*) 
FROM pgboss.job 
WHERE name='resolve-episode' 
GROUP BY state;
```

---

## Stack technique

**Dépendances ajoutées** :
```json
{
  "dependencies": {
    "pg-boss": "^9.0.3",
    "jimp": "^0.22.10"
  }
}
```

**Taille totale** : ~3.5MB (pg-boss 500KB + Jimp 3MB)

---

## Plan d'implémentation TDD

### Phase 0 : Investigation APIs (STOP si manquant)
- [ ] Tester Spotify Search API (curl avec token)
- [ ] Tester Apple Lookup API (curl public)
- [ ] Tester Deezer Search API (curl public)
- [ ] Sauvegarder exemples responses dans `test_data/`

### Phase 1 : Service Platform APIs
**RED 1** : Test Spotify search trouve épisode S2E1
**GREEN 1** : Implémenter `searchSpotifyEpisode()`
**REFACTOR 1** : Extraire auth token Spotify
**Pause state** : 3 tests verts (Spotify, Apple, Deezer)

### Phase 2 : Service OG Image Generator
**RED 2** : Test génère PNG 1200x630
**GREEN 2** : Implémenter `generateEpisodeOGImage()` avec Jimp
**REFACTOR 2** : Extraire fonts en constantes
**Pause state** : 5 tests verts (image + S3 upload)

### Phase 3 : Queue pg-boss
**RED 3** : Test job "resolve-episode" complète avec succès
**GREEN 3** : Implémenter worker + queue
**REFACTOR 3** : Extraire monitoring helpers
**Pause state** : 8 tests verts (queue + retry + singleton)

**⚠️ BLOCKER CleverCloud (2025-11-04) → ✅ RÉSOLU (2025-11-05)**

**Problème initial** : Serveur échoue au démarrage sur CleverCloud avec :
```
❌ Failed to initialize queue/worker: Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Cause racine** : 
- `fastify-postgres` utilise : `DATABASE_URL || POSTGRESQL_ADDON_URI || fallback localhost`
- `pg-boss` utilisait UNIQUEMENT : `DATABASE_URL`
- CleverCloud addon expose `POSTGRESQL_ADDON_URI`, pas forcément `DATABASE_URL`
- Résultat : fastify-postgres connecté, pg-boss échoue

**✅ Solution implémentée** :

**1. Cohérence connexion PostgreSQL** :
```javascript
// server/queues/episodeQueue.js
export async function initQueue() {
  // Même logique que fastify-postgres (cohérence)
  const connectionString = process.env.DATABASE_URL 
    || process.env.POSTGRESQL_ADDON_URI 
    || 'postgresql://salete:salete@localhost:5432/salete';
  
  boss = new PgBoss({ connectionString, schema: 'pgboss' })
  await boss.start()
}
```

**2. Fail-hard par défaut + Bypass explicite** :
```javascript
// server.js
const hasDatabase = !!(process.env.DATABASE_URL || process.env.POSTGRESQL_ADDON_URI);
const WORKER_ENABLED = process.env.DISABLE_WORKER !== 'true' && hasDatabase;
const ALLOW_DEGRADED = process.env.ALLOW_DEGRADED_MODE === 'true';

if (WORKER_ENABLED) {
  try {
    await initQueue()
    await startWorker()
  } catch (err) {
    if (ALLOW_DEGRADED) {
      console.warn('⚠️ ALLOW_DEGRADED_MODE=true: Starting in degraded mode')
    } else {
      console.error('💥 Deployment BLOCKED: Worker initialization failed')
      process.exit(1) // ✅ Fail-hard : CleverCloud garde version précédente
    }
  }
}
```

**Variables d'environnement** :
- `DISABLE_WORKER=true` → Worker désactivé proprement (résolution synchrone)
- `ALLOW_DEGRADED_MODE=true` → Bypass fail-hard (⚠️ debug/urgence uniquement)
- `DATABASE_URL` ou `POSTGRESQL_ADDON_URI` → Worker actif automatiquement

**Bénéfices sécurité** :
- ✅ **Commits hasardeux bloqués** : Si pg-boss casse, déploiement refuse (exit 1)
- ✅ **CleverCloud rollback auto** : Garde la version précédente en prod
- ✅ **Bypass explicite** : `ALLOW_DEGRADED_MODE=true` pour urgences
- ✅ **Logs explicites** : Distingue worker actif ✅ vs mode dégradé ⚠️ vs bloqué ❌

**Tests manuels validés** :
- ✅ Mode normal : Worker actif avec `DATABASE_URL`
- ❌ Fail-hard : `exit(1)` si `DATABASE_URL` cassée (sans bypass)
- ⚠️ Mode dégradé : Démarre si `ALLOW_DEGRADED_MODE=true` (avec bypass)

---

### Phase 4 : Route dynamique
**RED 4** : Test route `/episode/2/1` retourne placeholder si cache MISS
**GREEN 4** : Implémenter route + template
**REFACTOR 4** : Extraire User-Agent detection
**Pause state** : 12 tests verts (route + fallback + redirect)

### Phase 5 : Documentation
- [ ] Mettre à jour `README.md` avec section Smartlink
- [ ] Marquer ADR-0010 comme SUPERSEDED BY ADR-0011
- [ ] Documenter APIs (tokens Spotify, rate limits)

---

## Migration depuis ADR-0010

### URLs ADR-0010 déjà partagées sur LinkedIn ⚠️

**Contexte** : Des URLs `/podcast?season=X&episode=Y` ont déjà été partagées publiquement (LinkedIn).

**Obligation** : Assurer la **rétrocompatibilité totale** (pas de 404).

**Solution** : Redirect permanent 301 vers nouvelle URL smartlink

```javascript
// server.js - Route de rétrocompatibilité ADR-0010
fastify.get('/podcast', async (request, reply) => {
  const { season, episode } = request.query
  
  // Si params season/episode présents → Redirect vers smartlink
  if (season && episode) {
    return reply.redirect(301, `/episode/${season}/${episode}`)
  }
  
  // Sinon → Page podcast classique (liste épisodes)
  return reply.view('podcast', { episodes: await fetchAllEpisodes() })
})
```

**Tests de rétrocompatibilité** :
```javascript
// test/routes/podcast.test.js
test('GET /podcast?season=2&episode=1 → 301 /episode/2/1', async () => {
  const response = await fastify.inject({
    method: 'GET',
    url: '/podcast?season=2&episode=1'
  })
  
  expect(response.statusCode).toBe(301)
  expect(response.headers.location).toBe('/episode/2/1')
})

test('GET /podcast (sans params) → 200 page classique', async () => {
  const response = await fastify.inject({
    method: 'GET',
    url: '/podcast'
  })
  
  expect(response.statusCode).toBe(200)
  expect(response.headers['content-type']).toContain('text/html')
})
```

**Impact SEO** :
- ✅ **301 Permanent Redirect** : Moteurs de recherche transfèrent le PageRank
- ✅ **Liens LinkedIn préservés** : Pas de 404, utilisateurs redirigés automatiquement
- ✅ **Nouvelle URL canonique** : `/episode/:season/:episode` indexée par Google

### Code réutilisable ✅
- `server/services/castopodRSS.js` - Parser RSS (inchangé)
- `test/services/castopodRSS.test.js` - Tests RSS (5 GREEN)
- `server/views/podcast.hbs` - Page classique fallback

### Code à adapter
- Route `/podcast` → **Redirect 301** si `?season=X&episode=Y` présent
- Route `/episode/:season/:episode` → **Nouvelle route smartlink** (cœur ADR-0011)
- Template `podcast.hbs` → Garder comme page liste épisodes (sans params)

### Migrations BDD
```sql
-- 008_episode_smartlinks.sql (nouvelle table)
CREATE TABLE episode_links (
  season INTEGER NOT NULL,
  episode INTEGER NOT NULL,
  -- ... colonnes smartlink
  PRIMARY KEY (season, episode)
);

-- Aucune migration de données requise (table vide au départ)
```

---

## Critères d'acceptation (Given/When/Then)

### Test 1 : Cache HIT - Redirect User-Agent
- **Given** : Épisode S2E1 résolu en BDD (Spotify ID = `abc123`)
- **When** : User Android visite `/episode/2/1`
- **Then** : 
  - HTTP 302 vers `https://open.spotify.com/episode/abc123`
  - Header `Cache-Control: public, max-age=3600`
  - Temps réponse <200ms

### Test 2 : Cache MISS - Placeholder + Queue job
- **Given** : Épisode S2E1 absent en BDD
- **When** : User visite `/episode/2/1`
- **Then** :
  - Page HTML placeholder affichée (<3s)
  - Castopod link ✅ disponible (RSS)
  - Spotify/Apple ⏳ "Recherche en cours..."
  - Job pg-boss créé avec `singletonKey=episode-2-1`

### Test 3 : Spam protection (singletonKey)
- **Given** : 100 users visitent `/episode/2/1` simultanément (cache MISS)
- **When** : pg-boss reçoit 100 appels `boss.send()`
- **Then** :
  - 1 seul job créé en queue
  - 99 calls retournent job existant (skip)
  - `SELECT count(*) FROM pgboss.job WHERE name='resolve-episode' AND data->>'season'='2'` = 1

### Test 4 : Worker résolution complète
- **Given** : Job "resolve-episode" S2E1 en queue
- **When** : Worker traite le job
- **Then** :
  - OG Image uploadée S3 : `og-images/s2e1.png` (200 OK)
  - APIs appelées : Spotify, Apple, Deezer (3 calls)
  - BDD UPDATE : `resolution_status='complete'`
  - Temps total <15s

### Test 5 : Retry API timeout
- **Given** : Job S2E1, API Spotify timeout (10s)
- **When** : Worker traite + échoue
- **Then** :
  - Job marqué `failed` (tentative 1/3)
  - Retry automatique après 60s
  - Tentative 2 : Success → `spotify_status='resolved'`

### Test 6 : Graceful shutdown
- **Given** : 2 jobs actifs en traitement (S2E1, S3E4)
- **When** : SIGTERM envoyé (CleverCloud redeploy)
- **Then** :
  - pg-boss attend 30s max
  - Jobs terminés : S2E1 ✅, S3E4 ✅
  - App shutdown après jobs finis
  - Logs : "✅ Shutdown complete"

---

## Références

**APIs externes** :
- Spotify Web API : https://developer.spotify.com/documentation/web-api
- Apple Podcasts Lookup : https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
- Deezer API : https://developers.deezer.com/api

**Packages** :
- pg-boss : https://github.com/timgit/pg-boss
- Jimp : https://github.com/jimp-dev/jimp

**ADRs liés** :
- ADR-0010 : Superseded (besoin mal compris)
- ADR-0003 : Deployment CleverCloud (PostgreSQL déjà présent)

---

## Validation finale

**Checklist avant implémentation** :
- [x] ADR rédigé avec alternatives analysées
- [x] Décision pg-boss justifiée (vs Redis, vs fire-and-forget)
- [x] Sécurité OWASP A03, A04, A05, A10 couverte
- [x] Critères d'acceptation écrits (6 tests)
- [x] Performance SLO définis
- [x] Monitoring pg-boss documenté
- [x] ✅ Compte Spotify Developer créé (Client ID + Secret)
- [x] ✅ Credentials Spotify ajoutés dans `.env` + CleverCloud
- [x] ✅ **Phase 0 TDD (Spotify)** : Authentification + Recherche show + Récupération épisodes + Matching par date
- [x] ✅ **Phase 0 TDD (Apple)** : Récupération épisodes via `entity=podcastEpisode` + Matching par date + Deeplinks avec trackId
- [x] ✅ **Phase 0 TDD (Deezer)** : Récupération épisodes + Matching par date + Construction deeplinks
- [x] ✅ **Phase 0 TDD (Podcast Addict)** : Découverte pattern deeplink via audioUrl encodée + Test navigateur 301 redirect
- [x] ✅ **Phase 0 TDD complète** : 4 APIs validées (87.14% audience couverte avec deeplinks)
- [ ] **PRÊT POUR PHASE 1** : Implémenter server/services/platformAPIs.js

### Configuration `.env`

```bash
# .env (local + CleverCloud)

# Spotify API (Client Credentials Flow)
SPOTIFY_CLIENT_ID=2ec608bfda5841108e105c76522d684a
SPOTIFY_CLIENT_SECRET=YOUR_SPOTIFY_CLIENT_SECRET_HERE
SPOTIFY_SHOW_ID=07VuGnu0YSacC671s0DQ3a  # "Pas de Charbon, pas de Wafer"

# Apple Podcasts (pas d'auth requise)
APPLE_PODCAST_ID=1846531745

# Deezer (pas d'auth requise)
DEEZER_SHOW_ID=1002292972

# Pocket Casts (UUID podcast)
POCKETCASTS_PODCAST_UUID=bb74e9c5-20e5-5226-8491-d512ad8ebe04
```

**CleverCloud configuration** :
```bash
# Ajouter les variables dans l'interface CleverCloud
clever env set SPOTIFY_CLIENT_ID "2ec608bfda5841108e105c76522d684a"
clever env set SPOTIFY_CLIENT_SECRET "YOUR_SPOTIFY_CLIENT_SECRET_HERE"
```

**⚠️ Sécurité** : Ne JAMAIS commit `.env` dans Git (déjà dans `.gitignore`).

---

**Prochain cycle TDD** : Phase 0 (investigation APIs) → Phase 1 (RED platform search)
