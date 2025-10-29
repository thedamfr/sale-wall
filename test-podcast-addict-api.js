/**
 * Phase 0 TDD - Test Podcast Addict
 * Investigation pour trouver des deeplinks épisodes
 */

import 'dotenv/config'

async function testPodcastAddict() {
  console.log('=== Investigation Podcast Addict ===\n')
  
  // URL connue du podcast
  const podcastUrl = 'https://podcastaddict.com/podcast/pas-de-charbon-pas-de-wafer/6137997'
  
  console.log(`📋 URL du podcast: ${podcastUrl}`)
  
  // Test 1: Scraping de la page pour trouver la structure des URLs
  console.log('\n🔍 Test 1: Récupération de la page HTML...')
  
  const response = await fetch(podcastUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  })
  
  if (!response.ok) {
    console.log(`❌ Erreur ${response.status}`)
    return
  }
  
  const html = await response.text()
  
  // Chercher des patterns d'URLs d'épisodes
  const episodeLinks = html.match(/https?:\/\/podcastaddict\.com\/[^"'>\s]+/g) || []
  const uniqueLinks = [...new Set(episodeLinks)]
  
  console.log(`✅ ${uniqueLinks.length} liens uniques trouvés`)
  
  // Filtrer les liens qui ressemblent à des épisodes
  const episodePatterns = uniqueLinks.filter(link => 
    link.includes('/episode/') || 
    link.includes('/podcast/') && link.split('/').length > 5
  )
  
  if (episodePatterns.length > 0) {
    console.log('\n📋 Patterns d\'URLs d\'épisodes:')
    episodePatterns.slice(0, 5).forEach(link => {
      console.log(`   ${link}`)
    })
  }
  
  // Test 2: Chercher un feed JSON/API
  console.log('\n🔍 Test 2: Chercher un feed API...')
  
  // Tester si Podcast Addict expose un feed JSON
  const feedUrls = [
    `https://podcastaddict.com/feed/6137997`,
    `https://api.podcastaddict.com/podcast/6137997`,
    `https://podcastaddict.com/api/v1/podcast/6137997`,
  ]
  
  for (const feedUrl of feedUrls) {
    try {
      const feedResponse = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      })
      
      if (feedResponse.ok) {
        const contentType = feedResponse.headers.get('content-type')
        console.log(`   ✅ ${feedUrl}`)
        console.log(`      Content-Type: ${contentType}`)
        
        const text = await feedResponse.text()
        console.log(`      Taille: ${text.length} bytes`)
        
        // Tenter de parser en JSON
        try {
          const json = JSON.parse(text)
          console.log(`      📦 JSON valide:`, Object.keys(json))
        } catch {
          console.log(`      📄 Texte/HTML (non JSON)`)
        }
      } else {
        console.log(`   ❌ ${feedUrl} (${feedResponse.status})`)
      }
    } catch (error) {
      console.log(`   ❌ ${feedUrl} (erreur réseau)`)
    }
  }
  
  // Test 3: Structure des deeplinks
  console.log('\n🔍 Test 3: Hypothèses sur la structure des deeplinks...')
  console.log('   Pattern observé: https://podcastaddict.com/podcast/{slug}/{podcast_id}')
  console.log('   Pattern épisode possible:')
  console.log('     - https://podcastaddict.com/episode/{episode_id}')
  console.log('     - https://podcastaddict.com/podcast/{slug}/{podcast_id}/{episode_id}')
  console.log('     - https://podcastaddict.com/podcast/{podcast_id}/episode/{episode_id}')
  
  console.log('\n💡 Recherche dans le HTML des identifiants d\'épisodes...')
  
  // Chercher des patterns data-episode-id ou similaires
  const dataEpisodeMatches = html.match(/data-episode[^=]*="([^"]+)"/g) || []
  const episodeIdMatches = html.match(/episode[_-]?id[^0-9]*([0-9]+)/gi) || []
  
  if (dataEpisodeMatches.length > 0) {
    console.log(`   Trouvé ${dataEpisodeMatches.length} attributs data-episode`)
    console.log('   Exemples:', dataEpisodeMatches.slice(0, 3))
  }
  
  if (episodeIdMatches.length > 0) {
    console.log(`   Trouvé ${episodeIdMatches.length} mentions d'episode_id`)
    console.log('   Exemples:', episodeIdMatches.slice(0, 3))
  }
  
  console.log('\n📌 Conclusion:')
  console.log('   - Podcast Addict n\'a pas d\'API publique documentée')
  console.log('   - Les deeplinks épisodes nécessitent un episode_id non accessible via API')
  console.log('   - Options:')
  console.log('     1. Scraping HTML (fragile, contraire aux CGU)')
  console.log('     2. Fallback vers l\'URL du podcast (utilisateur navigue manuellement)')
  console.log('     3. Lien vers le RSS feed pour ouverture dans l\'app')
}

async function main() {
  try {
    await testPodcastAddict()
  } catch (error) {
    console.error('\n❌ Erreur:', error.message)
    process.exit(1)
  }
}

main()
