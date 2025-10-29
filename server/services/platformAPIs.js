/**
 * Platform APIs - Services de résolution des deeplinks podcast
 * Phase 1 TDD - Implémentation minimale
 */

export async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify credentials')
  }

  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.status}`)
  }

  const data = await response.json()
  return data.access_token
}

export async function searchSpotifyEpisode(episodeDate) {
  const token = await getSpotifyToken()
  const showId = process.env.SPOTIFY_SHOW_ID
  
  const response = await fetch(`https://api.spotify.com/v1/shows/${showId}/episodes?limit=50`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  if (!response.ok) {
    return null
  }
  
  const data = await response.json()
  const episode = data.items.find(ep => ep.release_date === episodeDate)
  
  return episode ? episode.external_urls.spotify : null
}

export async function searchAppleEpisode(episodeDate) {
  const podcastId = process.env.APPLE_PODCAST_ID
  
  const response = await fetch(
    `https://itunes.apple.com/lookup?id=${podcastId}&entity=podcastEpisode&limit=200`
  )
  
  if (!response.ok) {
    return null
  }
  
  const data = await response.json()
  const episodes = data.results.filter(item => item.wrapperType === 'podcastEpisode')
  const episode = episodes.find(ep => ep.releaseDate.split('T')[0] === episodeDate)
  
  return episode ? episode.trackViewUrl : null
}

export async function searchDeezerEpisode(episodeDate) {
  const showId = process.env.DEEZER_SHOW_ID
  
  const response = await fetch(`https://api.deezer.com/podcast/${showId}/episodes?limit=50`)
  
  if (!response.ok) {
    return null
  }
  
  const data = await response.json()
  const episode = data.data.find(ep => ep.release_date.split(' ')[0] === episodeDate)
  
  return episode ? `https://www.deezer.com/fr/episode/${episode.id}` : null
}

export function buildPodcastAddictLink(audioUrl) {
  if (!audioUrl || audioUrl.trim() === '') {
    throw new Error('audioUrl required')
  }
  
  const encodedUrl = encodeURIComponent(audioUrl)
  const podcastId = process.env.PODCASTADDICT_PODCAST_ID
  
  return `https://podcastaddict.com/episode/${encodedUrl}&podcastId=${podcastId}`
}

export function buildFallbackLinks() {
  const spotifyShowId = process.env.SPOTIFY_SHOW_ID
  const applePodcastId = process.env.APPLE_PODCAST_ID
  const deezerShowId = process.env.DEEZER_SHOW_ID
  const podcastAddictId = process.env.PODCASTADDICT_PODCAST_ID
  const pocketCastsUuid = process.env.POCKETCASTS_PODCAST_UUID
  const castopodUrl = process.env.CASTOPOD_RSS_URL || 'https://podcasts.saletesincere.fr/@charbonwafer/feed.xml'
  
  return {
    spotify: `https://open.spotify.com/show/${spotifyShowId}`,
    apple: `https://podcasts.apple.com/fr/podcast/id${applePodcastId}`,
    deezer: `https://www.deezer.com/fr/show/${deezerShowId}`,
    podcastAddict: `https://podcastaddict.com/podcast/${podcastAddictId}`,
    antennapod: castopodUrl,
    pocketCasts: `https://pca.st/podcast/${pocketCastsUuid}`,
    overcast: `https://overcast.fm/itunes${applePodcastId}`,
    castopod: castopodUrl
  }
}
