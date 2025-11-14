/**
 * Tests SEO podcast route - US4.1 OG tags & canonical
 * TDD RED → GREEN → REFACTOR
 * 
 * Note: Ces tests utilisent le serveur local démarré
 * Lancer avec: npm run dev (dans un autre terminal)
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

describe('US4.1 - OG tags & SEO canonical', () => {

  it('should have canonical URL in new format /podcast/:season/:episode', async () => {
    const response = await fetch(`${BASE_URL}/podcast/2/1`)
    const body = await response.text()

    assert.strictEqual(response.status, 200, 'Route should exist')
    
    // US4.1: Canonical doit pointer vers nouvelle route
    assert.match(
      body,
      /<link rel="canonical" href="https:\/\/saletesincere\.fr\/podcast\/2\/1">/,
      'Canonical URL should use new route format /podcast/2/1'
    )
  })

  it('should have og:url matching canonical URL (new format)', async () => {
    const response = await fetch(`${BASE_URL}/podcast/2/1`)
    const body = await response.text()

    assert.strictEqual(response.status, 200)
    
    // og:url doit matcher le canonical (nouveau format)
    assert.match(
      body,
      /<meta property="og:url" content="https:\/\/saletesincere\.fr\/podcast\/2\/1">/,
      'og:url should match canonical URL with new format'
    )
  })

  it('should have twitter:url matching canonical URL', async () => {
    const response = await fetch(`${BASE_URL}/podcast/2/1`)
    const body = await response.text()

    assert.strictEqual(response.status, 200)
    
    assert.match(
      body,
      /<meta property="twitter:url" content="https:\/\/saletesincere\.fr\/podcast\/2\/1">/,
      'twitter:url should match canonical URL'
    )
  })

  it('should have og:type as article for episode pages', async () => {
    const response = await fetch(`${BASE_URL}/podcast/2/1`)
    const body = await response.text()

    assert.strictEqual(response.status, 200)
    
    // og:type devrait être "article" pour un épisode (pas "website")
    assert.match(
      body,
      /<meta property="og:type" content="article">/,
      'og:type should be "article" for episode pages'
    )
  })

  it('should have episode-specific og:title with S2E1 format', async () => {
    const response = await fetch(`${BASE_URL}/podcast/2/1`)
    const body = await response.text()

    assert.strictEqual(response.status, 200)
    
    // Ce test devrait passer (déjà implémenté)
    assert.match(
      body,
      /<meta property="og:title" content="S2E1 - .+ \| Charbon & Wafer">/,
      'og:title should include episode identifier S2E1'
    )
  })

  it('should have dynamic og:description from RSS', async () => {
    const response = await fetch(`${BASE_URL}/podcast/2/1`)
    const body = await response.text()

    assert.strictEqual(response.status, 200)
    
    // og:description doit être présente et non vide
    assert.match(
      body,
      /<meta property="og:description" content=".+">/,
      'og:description should be present and non-empty'
    )
    
    // Vérifier que ce n'est pas la description générique
    assert.doesNotMatch(
      body,
      /<meta property="og:description" content="Pas de Charbon, Pas de Wafer - Confidences brutes/,
      'og:description should not use generic podcast description'
    )
  })
})

