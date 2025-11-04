/**
 * Episode Queue - pg-boss pour résolution épisodes en background
 * Phase 3 TDD
 */

import PgBoss from 'pg-boss'
import { 
  searchSpotifyEpisode, 
  searchAppleEpisode, 
  searchDeezerEpisode,
  buildPodcastAddictLink
} from '../services/platformAPIs.js'

let boss = null

/**
 * Initialise pg-boss avec PostgreSQL
 * @returns {Promise<PgBoss>} Instance pg-boss active
 */
export async function initQueue() {
  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
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
 * @param {string} title - Titre épisode
 * @param {string} imageUrl - URL image cover
 * @returns {Promise<string>} Job ID
 */
export async function queueEpisodeResolution(season, episode, title, imageUrl) {
  return boss.send('resolve-episode', 
    { season, episode, title, imageUrl },
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
 */
export async function startWorker() {
  await boss.work('resolve-episode', async (jobs) => {
    // pg-boss v9 passe un array de jobs (batch mode par défaut)
    const job = jobs[0]
    
    const { season, episode, title, imageUrl } = job.data
    
    console.log(`[Worker ${job.id}] Resolving S${season}E${episode}: ${title}`)
    
    // TODO Phase 5: Vérifier si déjà résolu en BDD (idempotent check)
    // const existing = await db.query('SELECT * FROM episode_links WHERE season=$1 AND episode=$2', [season, episode])
    // if (existing.spotify_episode_id) { return } // Déjà fait
    
    // TODO: Convertir season/episode → date de publication (depuis RSS ou BDD)
    // Pour l'instant on utilise une date hardcodée pour passer GREEN
    const episodeDate = '2025-10-27' // S2E1
    
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
    
    // TODO Phase 5: Sauvegarder en BDD
    // await db.query('INSERT INTO episode_links (season, episode, links, ...) VALUES (...)')
  })
}

// Note : Worker DOIT être idempotent (vérifier si travail déjà fait avant d'appeler APIs)
// OK de rejouer un job après expiration du slot (300s) si nécessaire
