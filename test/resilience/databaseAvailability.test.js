import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyDatabaseError,
  createDatabaseAvailability,
  DatabaseState,
  probeDatabaseState
} from '../../server/resilience/databaseAvailability.js'

describe('database availability', () => {
  test('classifies recovery, connection and programming errors separately', () => {
    assert.equal(
      classifyDatabaseError(Object.assign(
        new Error('the database system is in recovery mode'),
        { code: '57P03' }
      )),
      DatabaseState.UNAVAILABLE
    )
    assert.equal(
      classifyDatabaseError(Object.assign(new Error('connection refused'), {
        code: 'ECONNREFUSED'
      })),
      DatabaseState.UNAVAILABLE
    )
    assert.equal(
      classifyDatabaseError(Object.assign(new Error('read-only transaction'), {
        code: '25006'
      })),
      DatabaseState.READ_ONLY
    )
    assert.equal(
      classifyDatabaseError(Object.assign(new Error('relation does not exist'), {
        code: '42P01'
      })),
      DatabaseState.UNKNOWN
    )
  })

  test('shares one probe and records a read-only result', async () => {
    let resolveProbe
    let probeCalls = 0
    const probeGate = new Promise((resolve) => {
      resolveProbe = resolve
    })
    const availability = createDatabaseAvailability({
      probe: () => {
        probeCalls += 1
        return probeGate
      },
      now: () => 1000
    })

    const checks = Array.from({ length: 20 }, () => availability.check())
    resolveProbe(DatabaseState.READ_ONLY)

    assert.deepEqual(
      await Promise.all(checks),
      Array.from({ length: 20 }, () => DatabaseState.READ_ONLY)
    )
    assert.equal(probeCalls, 1)
    assert.deepEqual(availability.getStatus(), {
      state: DatabaseState.READ_ONLY,
      lastCheckedAt: new Date(1000).toISOString(),
      transitions: 1
    })
  })

  test('probes PostgreSQL write capability instead of only connectivity', async () => {
    const queries = []
    const database = {
      async query(sql) {
        queries.push(sql)
        return {
          rows: [{ in_recovery: false, transaction_read_only: true }]
        }
      }
    }

    assert.equal(await probeDatabaseState(database), DatabaseState.READ_ONLY)
    assert.equal(queries.length, 1)
    assert.match(queries[0], /pg_is_in_recovery/)
    assert.match(queries[0], /transaction_read_only/)
  })

  test('does not downgrade a known database state for an SQL programming error', async () => {
    const availability = createDatabaseAvailability({
      initialState: DatabaseState.READ_WRITE,
      probe: async () => {
        throw Object.assign(new Error('relation does not exist'), {
          code: '42P01'
        })
      }
    })

    assert.equal(
      await availability.check({ force: true }),
      DatabaseState.READ_WRITE
    )
    assert.equal(availability.getState(), DatabaseState.READ_WRITE)
  })
})
