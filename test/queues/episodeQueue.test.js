/**
 * Tests pour episodeQueue.js - Queue pg-boss pour résolution épisodes
 * Phase 3 TDD - Un test à la fois
 */

import 'dotenv/config'
import { describe, test, before, after } from 'node:test'
import assert from 'node:assert'
import { initQueue, getBoss, queueEpisodeResolution } from '../../server/queues/episodeQueue.js'

describe('episodeQueue', () => {
  before(async () => {
    // Init une seule fois avant tous les tests
    await initQueue()
  })

  after(async () => {
    // Cleanup: stop pg-boss après tous les tests
    const boss = getBoss()
    if (boss) {
      await boss.stop()
    }
  })

  describe('initQueue', () => {
    test('should initialize pg-boss and return active instance', async () => {
      const boss = getBoss()
      
      assert.ok(boss, 'Should return pg-boss instance')
      assert.strictEqual(typeof boss.start, 'function', 'Should have start method')
      assert.strictEqual(typeof boss.send, 'function', 'Should have send method')
      assert.strictEqual(typeof boss.work, 'function', 'Should have work method')
    })
  })

  describe('queueEpisodeResolution', () => {
    test('should create job with episode data', async () => {
      const jobId = await queueEpisodeResolution(2, 1, 'Test Episode', 'https://example.com/cover.jpg')
      
      assert.ok(jobId, 'Should return job ID')
      assert.strictEqual(typeof jobId, 'string', 'Job ID should be a string')
    })
  })
})
