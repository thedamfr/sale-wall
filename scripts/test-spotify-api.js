/**
 * Phase 0 TDD - Test Spotify API Authentication
 * Valide que les credentials fonctionnent avant implémentation des services
 */

import 'dotenv/config'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search'

/**
 * Obtient un token d'accès Spotify (Client Credentials flow)
 */
async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET requis dans .env')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  console.log('🔑 Authentification Spotify...')
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Spotify auth failed: ${response.status} - ${error}`)
  }

  const data = await response.json()
  console.log('✅ Token obtenu:', {
    token_type: data.token_type,
    expires_in: data.expires_in,
    access_token: data.access_token.substring(0, 20) + '...'
  })

  return data.access_token
}

/**
 * Recherche un podcast (show) sur Spotify
 */
async function searchSpotifyShow(token, query) {
  console.log(`\n🔍 Recherche show Spotify: "${query}"`)

  const params = new URLSearchParams({
    q: query,
    type: 'show',
    limit: 5,
    market: 'FR'
  })

  const response = await fetch(`${SPOTIFY_SEARCH_URL}?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Spotify search failed: ${response.status} - ${error}`)
  }

  const data = await response.json()
  console.log(`✅ ${data.shows?.items?.length || 0} shows trouvés`)

  return data.shows?.items || []
}

/**
 * Récupère les épisodes d'un show
 */
async function getShowEpisodes(token, showId) {
  console.log(`\n📻 Récupération des épisodes du show ${showId}`)

  const response = await fetch(`https://api.spotify.com/v1/shows/${showId}/episodes?market=FR&limit=50`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Spotify episodes failed: ${response.status} - ${error}`)
  }

  const data = await response.json()
  console.log(`✅ ${data.items?.length || 0} épisodes trouvés`)

  return data.items || []
}

/**
 * Recherche un épisode spécifique dans un show
 */
async function searchEpisodeInShow(token, showId, episodeTitle) {
  console.log(`\n🎯 Recherche épisode "${episodeTitle}" dans show ${showId}`)

  // Méthode 1: Recherche globale avec filtrage par show
  const params = new URLSearchParams({
    q: `${episodeTitle} show:${showId}`,
    type: 'episode',
    limit: 10,
    market: 'FR'
  })

  const response = await fetch(`${SPOTIFY_SEARCH_URL}?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Spotify episode search failed: ${response.status} - ${error}`)
  }

  const data = await response.json()
  console.log(`✅ ${data.episodes?.items?.length || 0} épisodes trouvés`)

  return data.episodes?.items || []
}

/**
 * Recherche un épisode de podcast sur Spotify
 */
async function searchSpotifyEpisode(token, query) {
  console.log(`\n🔍 Recherche Spotify: "${query}"`)

  const params = new URLSearchParams({
    q: query,
    type: 'episode',
    limit: 5,
    market: 'FR'
  })

  const response = await fetch(`${SPOTIFY_SEARCH_URL}?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Spotify search failed: ${response.status} - ${error}`)
  }

  const data = await response.json()
  console.log(`✅ ${data.episodes?.items?.length || 0} résultats trouvés`)

  return data.episodes?.items || []
}

/**
 * Test principal
 */
async function main() {
  try {
    console.log('=== Test Spotify API (Phase 0) ===\n')

    // Test 1: Authentification
    const token = await getSpotifyToken()

    // Test 2: Recherche du show "Charbon et Wafer"
    const shows = await searchSpotifyShow(token, 'Charbon et Wafer')

    if (shows.length > 0) {
      console.log('\n📋 Shows trouvés:')
      shows.forEach((show, i) => {
        console.log(`\n${i + 1}. ${show.name}`)
        console.log(`   ID: ${show.id}`)
        console.log(`   Publisher: ${show.publisher}`)
        console.log(`   URL: ${show.external_urls.spotify}`)
        console.log(`   Total episodes: ${show.total_episodes}`)
      })

      // Test 3: Récupérer les épisodes du premier show
      const firstShow = shows[0]
      const episodes = await getShowEpisodes(token, firstShow.id)

      if (episodes.length > 0) {
        console.log('\n📋 Premiers épisodes:')
        episodes.slice(0, 3).forEach((ep, i) => {
          console.log(`\n${i + 1}. ${ep.name}`)
          console.log(`   ID: ${ep.id}`)
          console.log(`   URI: ${ep.uri}`)
          console.log(`   🎯 DEEPLINK: ${ep.external_urls.spotify}`)
          console.log(`   Release: ${ep.release_date}`)
          console.log(`   Durée: ${Math.floor(ep.duration_ms / 1000 / 60)}min`)
          
          // Afficher les métadonnées disponibles pour saison/épisode
          const seasonInfo = []
          if (ep.type) seasonInfo.push(`type: ${ep.type}`)
          if (ep.episode_number !== undefined) seasonInfo.push(`episode: ${ep.episode_number}`)
          if (ep.season_number !== undefined) seasonInfo.push(`season: ${ep.season_number}`)
          if (seasonInfo.length > 0) {
            console.log(`   📊 ${seasonInfo.join(', ')}`)
          }
        })

        // Afficher TOUS les épisodes pour voir la structure complète
        console.log('\n📋 Liste complète des épisodes:')
        episodes.forEach((ep, i) => {
          const season = ep.season_number !== undefined ? `S${ep.season_number}` : '??'
          const episode = ep.episode_number !== undefined ? `E${ep.episode_number}` : '??'
          console.log(`${i + 1}. [${season}${episode}] ${ep.name}`)
        })

        // Test 4: Matching d'un épisode spécifique par date
        console.log('\n🎯 Test de matching par date de publication:')
        
        // Simuler une date du RSS (format: Mon, 27 Oct 2025 22:13:48 +0000)
        const rssDate = new Date('Mon, 27 Oct 2025 22:13:48 +0000')
        const rssDateOnly = rssDate.toISOString().split('T')[0] // 2025-10-27
        
        console.log(`   Recherche RSS date: ${rssDateOnly}`)
        
        const matchedByDate = episodes.find(ep => ep.release_date === rssDateOnly)
        
        if (matchedByDate) {
          console.log(`   ✅ Trouvé par date: ${matchedByDate.name}`)
          console.log(`   DEEPLINK: ${matchedByDate.external_urls.spotify}`)
          console.log(`   ID: ${matchedByDate.id}`)
        } else {
          console.log('   ❌ Pas trouvé par date')
        }
      }
    } else {
      console.log('\n⚠️  Aucun show "Charbon et Wafer" trouvé sur Spotify')
      console.log('   Le podcast est-il soumis via Castopod → Spotify ?')
    }

    console.log('\n✅ Tests Phase 0 réussis!')
    console.log('   Prochaine étape: Implémenter server/services/platformAPIs.js')

  } catch (error) {
    console.error('\n❌ Erreur:', error.message)
    process.exit(1)
  }
}

main()
