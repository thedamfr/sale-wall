import { EventEmitter } from 'node:events'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createEpisodeWorkerManager,
  classifyDatabaseError,
  DatabaseState,
  EpisodeWorkerState
} from '../../server/queues/episodeWorkerManager.js'
import { createDatabaseAvailability } from '../../server/resilience/databaseAvailability.js'

function createFakeTimers() {
  const scheduled = []

  return {
    scheduled,
    setTimeoutFn(callback, delay) {
      const timer = { callback, delay, cleared: false, executed: false }
      scheduled.push(timer)
      return timer
    },
    clearTimeoutFn(timer) {
      timer.cleared = true
    },
    async runNext() {
      const timer = scheduled.find((item) => !item.cleared && !item.executed)
      assert.ok(timer, 'A retry timer should be scheduled')
      timer.executed = true
      return timer.callback()
    }
  }
}

function createCandidate() {
  const candidate = new EventEmitter()
  candidate.stopCalls = 0
  candidate.stop = async () => {
    candidate.stopCalls += 1
  }
  return candidate
}

describe('episodeWorkerManager', () => {
  test('shares a single startup promise across concurrent calls', async () => {
    const candidate = createCandidate()
    let resolveStart
    let startCalls = 0
    const startGate = new Promise((resolve) => {
      resolveStart = resolve
    })
    const manager = createEpisodeWorkerManager({
      start: () => {
        startCalls += 1
        return startGate
      },
      stop: (instance) => instance.stop(),
      jitterRatio: 0
    })

    const attempts = Array.from({ length: 20 }, () => manager.ensureStarted())

    assert.equal(startCalls, 0, 'Startup is deferred to a microtask')
    assert.ok(attempts.every((attempt) => attempt === attempts[0]))

    resolveStart(candidate)
    const instances = await Promise.all(attempts)

    assert.equal(startCalls, 1)
    assert.ok(instances.every((instance) => instance === candidate))
    assert.equal(manager.getStatus().state, EpisodeWorkerState.READY)
    assert.equal(manager.getDatabaseState(), DatabaseState.READ_WRITE)

    await manager.stop()
    assert.equal(candidate.stopCalls, 1)
  })

  test('retries with a fresh startup and recovers without a process restart', async () => {
    const timers = createFakeTimers()
    const candidate = createCandidate()
    let startCalls = 0
    const manager = createEpisodeWorkerManager({
      start: async () => {
        startCalls += 1
        if (startCalls === 1) {
          const error = new Error('connection refused')
          error.code = 'ECONNREFUSED'
          throw error
        }
        return candidate
      },
      stop: (instance) => instance.stop(),
      retryDelays: [5000, 15000],
      jitterRatio: 0,
      now: () => 1000,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn
    })

    assert.equal(await manager.ensureStarted(), null)
    assert.equal(manager.getInstance(), null)
    assert.equal(manager.getStatus().state, EpisodeWorkerState.RETRY_SCHEDULED)
    assert.equal(manager.getStatus().retryAttempt, 1)
    assert.equal(manager.getStatus().nextRetryAt, new Date(6000).toISOString())
    assert.equal(manager.getDatabaseState(), DatabaseState.UNAVAILABLE)
    assert.equal(timers.scheduled.length, 1)

    await Promise.all(Array.from({ length: 20 }, () => manager.ensureStarted()))
    assert.equal(startCalls, 1)
    assert.equal(timers.scheduled.length, 1)

    await timers.runNext()

    assert.equal(startCalls, 2)
    assert.equal(manager.getInstance(), candidate)
    assert.equal(manager.getStatus().state, EpisodeWorkerState.READY)
    assert.equal(manager.getStatus().retryAttempt, 0)
    assert.equal(manager.getDatabaseState(), DatabaseState.READ_WRITE)

    await manager.stop()
  })

  test('moves out of READY and schedules one retry after a runtime error', async () => {
    const timers = createFakeTimers()
    const candidate = createCandidate()
    const manager = createEpisodeWorkerManager({
      start: async () => candidate,
      stop: (instance) => instance.stop(),
      retryDelays: [5000],
      jitterRatio: 0,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn
    })

    await manager.ensureStarted()
    const error = new Error('database system is in recovery mode')
    error.code = '57P03'
    candidate.emit('error', error)

    assert.equal(manager.getInstance(), null)
    assert.equal(manager.getStatus().state, EpisodeWorkerState.RETRY_SCHEDULED)
    assert.equal(manager.getDatabaseState(), DatabaseState.UNAVAILABLE)
    assert.equal(timers.scheduled.length, 1)

    await manager.stop()
    assert.equal(timers.scheduled[0].cleared, true)
  })

  test('cancels a scheduled retry and prevents resurrection during shutdown', async () => {
    const timers = createFakeTimers()
    let startCalls = 0
    const manager = createEpisodeWorkerManager({
      start: async () => {
        startCalls += 1
        throw Object.assign(new Error('offline'), { code: 'ECONNREFUSED' })
      },
      stop: async () => {},
      retryDelays: [5000],
      jitterRatio: 0,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn
    })

    await manager.ensureStarted()
    await manager.stop()

    assert.equal(timers.scheduled[0].cleared, true)
    assert.equal(manager.getStatus().state, EpisodeWorkerState.STOPPED)
    assert.equal(await manager.ensureStarted(), null)
    assert.equal(startCalls, 1)
  })

  test('classifies read-only and unavailable PostgreSQL failures', () => {
    assert.equal(
      classifyDatabaseError(Object.assign(new Error('read-only transaction'), { code: '25006' })),
      DatabaseState.READ_ONLY
    )
    assert.equal(
      classifyDatabaseError(Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' })),
      DatabaseState.UNAVAILABLE
    )
  })

  test('invalidates a ready worker when a route reports a database failure', async () => {
    const timers = createFakeTimers()
    const candidate = createCandidate()
    const availability = createDatabaseAvailability({
      probe: async () => DatabaseState.UNKNOWN
    })
    const manager = createEpisodeWorkerManager({
      start: async () => candidate,
      stop: (instance) => instance.stop(),
      databaseAvailability: availability,
      retryDelays: [5000],
      jitterRatio: 0,
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn
    })

    await manager.ensureStarted()
    manager.reportDatabaseError(Object.assign(new Error('connection refused'), {
      code: 'ECONNREFUSED'
    }))

    assert.equal(availability.getState(), DatabaseState.UNAVAILABLE)
    assert.equal(manager.getStatus().state, EpisodeWorkerState.RETRY_SCHEDULED)
    assert.equal(manager.getInstance(), null)
    assert.equal(timers.scheduled.length, 1)

    await manager.stop()
  })
})
