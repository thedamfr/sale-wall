/**
 * Tests pour episodeQueue.js - Queue pg-boss pour résolution épisodes
 * Phase 3 TDD - Un test à la fois
 */

import 'dotenv/config'
import { describe, test, before, after, afterEach } from 'node:test'
import assert from 'node:assert'
import pg from 'pg'
import { initQueue, getBoss, queueEpisodeResolution } from '../../server/queues/episodeQueue.js'

const { Client } = pg

describe('episodeQueue', () => {
  let pgClient

  before(async () => {
    // Init pg-boss une seule fois avant tous les tests
    await initQueue()

    // Init client PostgreSQL pour queries directes BDD
    pgClient = new Client({
      connectionString: process.env.DATABASE_URL
    })
    await pgClient.connect()
  })

  afterEach(async () => {
    // Cleanup: supprimer tous les jobs de test après chaque test
    // pour éviter accumulation et garantir répétabilité
    await pgClient.query(`DELETE FROM pgboss.job WHERE name = 'resolve-episode'`)
  })

  after(async () => {
    // Cleanup: close PostgreSQL client
    if (pgClient) {
      await pgClient.end()
    }

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

    test('should verify throttling in database (UNIQUE constraint on singleton_key)', async () => {
      const season = 5
      const episode = 10
      const singletonKey = `episode-${season}-${episode}`
      
      // Premier appel : crée le job
      const jobId1 = await queueEpisodeResolution(season, episode, 'DB Test', 'https://example.com/img.jpg')
      assert.ok(jobId1, 'Should create first job')
      
      // Query BDD : vérifier qu'un seul job existe avec ce singletonKey
      const result = await pgClient.query(
        `SELECT id, name, singleton_key, state, data, singleton_on 
         FROM pgboss.job 
         WHERE name = $1 AND singleton_key = $2`,
        ['resolve-episode', singletonKey]
      )
      
      assert.strictEqual(result.rows.length, 1, 'Should have exactly 1 job in database')
      assert.strictEqual(result.rows[0].id, jobId1, 'Job ID should match')
      assert.strictEqual(result.rows[0].singleton_key, singletonKey, 'Singleton key should match')
      assert.ok(result.rows[0].singleton_on, 'singleton_on timestamp should be set')
      
      // Vérifier données JSON
      const jobData = result.rows[0].data
      assert.strictEqual(jobData.season, season, 'Season should be stored in job data')
      assert.strictEqual(jobData.episode, episode, 'Episode should be stored in job data')
      
      // Deuxième appel : throttled (retourne null)
      const jobId2 = await queueEpisodeResolution(season, episode, 'DB Test', 'https://example.com/img.jpg')
      assert.strictEqual(jobId2, null, 'Should return null when throttled')
      
      // Re-query BDD : toujours 1 seul job (pas de doublon)
      const result2 = await pgClient.query(
        `SELECT COUNT(*) as count 
         FROM pgboss.job 
         WHERE name = $1 AND singleton_key = $2`,
        ['resolve-episode', singletonKey]
      )
      
      assert.strictEqual(parseInt(result2.rows[0].count), 1, 'Should still have exactly 1 job (no duplicate created)')
    })
  })
})
