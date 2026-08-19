export const EpisodeWorkerState = Object.freeze({
  STOPPED: 'stopped',
  STARTING: 'starting',
  READY: 'ready',
  RETRY_SCHEDULED: 'retry_scheduled',
  STOPPING: 'stopping'
})

export const DatabaseState = Object.freeze({
  UNKNOWN: 'unknown',
  UNAVAILABLE: 'unavailable',
  READ_ONLY: 'read_only',
  READ_WRITE: 'read_write'
})

const DEFAULT_RETRY_DELAYS = [5000, 15000, 30000, 60000]
const READ_ONLY_CODES = new Set(['25006', '25007', '25008'])

export function classifyDatabaseError(error) {
  const code = error?.code
  const message = String(error?.message || '').toLowerCase()

  if (
    READ_ONLY_CODES.has(code) ||
    message.includes('read-only') ||
    message.includes('read only') ||
    message.includes('recovery mode') ||
    message.includes('hot standby')
  ) {
    return DatabaseState.READ_ONLY
  }

  return DatabaseState.UNAVAILABLE
}

function logEvent(logger, level, event, details = {}) {
  const log = logger?.[level]
  if (typeof log !== 'function') return

  log.call(logger, { event, ...details }, event)
}

export function createEpisodeWorkerManager({
  start,
  stop,
  logger,
  retryDelays = DEFAULT_RETRY_DELAYS,
  jitterRatio = 0.2,
  random = Math.random,
  now = Date.now,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
}) {
  if (typeof start !== 'function' || typeof stop !== 'function') {
    throw new TypeError('Episode worker manager requires start and stop functions')
  }

  let state = EpisodeWorkerState.STOPPED
  let databaseState = DatabaseState.UNKNOWN
  let instance = null
  let startPromise = null
  let retryTimer = null
  let retryAttempt = 0
  let nextRetryAt = null
  let shuttingDown = false
  let runtimeErrorHandler = null

  const normalizedDelays = retryDelays.length > 0 ? retryDelays : DEFAULT_RETRY_DELAYS

  function getStatus() {
    return {
      state,
      retryAttempt,
      nextRetryAt
    }
  }

  function getDatabaseState() {
    return databaseState
  }

  function getInstance() {
    return instance
  }

  function detachRuntimeError(target) {
    if (!target || !runtimeErrorHandler || typeof target.off !== 'function') return
    target.off('error', runtimeErrorHandler)
    runtimeErrorHandler = null
  }

  async function stopInstance(target) {
    if (!target) return

    detachRuntimeError(target)

    const stopErrorHandler = (error) => {
      logEvent(logger, 'warn', 'episode_worker_stop_error', {
        errorCode: error?.code || error?.name || 'UNKNOWN'
      })
    }

    if (typeof target.on === 'function') {
      target.on('error', stopErrorHandler)
    }

    try {
      await stop(target)
    } catch (error) {
      stopErrorHandler(error)
    } finally {
      if (typeof target.off === 'function') {
        target.off('error', stopErrorHandler)
      }
    }
  }

  function scheduleRetry(error) {
    if (shuttingDown || retryTimer) return

    const baseDelay = normalizedDelays[Math.min(retryAttempt, normalizedDelays.length - 1)]
    const jitter = 1 + ((random() * 2 - 1) * jitterRatio)
    const delay = Math.max(0, Math.round(baseDelay * jitter))

    retryAttempt += 1
    nextRetryAt = new Date(now() + delay).toISOString()
    state = EpisodeWorkerState.RETRY_SCHEDULED

    retryTimer = setTimeoutFn(() => {
      retryTimer = null
      nextRetryAt = null
      return ensureStarted()
    }, delay)

    logEvent(logger, 'warn', 'episode_worker_retry_scheduled', {
      attempt: retryAttempt,
      delayMs: delay,
      databaseState,
      errorCode: error?.code || error?.name || 'UNKNOWN'
    })
  }

  function handleRuntimeError(error, target) {
    if (shuttingDown || target !== instance) return

    instance = null
    databaseState = classifyDatabaseError(error)
    state = EpisodeWorkerState.STOPPED

    logEvent(logger, 'error', 'episode_worker_runtime_error', {
      databaseState,
      errorCode: error?.code || error?.name || 'UNKNOWN'
    })

    void stopInstance(target)
    scheduleRetry(error)
  }

  function attachRuntimeError(target) {
    if (typeof target?.on !== 'function') return

    runtimeErrorHandler = (error) => handleRuntimeError(error, target)
    target.on('error', runtimeErrorHandler)
  }

  function ensureStarted() {
    if (shuttingDown) return Promise.resolve(null)
    if (state === EpisodeWorkerState.READY && instance) return Promise.resolve(instance)
    if (startPromise) return startPromise
    if (retryTimer) return Promise.resolve(null)

    state = EpisodeWorkerState.STARTING
    logEvent(logger, 'info', 'episode_worker_starting', {
      attempt: retryAttempt + 1
    })

    const promise = Promise.resolve().then(async () => {
      try {
        const candidate = await start()

        if (!candidate) {
          throw new Error('Episode worker starter returned no instance')
        }

        if (shuttingDown) {
          await stopInstance(candidate)
          return null
        }

        instance = candidate
        attachRuntimeError(candidate)
        databaseState = DatabaseState.READ_WRITE
        state = EpisodeWorkerState.READY
        retryAttempt = 0
        nextRetryAt = null

        logEvent(logger, 'info', 'episode_worker_ready', {
          databaseState
        })

        return candidate
      } catch (error) {
        if (!shuttingDown) {
          databaseState = classifyDatabaseError(error)
          logEvent(logger, 'error', 'episode_worker_start_failed', {
            databaseState,
            errorCode: error?.code || error?.name || 'UNKNOWN'
          })
          scheduleRetry(error)
        }

        return null
      } finally {
        if (startPromise === promise) {
          startPromise = null
        }
      }
    })

    startPromise = promise
    return promise
  }

  async function shutdown() {
    if (shuttingDown && state === EpisodeWorkerState.STOPPED) return

    shuttingDown = true
    state = EpisodeWorkerState.STOPPING

    if (retryTimer) {
      clearTimeoutFn(retryTimer)
      retryTimer = null
      nextRetryAt = null
    }

    const activeInstance = instance
    instance = null
    await stopInstance(activeInstance)

    state = EpisodeWorkerState.STOPPED
    logEvent(logger, 'info', 'episode_worker_stopped')
  }

  return {
    ensureStarted,
    stop: shutdown,
    getStatus,
    getDatabaseState,
    getInstance
  }
}
