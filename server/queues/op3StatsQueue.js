import { refreshOp3StatsCache } from '../services/op3Service.js'

export const OP3_STATS_QUEUE = 'op3-stats-refresh'
const OP3_SCHEDULE_KEY = 'daily-v1'
const DAILY_SECONDS = 24 * 60 * 60

export function isOp3Configured(env = process.env) {
  return Boolean(env.OP3_API_TOKEN && env.OP3_GUID)
}

export async function registerOp3StatsQueue(boss, fastify, {
  env = process.env,
  refresh = refreshOp3StatsCache
} = {}) {
  if (!isOp3Configured(env)) return { status: 'disabled' }
  if (!boss) throw new TypeError('OP3 stats queue requires the shared pg-boss instance')

  await boss.createQueue(OP3_STATS_QUEUE)
  await boss.work(OP3_STATS_QUEUE, { teamSize: 1 }, async () => refresh({
    pool: fastify.pg.pool,
    databaseState: fastify.databaseAvailability.getState(),
    token: env.OP3_API_TOKEN,
    podcastGuid: env.OP3_GUID
  }))
  await boss.schedule(OP3_STATS_QUEUE, '0 3 * * *', {}, {
    key: OP3_SCHEDULE_KEY,
    tz: 'Europe/Paris',
    singletonKey: OP3_SCHEDULE_KEY,
    singletonSeconds: DAILY_SECONDS
  })
  await boss.send(OP3_STATS_QUEUE, {}, {
    singletonKey: OP3_SCHEDULE_KEY,
    singletonSeconds: DAILY_SECONDS
  })

  return { status: 'ready' }
}
