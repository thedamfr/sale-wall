import { XMLParser } from 'fast-xml-parser';

const RSS_URL = 'https://podcasts.saletesincere.fr/@charbonwafer/feed.xml';

/**
 * Fetch episode metadata from Castopod RSS feed
 * @param {number} season - Season number (1-based)
 * @param {number} episode - Episode number (1-based)
 * @param {number} timeout - Fetch timeout in ms (default 5000)
 * @returns {Promise<EpisodeData|null>} Episode data or null if not found
 * @throws {Error} On network timeout or parse error
 */
export async function fetchEpisodeFromRSS(season, episode, timeout = 5000) {
  // Timeout implementation
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Fetch RSS
    const response = await fetch(RSS_URL, {
      signal: controller.signal,
      redirect: 'manual'
    });

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status}`);
    }

    const xmlText = await response.text();

    // Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    const rss = parser.parse(xmlText);

    // Extract feed-level lastBuildDate (channel-level, not item-level)
    const feedLastBuildDate = rss.rss?.channel?.lastBuildDate || null;

    // Find episode matching season and episode number
    const items = rss.rss?.channel?.item || [];
    const itemsArray = Array.isArray(items) ? items : [items];

    const matchedItem = itemsArray.find(item => {
      const itemSeason = parseInt(item['itunes:season']);
      const itemEpisode = parseInt(item['itunes:episode']);
      return itemSeason === season && itemEpisode === episode;
    });

    if (!matchedItem) {
      return null;
    }

    // Extract data
    const durationSeconds = parseInt(matchedItem['itunes:duration']);
    const pubDate = new Date(matchedItem.pubDate);

    // Strip HTML from description and decode entities
    const descriptionHtml = matchedItem.description || '';
    const descriptionRaw = descriptionHtml
      .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    const MAX_DESC_LENGTH = 400;
    const isTruncated = descriptionRaw.length > MAX_DESC_LENGTH;
    const descriptionText = isTruncated 
      ? descriptionRaw.substring(0, MAX_DESC_LENGTH).trim() + '...'
      : descriptionRaw;

    // Clean title (trim and decode entities)
    const titleClean = (matchedItem.title || '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return {
      season: parseInt(matchedItem['itunes:season']),
      episode: parseInt(matchedItem['itunes:episode']),
      title: titleClean,
      description: descriptionText,
      isTruncated, // Flag pour afficher "Lire la suite"
      pubDate: formatDateFrench(pubDate),
      rawPubDate: pubDate.toISOString().split('T')[0], // YYYY-MM-DD pour smartlinks
      duration: formatDuration(durationSeconds),
      image: matchedItem['itunes:image']?.['@_href'] || null,
      audioUrl: matchedItem.enclosure?.['@_url'] || '',
      episodeLink: matchedItem.link || '', // Castopod episode page
      feedLastBuildDate // Channel-level lastBuildDate pour cache invalidation OG Images
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Format duration from seconds to MM:SS or HH:MM:SS
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format date in French (e.g., "27 octobre 2025")
 * @param {Date} date
 * @returns {string}
 */
function formatDateFrench(date) {
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * @typedef {Object} EpisodeData
 * @property {number} season - Season number
 * @property {number} episode - Episode number
 * @property {string} title - Episode title
 * @property {string} description - Episode summary (plain text, max 300 chars)
 * @property {boolean} isTruncated - Whether description was truncated
 * @property {string} pubDate - Formatted date "27 octobre 2025"
 * @property {string} rawPubDate - ISO date "2025-10-27" for APIs
 * @property {string} duration - Formatted duration "43:11" or "1:43:11"
 * @property {string|null} image - Episode cover URL or null
 * @property {string} audioUrl - MP3 direct link
 * @property {string} episodeLink - Castopod episode page URL
 * @property {string|null} feedLastBuildDate - RSS channel lastBuildDate (for OG image cache invalidation)
 */
