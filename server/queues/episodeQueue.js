/**
 * Episode Queue - pg-boss pour résolution épisodes en background
 * Phase 3 TDD
 */

import PgBoss from 'pg-boss'
import pg from 'pg'
import { 
  searchSpotifyEpisode, 
  searchAppleEpisode, 
  searchDeezerEpisode,
  buildPodcastAddictLink
} from '../services/platformAPIs.js'

const { Client } = pg

let boss = null

/**
 * Initialise pg-boss avec PostgreSQL
 * @returns {Promise<PgBoss>} Instance pg-boss active
 */
export async function initQueue() {
  // Utiliser la même logique de fallback que fastify-postgres
  // CleverCloud expose POSTGRESQL_ADDON_URI, pas forcément DATABASE_URL
  const connectionString = process.env.DATABASE_URL 
    || process.env.POSTGRESQL_ADDON_URI 
    || 'postgresql://salete:salete@localhost:5432/salete';
  
  boss = new PgBoss({
    connectionString,
    schema: 'pgboss'
  })
  
  await boss.start()
  
  // Créer la queue (requis avant send)
  await boss.createQueue('resolve-episode')
  
  return boss
}

/**
 * Récupère l'instance pg-boss (pour cleanup tests)
 * @returns {PgBoss|null}
 */
export function getBoss() {
  return boss
}

/**
 * Enqueue job résolution épisode (avec déduplication)
 * @param {number} season - Numéro saison
 * @param {number} episode - Numéro épisode
 * @param {string} episodeDate - Date publication ISO (YYYY-MM-DD)
 * @param {string} title - Titre épisode  
 * @param {string} imageUrl - URL image cover
 * @returns {Promise<string>} Job ID
 */
export async function queueEpisodeResolution(season, episode, episodeDate, title, imageUrl, feedLastBuildDate = null) {
  return boss.send('resolve-episode', 
    { season, episode, episodeDate, title, imageUrl, feedLastBuildDate },
    {
      singletonKey: `episode-${season}-${episode}`,  // Idempotency key (throttling)
      singletonSeconds: 300  // Throttle 5 min : 1 job max par slot temporel
      // Note: Pas de retryLimit (pas de retry auto, worker doit être idempotent)
    }
  )
}

/**
 * Démarre le worker pour traiter les jobs resolve-episode
 * Worker DOIT être idempotent (vérifier si travail déjà fait avant d'appeler APIs)
 * @param {object} fastify - Instance Fastify avec pool pg
 */
export async function startWorker(fastify) {
  await boss.work('resolve-episode', async (jobs) => {
    // pg-boss v9 passe un array de jobs (batch mode par défaut)
    const job = jobs[0]
    
    const { season, episode, episodeDate, title, imageUrl } = job.data
    
    console.log(`[Worker ${job.id}] Resolving S${season}E${episode}: ${title}`)
    
    // TODO Phase 5: Vérifier si déjà résolu en BDD (idempotent check)
    // const existing = await db.query('SELECT * FROM episode_links WHERE season=$1 AND episode=$2', [season, episode])
    // if (existing.spotify_episode_id) { return } // Déjà fait
    
    // Use episode date from RSS for platform API lookups
    
    // Appeler les APIs en parallèle
    const [spotifyResult, appleResult, deezerResult] = await Promise.allSettled([
      searchSpotifyEpisode(episodeDate),
      searchAppleEpisode(episodeDate),
      searchDeezerEpisode(episodeDate)
    ])
    
    const links = {
      spotify: spotifyResult.status === 'fulfilled' ? spotifyResult.value : null,
      apple: appleResult.status === 'fulfilled' ? appleResult.value : null,
      deezer: deezerResult.status === 'fulfilled' ? deezerResult.value : null
    }
    
    console.log(`[Worker ${job.id}] Resolved:`, links)
    
    // Phase 5: Sauvegarder en BDD (réutilise pool Fastify pour éviter too many connections)
    try {
      const client = await fastify.pg.connect()
      
      try {
        await client.query(`
          INSERT INTO episode_links (season, episode, spotify_url, apple_url, deezer_url, resolved_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (season, episode) 
          DO UPDATE SET
            spotify_url = EXCLUDED.spotify_url,
            apple_url = EXCLUDED.apple_url,
            deezer_url = EXCLUDED.deezer_url,
            resolved_at = NOW()
          WHERE episode_links.spotify_url IS NULL 
             OR episode_links.spotify_url = ''
             OR episode_links.apple_url IS NULL
             OR episode_links.apple_url = ''
             OR episode_links.deezer_url IS NULL
             OR episode_links.deezer_url = ''
        `, [season, episode, links.spotify, links.apple, links.deezer])
        
        console.log(`[Worker ${job.id}] ✅ Saved to database`)
      } finally {
        client.release()
      }
    } catch (dbError) {
      console.error(`[Worker ${job.id}] ❌ Failed to save to database:`, dbError.message)
      // Ne pas throw : le job est marqué completed même si save échoue
      // Les liens seront re-résolus au prochain appel
    }
  })
}

// Note : Worker DOIT être idempotent (vérifier si travail déjà fait avant d'appeler APIs)
// OK de rejouer un job après expiration du slot (300s) si nécessaire
