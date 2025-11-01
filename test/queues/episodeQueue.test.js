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
    test('should create job with episode data and return job ID', async () => {
      // Premier appel : doit créer le job
      const jobId = await queueEpisodeResolution(2, 1, 'Test Episode', 'https://example.com/cover.jpg')
      
      assert.ok(jobId, 'Should return job ID')
      assert.strictEqual(typeof jobId, 'string', 'Job ID should be a string')
      assert.match(jobId, /^[a-f0-9-]{36}$/, 'Job ID should be a UUID')
    })

    test('should throttle duplicate jobs within singletonSeconds window (returns null)', async () => {
      // Premier appel : crée le job
      const jobId1 = await queueEpisodeResolution(3, 5, 'Throttle Test', 'https://example.com/cover.jpg')
      assert.ok(jobId1, 'First call should create job and return job ID')
      
      // Deuxième appel immédiat : throttling actif (singletonSeconds: 300)
      const jobId2 = await queueEpisodeResolution(3, 5, 'Throttle Test', 'https://example.com/cover.jpg')
      
      // ⚠️ Comportement pg-boss "one per time slot" : retourne null si job existe dans le slot
      assert.strictEqual(jobId2, null, 'Should return null when throttled (job exists in singletonSeconds window)')
    })

    test('should accept different episode numbers as separate jobs', async () => {
      // Deux épisodes différents : pas de throttling car singletonKey différent
      const jobId1 = await queueEpisodeResolution(4, 1, 'Episode 1', 'https://example.com/cover.jpg')
      const jobId2 = await queueEpisodeResolution(4, 2, 'Episode 2', 'https://example.com/cover.jpg')
      
      assert.ok(jobId1, 'Episode 4-1 should create job')
      assert.ok(jobId2, 'Episode 4-2 should create job')
      assert.notStrictEqual(jobId1, jobId2, 'Different episodes should have different job IDs')
    })
  })
})
