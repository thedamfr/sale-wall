/**
 * Episode Queue - pg-boss pour résolution épisodes en background
 * Phase 3 TDD
 */

import PgBoss from 'pg-boss'

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
      singletonKey: `episode-${season}-${episode}`
    }
  )
}
