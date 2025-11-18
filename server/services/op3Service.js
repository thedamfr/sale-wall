/**
 * Refresh OP3 stats cache (stub for queue)
 * To be implemented: fetch and update cache
 */
export async function refreshOp3StatsCache() {
  // Minimal stub for TDD
  return true;
}
/**
 * OP3 Service - Fetch episode download statistics
 * ADR-0015: OP3 Stats Integration for Social Proof
 * 
 * Architecture:
 * 1. Boot-time: GUID → Show UUID lookup (cached in memory)
 * 2. Daily: Fetch all episodes stats → PostgreSQL cache (24h)
 * 3. Page load: Read from cache (fast, no API calls)
 */

import pg from 'pg';

const { Pool } = pg;

// In-memory cache for show UUID (loaded once at boot)
let cachedShowUuid = null;

/**
 * Lookup OP3 show UUID from podcast GUID
 * @returns {Promise<string>} OP3 show UUID
 */
export async function getShowUuid() {
  if (cachedShowUuid) {
    return cachedShowUuid;
  }

  const OP3_API_TOKEN = process.env.OP3_API_TOKEN;
  const OP3_GUID = process.env.OP3_GUID;

  if (!OP3_API_TOKEN || !OP3_GUID) {
    throw new Error('Missing OP3_API_TOKEN or OP3_GUID in .env');
  }

  const response = await fetch(`https://op3.dev/api/1/shows/${OP3_GUID}`, {
    headers: {
      'Authorization': `Bearer ${OP3_API_TOKEN}`,
      'User-Agent': 'SaleteSincere/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`OP3 show lookup failed: ${response.status}`);
  }

  const data = await response.json();
  cachedShowUuid = data.showUuid;
  
  console.log(`[OP3] Show UUID cached: ${cachedShowUuid}`);
  return cachedShowUuid;
}

/**
 * Fetch fresh episode stats from OP3 API
 * @returns {Promise<Array>} Array of { itemGuid, downloadsAll, downloads30 }
 */
export async function fetchEpisodeStatsFromOP3() {
  const showUuid = await getShowUuid();
  const OP3_API_TOKEN = process.env.OP3_API_TOKEN;

  const response = await fetch(
    `https://op3.dev/api/1/queries/episode-download-counts?showUuid=${showUuid}`,
    {
      headers: {
        'Authorization': `Bearer ${OP3_API_TOKEN}`,
        'User-Agent': 'SaleteSincere/1.0'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`OP3 stats fetch failed: ${response.status}`);
  }

  const data = await response.json();
  
  return data.episodes.map(ep => ({
    itemGuid: ep.itemGuid,
    downloadsAll: ep.downloadsAll || 0,
    downloads30: ep.downloads30 || null
  }));
}

/**
 * Update OP3 stats cache in PostgreSQL
 * @param {Pool} pool - PostgreSQL connection pool
 * @returns {Promise<number>} Number of episodes updated
 */
export async function updateOP3StatsCache(pool) {
  try {
    const episodes = await fetchEpisodeStatsFromOP3();
    
    let updatedCount = 0;
    for (const ep of episodes) {
      await pool.query(`
        INSERT INTO op3_stats (item_guid, downloads_all, downloads_30, fetched_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (item_guid) DO UPDATE
        SET downloads_all = $2, downloads_30 = $3, fetched_at = NOW()
      `, [ep.itemGuid, ep.downloadsAll, ep.downloads30]);
      
      updatedCount++;
    }
    
    console.log(`[OP3] Updated ${updatedCount} episodes in cache`);
    return updatedCount;
    
  } catch (err) {
    console.error('[OP3] Failed to update stats cache:', err.message);
    throw err;
  }
}

/**
 * Get episode stats from cache
 * @param {Pool} pool - PostgreSQL connection pool
 * @param {string} itemGuid - RSS item guid
 * @returns {Promise<Object|null>} { downloadsAll, downloads30, cached: true } or null
 */
export async function getEpisodeStats(pool, itemGuid) {
  const result = await pool.query(`
    SELECT downloads_all, downloads_30, fetched_at
    FROM op3_stats
    WHERE item_guid = $1
    AND fetched_at > NOW() - INTERVAL '24 hours'
  `, [itemGuid]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    downloadsAll: row.downloads_all,
    downloads30: row.downloads_30,
    fetchedAt: row.fetched_at,
    cached: true
  };
}

/**
 * Format stats for UI display
 * @param {number} downloads - Number of downloads
 * @returns {string|null} "128 écoutes" or "1.2k écoutes" or null if < 10
 */
export function formatStatsForDisplay(downloads) {
  if (!downloads || downloads < 10) {
    return null;
  }

  if (downloads >= 1000) {
    return `${(downloads / 1000).toFixed(1)}k écoutes`;
  }

  return `${downloads} écoutes`;
}

/**
 * Initialize OP3 service at boot (preload show UUID)
 * @returns {Promise<void>}
 */
export async function initOP3Service() {
  try {
    await getShowUuid();
    console.log('[OP3] Service initialized');
  } catch (err) {
    console.warn('[OP3] Service init failed (stats will be unavailable):', err.message);
  }
}
