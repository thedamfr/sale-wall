/**
 * Tests pour route /episode/:season/:episode - Smartlink multiplateforme
 * Phase 4 TDD - Un test à la fois, RED → GREEN → REFACTOR
 */

import 'dotenv/config'
import { describe, test, before, after } from 'node:test'
import assert from 'node:assert'
import { build } from '../helpers/serverHelper.js'

describe('GET /episode/:season/:episode', () => {
  let app

  before(async () => {
    // Utiliser le vrai serveur pour tester la vraie route
    app = await build()
  })

  after(async () => {
    await app.close()
  })

  // RED 1: Route doit exister et retourner 200
  test('should return 200 for valid season and episode', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/episode/2/1'
    })

    assert.strictEqual(response.statusCode, 200, 'Should return 200 OK')
  })

  // RED 2: Route doit valider et parser les params
  test('should parse season and episode from URL params', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/episode/1/5' // Changer pour épisode existant
    })

    assert.strictEqual(response.statusCode, 200)
    
    const body = JSON.parse(response.body)
    assert.strictEqual(body.season, 1, 'Season should be parsed as integer')
    assert.strictEqual(body.episode, 5, 'Episode should be parsed as integer')
  })

  // RED 3: Route doit fetch RSS pour obtenir date épisode
  test('should fetch RSS to get episode publication date', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/episode/2/1' // S2E1 publié le 2025-10-27
    })

    assert.strictEqual(response.statusCode, 200)
    
    const body = JSON.parse(response.body)
    assert.strictEqual(body.season, 2)
    assert.strictEqual(body.episode, 1)
    assert.ok(body.episodeDate, 'Episode date should be present')
    assert.strictEqual(body.episodeDate, '2025-10-27', 'Should match RSS pubDate')
  })

  // RED 4: Forcer généralisation - S1E5 doit aussi fonctionner
  test('should parse date for different episode (S1E5)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/episode/1/5' // S1E5 publié le 2025-10-15
    })

    assert.strictEqual(response.statusCode, 200)
    
    const body = JSON.parse(response.body)
    assert.strictEqual(body.season, 1)
    assert.strictEqual(body.episode, 5)
    assert.strictEqual(body.episodeDate, '2025-10-15', 'Should parse date from RSS')
  })

  // TODO: Test queue job (skipped car pg-boss worker ne termine jamais)
  // On testera manuellement dans server.js
})
