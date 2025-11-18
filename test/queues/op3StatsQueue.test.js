// test/queues/op3StatsQueue.test.js
import 'dotenv/config'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initOp3StatsQueue, queueOp3StatsRefresh } from '../../server/queues/op3StatsQueue.js'

const DB_URL = process.env.DATABASE_URL

// TDD strict : on teste d'abord le service OP3 seul
// TODO: Décommenter ce test une fois le service OP3 validé
/*
test('should initialize op3StatsQueue and publish job', async () => {
  const boss = await initOp3StatsQueue(DB_URL)
  assert.ok(boss)
  await queueOp3StatsRefresh()
  // No error means publish succeeded
})
*/
