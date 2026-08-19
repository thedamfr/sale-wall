export const DatabaseState = Object.freeze({
  UNKNOWN: 'unknown',
  UNAVAILABLE: 'unavailable',
  READ_ONLY: 'read_only',
  READ_WRITE: 'read_write'
})

const READ_ONLY_CODES = new Set(['25006', '25007', '25008'])
const UNAVAILABLE_CODES = new Set([
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '28P01',
  '57P01',
  '57P02',
  '57P03',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT'
])

export function classifyDatabaseError(error) {
  const code = error?.code
  const message = String(error?.message || '').toLowerCase()

  // 57P03 means PostgreSQL rejected the connection while starting/recovering.
  // A hot standby that really accepts reads is detected as READ_ONLY by the probe.
  if (code === '57P03') {
    return DatabaseState.UNAVAILABLE
  }

  if (
    READ_ONLY_CODES.has(code) ||
    message.includes('read-only') ||
    message.includes('read only') ||
    message.includes('recovery mode') ||
    message.includes('hot standby')
  ) {
    return DatabaseState.READ_ONLY
  }

  if (
    UNAVAILABLE_CODES.has(code) ||
    String(code || '').startsWith('08') ||
    message.includes('connection refused') ||
    message.includes('connection terminated') ||
    message.includes('connection timeout') ||
    message.includes('connect timeout')
  ) {
    return DatabaseState.UNAVAILABLE
  }

  return DatabaseState.UNKNOWN
}

export function isDatabaseAvailabilityError(error) {
  return classifyDatabaseError(error) !== DatabaseState.UNKNOWN
}

export async function probeDatabaseState(database) {
  const result = await database.query(`
    SELECT
      pg_is_in_recovery() AS in_recovery,
      current_setting('transaction_read_only') = 'on' AS transaction_read_only
  `)
  const row = result.rows?.[0]

  if (!row) return DatabaseState.UNKNOWN
  if (row.in_recovery === true || row.transaction_read_only === true) {
    return DatabaseState.READ_ONLY
  }
  return DatabaseState.READ_WRITE
}

function logTransition(logger, previousState, state, reason) {
  if (typeof logger?.info !== 'function') return
  logger.info({
    event: 'database_state_changed',
    previousState,
    state,
    reason
  }, 'database_state_changed')
}

export function createDatabaseAvailability({
  probe,
  logger,
  initialState = DatabaseState.UNKNOWN,
  freshnessMs = 5000,
  now = Date.now
}) {
  if (typeof probe !== 'function') {
    throw new TypeError('Database availability requires a probe function')
  }

  let state = initialState
  let lastCheckedAtMs = null
  let transitions = 0
  let probePromise = null
  const listeners = new Set()

  function setState(nextState, reason = 'unknown') {
    const checkedAt = now()
    lastCheckedAtMs = checkedAt

    if (state === nextState) return state

    const previousState = state
    state = nextState
    transitions += 1
    logTransition(logger, previousState, state, reason)

    for (const listener of listeners) {
      listener({ previousState, state, reason, checkedAt })
    }

    return state
  }

  function getState() {
    return state
  }

  function getStatus() {
    return {
      state,
      lastCheckedAt: lastCheckedAtMs === null
        ? null
        : new Date(lastCheckedAtMs).toISOString(),
      transitions
    }
  }

  function isFresh() {
    return lastCheckedAtMs !== null && now() - lastCheckedAtMs < freshnessMs
  }

  function check({ force = false } = {}) {
    if (!force && state !== DatabaseState.UNKNOWN && isFresh()) {
      return Promise.resolve(state)
    }
    if (probePromise) return probePromise

    const promise = Promise.resolve().then(async () => {
      try {
        const probedState = await probe()
        const nextState = Object.values(DatabaseState).includes(probedState)
          ? probedState
          : DatabaseState.UNKNOWN
        return setState(nextState, 'probe')
      } catch (error) {
        const classifiedState = classifyDatabaseError(error)
        if (classifiedState === DatabaseState.UNKNOWN) {
          lastCheckedAtMs = now()
          if (typeof logger?.warn === 'function') {
            logger.warn({
              event: 'database_probe_failed',
              errorCode: error?.code || error?.name || 'UNKNOWN'
            }, 'database_probe_failed')
          }
          return state
        }
        return setState(classifiedState, 'probe_error')
      } finally {
        if (probePromise === promise) probePromise = null
      }
    })

    probePromise = promise
    return promise
  }

  function recordError(error, reason = 'request_error') {
    const classifiedState = classifyDatabaseError(error)
    if (classifiedState !== DatabaseState.UNKNOWN) {
      setState(classifiedState, reason)
    }
    return classifiedState
  }

  function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return {
    check,
    getState,
    getStatus,
    markReadOnly: (reason = 'read_only') => setState(DatabaseState.READ_ONLY, reason),
    markReadWrite: (reason = 'read_write') => setState(DatabaseState.READ_WRITE, reason),
    markUnavailable: (reason = 'unavailable') => setState(DatabaseState.UNAVAILABLE, reason),
    recordError,
    setState,
    subscribe
  }
}
