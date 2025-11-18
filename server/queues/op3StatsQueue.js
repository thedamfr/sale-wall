// op3StatsQueue.js
// PGBoss job queue for refreshing OP3 stats cache

import PgBoss from 'pg-boss'
import { refreshOp3StatsCache } from '../services/op3Service.js'

let boss

export async function initOp3StatsQueue(dbUrl) {
  console.log(`dbUrl: ${dbUrl}`)
  boss = new PgBoss({ connectionString: dbUrl })
  await boss.start()
  await boss.subscribe('op3-stats-refresh', async job => {
    await refreshOp3StatsCache()
    return 'done'
  })
  return boss
}

export async function queueOp3StatsRefresh() {
  if (!boss) throw new Error('PGBoss not initialized')
  await boss.publish('op3-stats-refresh')
}
