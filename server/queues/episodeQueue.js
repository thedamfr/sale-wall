/**
 * Episode Queue - pg-boss pour résolution épisodes en background
 * Phase 3 TDD + Phase 3 OG Images
 */

import PgBoss from 'pg-boss'
import { 
  searchSpotifyEpisode, 
  searchAppleEpisode, 
  searchDeezerEpisode
} from '../services/platformAPIs.js'
import { generateOGImage } from '../services/ogImageGenerator.js'
import { uploadToS3, deleteFromS3 } from '../services/s3Service.js'

let boss = null

function getConnectionString() {
  return process.env.DATABASE_URL
    || process.env.POSTGRESQL_ADDON_URI
    || 'postgresql://salete:salete@localhost:5432/salete'
}

async function stopCandidate(candidate) {
  if (!candidate) return

  try {
    await candidate.stop({ graceful: false })
  } catch {
    // Best effort: a failed start can leave pg-boss only partially initialized.
  }
}

async function createStartedQueue(options = {}) {
  const {
    bossFactory = (config) => new PgBoss(config),
    ...bossOptions
  } = options

  const isTest = process.env.NODE_ENV === 'test' || process.env.DISABLE_WORKER === 'true'
  const candidate = bossFactory({
    connectionString: getConnectionString(),
    schema: 'pgboss',
    max: isTest ? 3 : 1,
    newJobCheckInterval: isTest ? 200 : 2000,
    ...bossOptions
  })

  try {
    await candidate.start()
    await candidate.createQueue('resolve-episode')
    return candidate
  } catch (error) {
    await stopCandidate(candidate)
    throw error
  }
}

/**
 * Initialise pg-boss avec PostgreSQL
 * Utilisé directement par les tests de queue. En production, le démarrage
 * atomique passe par initializeEpisodeWorker().
 * @param {object} options - Options pg-boss
 * @returns {Promise<PgBoss>} Instance pg-boss active
 */
export async function initQueue(options = {}) {
  const candidate = await createStartedQueue(options)
  boss = candidate
  return candidate
}

/**
 * Récupère l'instance pg-boss (pour cleanup tests)
 * @returns {PgBoss|null}
 */
export function getBoss() {
  return boss
}

export async function stopQueue(instance = boss) {
  if (!instance) return
  if (boss === instance) boss = null
  await stopCandidate(instance)
}

/**
 * Enqueue job résolution épisode (avec déduplication)
 * @param {number} season - Numéro saison
 * @param {number} episode - Numéro épisode
 * @param {string} episodeDate - Date publication ISO (YYYY-MM-DD)
 * @param {string} title - Titre épisode  
 * @param {string} imageUrl - URL image cover
 * @returns {Promise<string|null>} Job ID ou null si worker désactivé
 */
export async function queueEpisodeResolution(season, episode, episodeDate, title, imageUrl, feedLastBuildDate = null, audioUrl = null) {
  // Safe guard: Si worker pas initialisé (tests avec DISABLE_WORKER=true), retourner null
  if (!boss) {
    console.warn('[queueEpisodeResolution] Worker not initialized, skipping job queue');
    return null;
  }
  
  return boss.send('resolve-episode', 
    { season, episode, episodeDate, title, imageUrl, feedLastBuildDate, audioUrl },
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
 * @param {object} options - Worker options (teamSize pour tests parallèles)
 * @param {PgBoss} queue - Instance explicite pendant l'initialisation atomique
 */
export async function startWorker(fastify, options = {}, queue = boss) {
  if (!queue) {
    throw new Error('Cannot start episode worker before pg-boss is ready')
  }

  const workerOptions = {
    teamSize: options.teamSize || 1, // Nombre de jobs en parallèle (2+ pour tests)
    ...options
  }
  
  await queue.work('resolve-episode', workerOptions, async (jobs) => {
    // pg-boss v9 passe un array de jobs (batch mode par défaut)
    const job = jobs[0]
    
    const { season, episode, episodeDate, title, imageUrl, feedLastBuildDate, audioUrl } = job.data
    
    console.log(`[Worker ${job.id}] Resolving S${season}E${episode}: ${title}`)
    console.log(`[Worker ${job.id}] imageUrl:`, imageUrl, '| feedLastBuildDate:', feedLastBuildDate)
    
    // TODO Phase 5: Vérifier si déjà résolu en BDD (idempotent check)
    // const existing = await db.query('SELECT * FROM episode_links WHERE season=$1 AND episode=$2', [season, episode])
    // if (existing.spotify_episode_id) { return } // Déjà fait
    
    // Use episode date from RSS for platform API lookups
    
    // Phase 3: Générer OG Image (ADR-0012)
    let ogImageUrl = null;
    let ogImageS3Key = null;
    
    try {
      console.log(`[Worker ${job.id}] Generating OG Image from ${imageUrl}`)
      
      // 1. Générer PNG buffer avec blur effect
      const ogImageBuffer = await generateOGImage(imageUrl);
      
      // 2. S3 Key: og-images/s{season}e{episode}.png
      ogImageS3Key = `og-images/s${season}e${episode}.png`;
      
      // 3. Upload PNG vers S3 (cleanup de l'ancienne sera fait dans le bloc DB)
      ogImageUrl = await uploadToS3(ogImageBuffer, ogImageS3Key, 'image/png');
      console.log(`[Worker ${job.id}] ✅ OG Image uploaded: ${ogImageUrl}`);
      
    } catch (ogError) {
      console.error(`[Worker ${job.id}] ⚠️ OG Image generation failed:`, ogError.message);
      console.error(`[Worker ${job.id}] Full error:`, ogError);
      // Continue sans bloquer la résolution des liens plateformes
    }
    
    // Appeler les APIs en parallèle
    const [spotifyResult, appleResult, deezerResult] = await Promise.allSettled([
      searchSpotifyEpisode(episodeDate),
      searchAppleEpisode(episodeDate),
      searchDeezerEpisode(episodeDate)
    ])
    
    // Podcast Addict: Pas d'API publique connue
    // Fallback vers le show au lieu de l'épisode spécifique
    // Format épisode serait : http://podcastaddict.com/{slug}/episode/{episodeId}
    // Mais on n'a pas d'API pour résoudre episodeId
    const podcastAddictId = process.env.PODCASTADDICT_PODCAST_ID;
    const podcastAddictLink = podcastAddictId 
      ? `https://podcastaddict.com/podcast/${podcastAddictId}`
      : null;
    
    const links = {
      spotify: spotifyResult.status === 'fulfilled' ? spotifyResult.value : null,
      apple: appleResult.status === 'fulfilled' ? appleResult.value : null,
      deezer: deezerResult.status === 'fulfilled' ? deezerResult.value : null,
      podcastAddict: podcastAddictLink
    }
    
    console.log(`[Worker ${job.id}] Resolved:`, links)
    
    // Phase 5: Sauvegarder en BDD (réutilise pool Fastify pour éviter too many connections)
    try {
      const client = await fastify.pg.connect()
      
      try {
        // Phase 3.1: Cleanup - SELECT ancienne OG Image si existe, puis DELETE de S3
        if (ogImageUrl) { // Si on a généré une nouvelle OG Image
          const existingResult = await client.query(
            'SELECT og_image_s3_key FROM episode_links WHERE season = $1 AND episode = $2',
            [season, episode]
          );
          
          if (existingResult.rows.length > 0 && existingResult.rows[0].og_image_s3_key) {
            const oldKey = existingResult.rows[0].og_image_s3_key;
            // Ne pas delete si c'est la même clé (idempotence)
            if (oldKey !== ogImageS3Key) {
              console.log(`[Worker ${job.id}] Deleting old OG Image: ${oldKey}`);
              await deleteFromS3(oldKey);
            }
          }
        }
        
        // Phase 3.2: Sauvegarder platform links + OG Image
        await client.query(`
          INSERT INTO episode_links (
            season, episode, 
            spotify_url, apple_url, deezer_url, podcast_addict_url,
            og_image_url, og_image_s3_key, feed_last_build, generated_at,
            resolved_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          ON CONFLICT (season, episode) 
          DO UPDATE SET
            spotify_url = COALESCE(EXCLUDED.spotify_url, episode_links.spotify_url),
            apple_url = COALESCE(EXCLUDED.apple_url, episode_links.apple_url),
            deezer_url = COALESCE(EXCLUDED.deezer_url, episode_links.deezer_url),
            podcast_addict_url = COALESCE(EXCLUDED.podcast_addict_url, episode_links.podcast_addict_url),
            og_image_url = COALESCE(EXCLUDED.og_image_url, episode_links.og_image_url),
            og_image_s3_key = COALESCE(EXCLUDED.og_image_s3_key, episode_links.og_image_s3_key),
            feed_last_build = COALESCE(EXCLUDED.feed_last_build, episode_links.feed_last_build),
            generated_at = CASE 
              WHEN EXCLUDED.og_image_url IS NOT NULL THEN NOW() 
              ELSE episode_links.generated_at 
            END,
            resolved_at = NOW()
        `, [
          season, 
          episode, 
          links.spotify, 
          links.apple, 
          links.deezer,
          links.podcastAddict,
          ogImageUrl,
          ogImageS3Key,
          feedLastBuildDate
        ])
        
        console.log(`[Worker ${job.id}] ✅ Saved to database (OG Image: ${ogImageUrl ? 'YES' : 'NO'})`)
      } finally {
        client.release()
      }
    } catch (dbError) {
      console.error(`[Worker ${job.id}] ❌ Failed to save to database:`, dbError.message)
      // Ne pas throw : le job est marqué completed même si save échoue
      // Les liens seront re-résolus au prochain appel
    }
    
    // IMPORTANT: pg-boss attend un return pour marquer le job comme completed
    return { links, ogImageUrl }
  })
}

/**
 * Démarre la queue et enregistre le worker avant de publier l'instance globale.
 * Une tentative échouée ne peut donc jamais être utilisée par send().
 */
export async function initializeEpisodeWorker(fastify, {
  queueOptions = {},
  workerOptions = {}
} = {}) {
  let candidate = null

  try {
    candidate = await createStartedQueue(queueOptions)
    await startWorker(fastify, workerOptions, candidate)
    boss = candidate
    return candidate
  } catch (error) {
    if (boss === candidate) boss = null
    await stopCandidate(candidate)
    throw error
  }
}

// Note : Worker DOIT être idempotent (vérifier si travail déjà fait avant d'appeler APIs)
// OK de rejouer un job après expiration du slot (300s) si nécessaire
