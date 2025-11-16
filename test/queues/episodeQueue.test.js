/**
 * Tests pour episodeQueue.js - Queue pg-boss pour résolution épisodes
 * Phase 3 TDD - Un test à la fois
 */

import 'dotenv/config'
import { describe, test, before, after, afterEach } from 'node:test'
import assert from 'node:assert'
import pg from 'pg'
import { initQueue, getBoss, queueEpisodeResolution, startWorker } from '../../server/queues/episodeQueue.js'

const { Client, Pool } = pg

describe('episodeQueue', () => {
  let pgClient
  let pgPool // Pool pour le worker (connexions multiples)

  before(async () => {
    // Init pg-boss une seule fois avant tous les tests
    await initQueue()
    
    // Init client PostgreSQL pour queries directes BDD (admin queries)
    pgClient = new Client({
      connectionString: process.env.DATABASE_URL
    })
    await pgClient.connect()
    
    // ⚠️ Créer un POOL pour le worker (pas un client unique)
    // Permet plusieurs workers en parallèle sans "Cannot use a pool after calling end"
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5 // 5 connexions max en parallèle pour les tests
    })
    
    // Mock fastify avec vrai pool pg pour le worker
    const mockFastify = {
      pg: pgPool // Le pool gère les connexions automatiquement
    }
    
    // Démarrer le worker avec teamSize=2 pour traiter 2 jobs en parallèle (tests plus rapides)
    await startWorker(mockFastify, { teamSize: 2 })
  })

  afterEach(async () => {
    // Cleanup: supprimer tous les jobs de test après chaque test
    // pour éviter accumulation et garantir répétabilité
    await pgClient.query(`DELETE FROM pgboss.job WHERE name = 'resolve-episode'`)
  })

  after(async () => {
    // ⚠️ ORDRE CRITIQUE : Arrêter worker AVANT de fermer le pool/client PostgreSQL
    // Sinon le worker tente d'utiliser un pool fermé → "Cannot use a pool after calling end"
    
    // 1. Stop pg-boss worker (arrête les jobs en cours)
    const boss = getBoss()
    if (boss) {
      await boss.stop()
    }

    // 2. Close Pool (connexions worker)
    if (pgPool) {
      await pgPool.end()
    }

    // 3. Close Client (admin queries)
    if (pgClient) {
      await pgClient.end()
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
      const jobId = await queueEpisodeResolution(2, 1, '2025-10-27', 'Test Episode', 'https://example.com/cover.jpg')
      
      assert.ok(jobId, 'Should return job ID')
      assert.strictEqual(typeof jobId, 'string', 'Job ID should be a string')
      assert.match(jobId, /^[a-f0-9-]{36}$/, 'Job ID should be a UUID')
    })

    test('should throttle duplicate jobs within singletonSeconds window (returns null)', async () => {
      // Premier appel : crée le job
      const jobId1 = await queueEpisodeResolution(3, 5, '2025-09-15', 'Throttle Test', 'https://example.com/cover.jpg')
      assert.ok(jobId1, 'First call should create job and return job ID')
      
      // Deuxième appel immédiat : throttling actif (singletonSeconds: 300)
      const jobId2 = await queueEpisodeResolution(3, 5, '2025-09-15', 'Throttle Test', 'https://example.com/cover.jpg')
      
      // ⚠️ Comportement pg-boss "one per time slot" : retourne null si job existe dans le slot
      assert.strictEqual(jobId2, null, 'Should return null when throttled (job exists in singletonSeconds window)')
    })

    test('should accept different episode numbers as separate jobs', async () => {
      // Deux épisodes différents : pas de throttling car singletonKey différent
      const jobId1 = await queueEpisodeResolution(4, 1, '2025-08-10', 'Episode 1', 'https://example.com/cover.jpg')
      const jobId2 = await queueEpisodeResolution(4, 2, '2025-08-17', 'Episode 2', 'https://example.com/cover.jpg')
      
      assert.ok(jobId1, 'Episode 4-1 should create job')
      assert.ok(jobId2, 'Episode 4-2 should create job')
      assert.notStrictEqual(jobId1, jobId2, 'Different episodes should have different job IDs')
    })

    test('should verify throttling in database (UNIQUE constraint on singleton_key)', async () => {
      const season = 5
      const episode = 10
      const singletonKey = `episode-${season}-${episode}`
      
      // Premier appel : crée le job
      const jobId1 = await queueEpisodeResolution(season, episode, '2025-07-20', 'DB Test', 'https://example.com/img.jpg')
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
      const jobId2 = await queueEpisodeResolution(season, episode, '2025-07-20', 'DB Test', 'https://example.com/img.jpg')
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

  describe('startWorker', () => {
    test('should process job and call platform APIs', async (t) => {
      // Worker déjà démarré dans before()
      // On crée un job
      const jobId = await queueEpisodeResolution(6, 1, '2025-10-27', 'Worker Test Episode', 'https://example.com/cover.jpg')
      assert.ok(jobId, 'Job should be created')
      
      // Attendre que le worker traite le job (pg-boss poll interval + API calls)
      // Boucle pour vérifier l'état du job jusqu'à ce qu'il soit completed (max 10s)
      let jobState = null;
      let jobOutput = null;
      let attempts = 0;
      const maxAttempts = 20; // 20 x 500ms = 10s max
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const result = await pgClient.query(
          `SELECT state, output FROM pgboss.job WHERE id = $1`,
          [jobId]
        )
        
        jobState = result.rows[0].state
        jobOutput = result.rows[0].output
        
        if (jobState === 'completed' || jobState === 'failed') {
          break
        }
        
        attempts++
      }
      
      // Si retry ou failed, afficher l'erreur pour debug
      if (jobState !== 'completed') {
        console.log(`[DEBUG] Job state: ${jobState}, output:`, jobOutput)
      }
      
      assert.strictEqual(jobState, 'completed', 'Job should be completed by worker')
    })

    test('REGRESSION: different episodes should resolve to DIFFERENT platform URLs', async (t) => {
      // ⚠️ CE TEST AURAIT DÛ EMPÊCHER LE BUG !
      // Avant fix : worker utilisait hardcoded date '2025-10-27' pour TOUS les épisodes
      // → Toutes les résolutions pointaient vers le même épisode
      
      // Cleanup : supprimer les entrées existantes pour S2E1 et S2E2
      await pgClient.query(`DELETE FROM episode_links WHERE season = 2 AND episode IN (1, 2)`)
      
      // 1. Queue résolution pour S2E1 avec SA date de publication (vraie date du RSS)
      const jobId1 = await queueEpisodeResolution(2, 1, '2025-10-27', 'S2E1 Episode Title', 'https://example.com/s2e1.jpg')
      assert.ok(jobId1, 'S2E1 job should be created')
      
      // 2. Queue résolution pour S2E2 avec SA date de publication (vraie date du RSS : 4 nov 2025, pas 27 oct)
      const jobId2 = await queueEpisodeResolution(2, 2, '2025-11-04', 'S2E2 Episode Title', 'https://example.com/s2e2.jpg')
      assert.ok(jobId2, 'S2E2 job should be created')
      
      // 3. Attendre que les deux workers traitent les jobs (polling jusqu'à 30s max)
      // teamSize=2 permet traitement parallèle, mais APIs externes peuvent être lentes
      const maxWaitMs = 30000
      const pollIntervalMs = 500
      let elapsed = 0
      let allCompleted = false
      
      while (elapsed < maxWaitMs && !allCompleted) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
        elapsed += pollIntervalMs
        
        const jobs = await pgClient.query(
          `SELECT id, state FROM pgboss.job WHERE id = ANY($1::uuid[])`,
          [[jobId1, jobId2]]
        )
        
        allCompleted = jobs.rows.every(job => job.state === 'completed')
        
        if (!allCompleted && elapsed % 2000 === 0) {
          console.log(`[Polling ${elapsed}ms] Jobs:`, jobs.rows.map(j => `${j.id.slice(0,8)}=${j.state}`).join(', '))
        }
      }
      
      if (!allCompleted) {
        console.warn(`⚠️  Timeout after ${maxWaitMs}ms - some jobs not completed`)
      }
      
      // 4. Vérifier que les deux jobs sont completed
      const jobs = await pgClient.query(
        `SELECT id, state, output FROM pgboss.job WHERE id = ANY($1::uuid[])`,
        [[jobId1, jobId2]]
      )
      
      for (const job of jobs.rows) {
        if (job.state !== 'completed') {
          console.log(`[DEBUG] Job ${job.id} state: ${job.state}, output:`, job.output)
        }
        assert.strictEqual(job.state, 'completed', `Job ${job.id} should be completed`)
      }
      
      // 5. Vérifier que les URLs dans episode_links sont DIFFÉRENTES
      const links = await pgClient.query(
        `SELECT season, episode, spotify_url, apple_url, deezer_url 
         FROM episode_links 
         WHERE season = 2 AND episode IN (1, 2)
         ORDER BY episode`
      )
      
      assert.strictEqual(links.rows.length, 2, 'Should have 2 episode_links entries')
      
      const s2e1 = links.rows[0]
      const s2e2 = links.rows[1]
      
      // ⚠️ ASSERTION CRITIQUE : Les URLs doivent être DIFFÉRENTES
      assert.notStrictEqual(
        s2e1.spotify_url, 
        s2e2.spotify_url, 
        'S2E1 and S2E2 should have DIFFERENT Spotify URLs (bug: hardcoded date returned same URL)'
      )
      
      assert.notStrictEqual(
        s2e1.apple_url, 
        s2e2.apple_url, 
        'S2E1 and S2E2 should have DIFFERENT Apple URLs'
      )
      
      assert.notStrictEqual(
        s2e1.deezer_url, 
        s2e2.deezer_url, 
        'S2E1 and S2E2 should have DIFFERENT Deezer URLs'
      )
      
      // 6. Vérifier que les URLs sont valides (non null, format correct)
      assert.ok(s2e1.spotify_url, 'S2E1 Spotify URL should exist')
      assert.ok(s2e2.spotify_url, 'S2E2 Spotify URL should exist')
      assert.match(s2e1.spotify_url, /^https:\/\/open\.spotify\.com\/episode\//, 'S2E1 Spotify URL should be valid')
      assert.match(s2e2.spotify_url, /^https:\/\/open\.spotify\.com\/episode\//, 'S2E2 Spotify URL should be valid')
      
      console.log(`✅ S2E1 Spotify: ${s2e1.spotify_url.substring(0, 60)}...`)
      console.log(`✅ S2E2 Spotify: ${s2e2.spotify_url.substring(0, 60)}...`)
    })
  })
})
