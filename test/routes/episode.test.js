/**
 * Tests pour route /episode/:season/:episode - Smartlink multiplateforme
 * Phase 4 TDD - Un test à la fois, RED → GREEN → REFACTOR
 */

import 'dotenv/config'
import { describe, test, before, after } from 'node:test'
import assert from 'node:assert'
import Fastify from 'fastify'

describe('GET /episode/:season/:episode', () => {
  let app

  before(async () => {
    // TODO: Setup minimal Fastify app avec la route
    app = Fastify()
    
    // RED: route n'existe pas encore
    app.get('/episode/:season/:episode', async (request, reply) => {
      return { message: 'Not implemented yet' }
    })
    
    await app.ready()
  })

  after(async () => {
    await app.close()
  })

  test('should return 200 for valid season and episode', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/episode/2/1'
    })

    assert.strictEqual(response.statusCode, 200, 'Should return 200 OK')
    
    const body = JSON.parse(response.body)
    assert.ok(body, 'Response body should exist')
  })
})
