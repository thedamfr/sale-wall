import { EventEmitter } from 'node:events'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../../server.js'
import { EpisodeWorkerState } from '../../server/queues/episodeWorkerManager.js'

const UNAVAILABLE_DATABASE_URL = 'postgresql://salete:salete@127.0.0.1:1/salete_test'

function createCandidate() {
  const candidate = new EventEmitter()
  candidate.stopCalls = 0
  candidate.stop = async () => {
    candidate.stopCalls += 1
  }
  return candidate
}

async function waitForState(manager, expectedState) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (manager.getStatus().state === expectedState) return
    await new Promise((resolve) => setImmediate(resolve))
  }
  assert.equal(manager.getStatus().state, expectedState)
}

describe('degraded startup', () => {
  test('builds HTTP without awaiting a pending worker connection', async () => {
    const candidate = createCandidate()
    let resolveStart
    const startGate = new Promise((resolve) => {
      resolveStart = resolve
    })

    const app = await buildApp({
      initializeStorage: false,
      initializeOp3: false,
      databaseUrl: UNAVAILABLE_DATABASE_URL,
      databaseConfigured: true,
      episodeWorkerStarter: () => startGate,
      episodeWorkerStopper: (instance) => instance.stop(),
      workerManagerOptions: {
        jitterRatio: 0
      }
    })

    const [home, podcast, health] = await Promise.all([
      app.inject({ method: 'GET', url: '/' }),
      app.inject({ method: 'GET', url: '/podcast' }),
      app.inject({ method: 'GET', url: '/health' })
    ])

    assert.equal(home.statusCode, 200)
    assert.equal(podcast.statusCode, 200)
    assert.equal(health.statusCode, 200)
    assert.deepEqual(health.json(), {
      ok: true,
      mode: 'degraded',
      database: { state: 'unknown' },
      episodeWorker: { state: 'starting' }
    })

    await app.close()
    resolveStart(candidate)
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(candidate.stopCalls, 1)
  })

  test('reports degradation then returns to normal after the singleton retry', async () => {
    const candidate = createCandidate()
    const scheduled = []
    let startCalls = 0
    const app = await buildApp({
      initializeStorage: false,
      initializeOp3: false,
      databaseUrl: UNAVAILABLE_DATABASE_URL,
      databaseConfigured: true,
      episodeWorkerStarter: async () => {
        startCalls += 1
        if (startCalls === 1) {
          throw Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' })
        }
        return candidate
      },
      episodeWorkerStopper: (instance) => instance.stop(),
      workerManagerOptions: {
        retryDelays: [5000],
        jitterRatio: 0,
        setTimeoutFn(callback, delay) {
          const timer = { callback, delay, cleared: false }
          scheduled.push(timer)
          return timer
        },
        clearTimeoutFn(timer) {
          timer.cleared = true
        }
      }
    })

    await waitForState(app.episodeWorkerManager, EpisodeWorkerState.RETRY_SCHEDULED)

    const degradedHealth = await app.inject({ method: 'GET', url: '/health' })
    assert.equal(degradedHealth.statusCode, 200)
    assert.deepEqual(degradedHealth.json(), {
      ok: true,
      mode: 'degraded',
      database: { state: 'unavailable' },
      episodeWorker: { state: 'retry_scheduled' }
    })
    assert.equal(scheduled.length, 1)
    assert.equal(scheduled[0].delay, 5000)

    await scheduled[0].callback()
    await waitForState(app.episodeWorkerManager, EpisodeWorkerState.READY)

    const normalHealth = await app.inject({ method: 'GET', url: '/health' })
    assert.deepEqual(normalHealth.json(), {
      ok: true,
      mode: 'normal',
      database: { state: 'read_write' },
      episodeWorker: { state: 'ready' }
    })
    assert.equal(startCalls, 2)

    await app.close()
    assert.equal(candidate.stopCalls, 1)
  })
})
