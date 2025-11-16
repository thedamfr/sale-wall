/**
 * Tests pour route /podcast/:season/:episode - Smartlink multiplateforme
 * Phase 4 TDD - Un test à la fois, RED → GREEN → REFACTOR
 * 
 * Note: Route initialement nommée /episode/:season/:episode, renommée en /podcast/:season/:episode
 */

import 'dotenv/config'
import { describe, test, before, after } from 'node:test'
import assert from 'node:assert'
import { build } from '../helpers/serverHelper.js'

describe('GET /podcast/:season/:episode', () => {
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
      url: '/podcast/2/1'
    })

    assert.strictEqual(response.statusCode, 200, 'Should return 200 OK')
  })

  // RED 2: Route doit valider et parser les params
  test('should parse season and episode from URL params', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/podcast/1/5' // Changer pour épisode existant
    })

    assert.strictEqual(response.statusCode, 200)
    
    // La route retourne du HTML, pas du JSON
    const body = response.body
    assert.match(body, /Saison 1.*Épisode 5/i, 'Should display season and episode')
  })

  // RED 3: Route doit fetch RSS pour obtenir date épisode
  test('should fetch RSS to get episode publication date', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/podcast/2/1' // S2E1 publié le 2025-10-27
    })

    assert.strictEqual(response.statusCode, 200)
    
    const body = response.body
    assert.match(body, /S2E1/i, 'Should show episode identifier')
    assert.match(body, /27 octobre 2025/i, 'Should display publication date from RSS')
  })

  // RED 4: Forcer généralisation - S1E5 doit aussi fonctionner
  test('should parse date for different episode (S1E5)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/podcast/1/5' // S1E5 publié le 2025-10-16
    })

    assert.strictEqual(response.statusCode, 200)
    
    const body = response.body
    assert.match(body, /S1E5/i, 'Should show episode identifier')
    assert.match(body, /16 octobre 2025/i, 'Should parse date from RSS')
  })

  // TODO: Test queue job (skipped car pg-boss worker ne termine jamais)
  // On testera manuellement dans server.js
})
