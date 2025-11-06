/**
 * Episode Queue - pg-boss pour résolution épisodes en background
 * Phase 3 TDD + Phase 3 OG Images
 */

import PgBoss from 'pg-boss'
import pg from 'pg'
import { 
  searchSpotifyEpisode, 
  searchAppleEpisode, 
  searchDeezerEpisode,
  buildPodcastAddictLink
} from '../services/platformAPIs.js'
import { generateOGImage } from '../services/ogImageGenerator.js'
import { uploadToS3, deleteFromS3 } from '../services/s3Service.js'

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
    
    const { season, episode, episodeDate, title, imageUrl, feedLastBuildDate } = job.data
    
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
      
      // 3. Cleanup: DELETE ancienne OG Image si existe
      const client = await fastify.pg.connect();
      try {
        const existingResult = await client.query(
          'SELECT og_image_s3_key FROM episode_links WHERE season = $1 AND episode = $2',
          [season, episode]
        );
        
        if (existingResult.rows.length > 0 && existingResult.rows[0].og_image_s3_key) {
          const oldKey = existingResult.rows[0].og_image_s3_key;
          console.log(`[Worker ${job.id}] Deleting old OG Image: ${oldKey}`);
          await deleteFromS3(oldKey);
        }
      } finally {
        client.release();
      }
      
      // 4. Upload nouveau PNG vers S3
      ogImageUrl = await uploadToS3(ogImageBuffer, ogImageS3Key, 'image/png');
      console.log(`[Worker ${job.id}] ✅ OG Image uploaded: ${ogImageUrl}`);
      
    } catch (ogError) {
      console.error(`[Worker ${job.id}] ⚠️ OG Image generation failed:`, ogError.message);
      // Continue sans bloquer la résolution des liens plateformes
    }
    
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
        // Phase 3: Sauvegarder aussi OG Image (colonnes ajoutées en Phase 4 migration)
        await client.query(`
          INSERT INTO episode_links (
            season, episode, 
            spotify_url, apple_url, deezer_url, 
            og_image_url, og_image_s3_key, feed_last_build, generated_at,
            resolved_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          ON CONFLICT (season, episode) 
          DO UPDATE SET
            spotify_url = COALESCE(EXCLUDED.spotify_url, episode_links.spotify_url),
            apple_url = COALESCE(EXCLUDED.apple_url, episode_links.apple_url),
            deezer_url = COALESCE(EXCLUDED.deezer_url, episode_links.deezer_url),
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
  })
}

// Note : Worker DOIT être idempotent (vérifier si travail déjà fait avant d'appeler APIs)
// OK de rejouer un job après expiration du slot (300s) si nécessaire
