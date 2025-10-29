/**
 * Tests pour platformAPIs.js - Services de résolution des deeplinks
 * 
 * Phase 1 TDD - Liste des tests à implémenter :
 * 
 * getSpotifyToken()
 * ✅ 1. Should authenticate with Spotify and return access token
 * ✅ 2. Should throw error if credentials missing
 * 
 * searchSpotifyEpisode(episodeDate)
 * ✅ 3. Should find episode by date and return deeplink
 * ✅ 4. Should return null if episode not found
 * 
 * searchAppleEpisode(episodeDate)
 * ✅ 5. Should find episode by date and return deeplink
 * ✅ 6. Should return null if episode not found
 * 
 * searchDeezerEpisode(episodeDate)
 * ✅ 7. Should find episode by date and return deeplink
 * ✅ 8. Should return null if episode not found
 * 
 * buildPodcastAddictLink(audioUrl)
 * ✅ 9. Should encode audioUrl and build deeplink
 * ✅ 10. Should throw error if audioUrl missing
 * 
 * buildFallbackLinks()
 * ✅ 11. Should return fallback URLs for all platforms
 */

import 'dotenv/config'
import { describe, test } from 'node:test'
import assert from 'node:assert'
import {
  getSpotifyToken,
  searchSpotifyEpisode,
  searchAppleEpisode,
  searchDeezerEpisode,
  buildPodcastAddictLink,
  buildFallbackLinks
} from '../../server/services/platformAPIs.js'

describe('platformAPIs', () => {
  describe('getSpotifyToken', () => {
    test('should authenticate with Spotify and return access token', async () => {
      const token = await getSpotifyToken()
      
      assert.ok(token, 'Token should be defined')
      assert.strictEqual(typeof token, 'string')
      assert.ok(token.length > 0, 'Token should not be empty')
    })

    test('should return a valid token that works with Spotify API', async () => {
      const token = await getSpotifyToken()
      
      // Teste que le token fonctionne en appelant l'API shows
      const response = await fetch(`https://api.spotify.com/v1/shows/${process.env.SPOTIFY_SHOW_ID}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      assert.strictEqual(response.ok, true, 'Token should work with Spotify API')
    })
    
    test('should throw error if credentials missing', async () => {
      const originalClientId = process.env.SPOTIFY_CLIENT_ID
      const originalClientSecret = process.env.SPOTIFY_CLIENT_SECRET
      
      delete process.env.SPOTIFY_CLIENT_ID
      delete process.env.SPOTIFY_CLIENT_SECRET
      
      await assert.rejects(
        async () => await getSpotifyToken(),
        /Missing Spotify credentials/
      )
      
      process.env.SPOTIFY_CLIENT_ID = originalClientId
      process.env.SPOTIFY_CLIENT_SECRET = originalClientSecret
    })
  })
  
  describe('searchSpotifyEpisode', () => {
    test('should find episode by date and return deeplink', async () => {
      const episodeDate = '2025-10-27'
      
      const deeplink = await searchSpotifyEpisode(episodeDate)
      
      assert.ok(deeplink, 'Deeplink should be defined')
      assert.ok(deeplink.includes('https://open.spotify.com/episode/'))
      assert.ok(deeplink.includes('4uuRA1SjUKWPI3G0NmpCQx')) // ID épisode S2E1
    })

    test('should find different episode for different date', async () => {
      const episodeDate = '2025-10-17' // Bande-Annonce Saison Pilote
      
      const deeplink = await searchSpotifyEpisode(episodeDate)
      
      assert.ok(deeplink, 'Deeplink should be defined')
      assert.ok(deeplink.includes('https://open.spotify.com/episode/'))
      assert.ok(deeplink.includes('1vUiAyqm9uaNYOFS1CKkcH'), 'Should be bande-annonce ID')
      assert.ok(!deeplink.includes('4uuRA1SjUKWPI3G0NmpCQx'), 'Should NOT be S2E1 ID')
    })

    test('should find third different episode', async () => {
      const episodeDate = '2025-10-15' // BOUCLIER 🛡️
      
      const deeplink = await searchSpotifyEpisode(episodeDate)
      
      assert.ok(deeplink, 'Deeplink should be defined')
      assert.ok(deeplink.includes('https://open.spotify.com/episode/'))
      assert.ok(deeplink.includes('55hcQ7NGJfzfo8sMCXBsrx'), 'Should be BOUCLIER ID')
    })
    
    test('should return null if episode not found', async () => {
      const episodeDate = '2099-12-31' // Date future
      
      const deeplink = await searchSpotifyEpisode(episodeDate)
      
      assert.strictEqual(deeplink, null)
    })
  })
  
  describe('searchAppleEpisode', () => {
    test('should find episode by date and return deeplink', async () => {
      const episodeDate = '2025-10-27'
      
      const deeplink = await searchAppleEpisode(episodeDate)
      
      assert.ok(deeplink, 'Deeplink should be defined')
      assert.ok(deeplink.includes('https://podcasts.apple.com/'))
      assert.ok(deeplink.includes('id1846531745'))
      assert.ok(deeplink.includes('i=1000733777469')) // trackId S2E1
    })

    test('should find different episode for different date', async () => {
      const episodeDate = '2025-10-17' // Bande-annonce
      
      const deeplink = await searchAppleEpisode(episodeDate)
      
      assert.ok(deeplink, 'Deeplink should be defined')
      assert.ok(deeplink.includes('https://podcasts.apple.com/'))
      assert.ok(!deeplink.includes('i=1000733777469'), 'Should NOT be S2E1 trackId')
    })
    
    test('should return null if episode not found', async () => {
      const episodeDate = '2099-12-31'
      
      const deeplink = await searchAppleEpisode(episodeDate)
      
      assert.strictEqual(deeplink, null)
    })
  })
  
  describe('searchDeezerEpisode', () => {
    test('should find episode by date and return deeplink', async () => {
      const episodeDate = '2025-10-27'
      
      const deeplink = await searchDeezerEpisode(episodeDate)
      
      assert.ok(deeplink, 'Deeplink should be defined')
      assert.strictEqual(deeplink, 'https://www.deezer.com/fr/episode/804501282')
    })

    test('should find different episode for different date', async () => {
      const episodeDate = '2025-10-17' // Bande-annonce
      
      const deeplink = await searchDeezerEpisode(episodeDate)
      
      assert.ok(deeplink, 'Deeplink should be defined')
      assert.ok(deeplink.includes('https://www.deezer.com/fr/episode/'))
      assert.ok(!deeplink.includes('804501282'), 'Should NOT be S2E1 ID')
    })
    
    test('should return null if episode not found', async () => {
      const episodeDate = '2099-12-31'
      
      const deeplink = await searchDeezerEpisode(episodeDate)
      
      assert.strictEqual(deeplink, null)
    })
  })
  
  describe('buildPodcastAddictLink', () => {
    test('should encode audioUrl and build deeplink', () => {
      const audioUrl = 'https://op3.dev/e,pg=bb74e9c5-20e5-5226-8491-d512ad8ebe04/podcasts.saletesincere.fr/audio/@charbonwafer/une-collaboration-un-peu-speciale.mp3?_from=podcastaddict.com'
      
      const deeplink = buildPodcastAddictLink(audioUrl)
      
      assert.ok(deeplink.includes('https://podcastaddict.com/episode/'))
      assert.ok(deeplink.includes('podcastId=6137997'))
      assert.ok(deeplink.includes(encodeURIComponent(audioUrl)))
    })
    
    test('should throw error if audioUrl missing', () => {
      assert.throws(
        () => buildPodcastAddictLink(),
        /audioUrl required/
      )
      
      assert.throws(
        () => buildPodcastAddictLink(''),
        /audioUrl required/
      )
    })
  })
  
  describe('buildFallbackLinks', () => {
    test('should return fallback URLs for all platforms', () => {
      const fallbacks = buildFallbackLinks()
      
      assert.ok(fallbacks.spotify)
      assert.ok(fallbacks.apple)
      assert.ok(fallbacks.deezer)
      assert.ok(fallbacks.podcastAddict)
      assert.ok(fallbacks.antennapod)
      assert.ok(fallbacks.pocketCasts)
      assert.ok(fallbacks.overcast)
      
      assert.ok(fallbacks.spotify.includes('spotify.com'))
      assert.ok(fallbacks.apple.includes('apple.com'))
      assert.ok(fallbacks.deezer.includes('deezer.com'))
      assert.ok(fallbacks.podcastAddict.includes('podcastaddict.com'))
    })
  })
})
