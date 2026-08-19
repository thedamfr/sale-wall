import { EventEmitter } from 'node:events'
import { afterEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getBoss,
  initializeEpisodeWorker,
  queueEpisodeResolution,
  stopQueue
} from '../../server/queues/episodeQueue.js'

function createFakeBoss({ failAt } = {}) {
  const candidate = new EventEmitter()
  candidate.calls = []
  candidate.stopCalls = 0
  candidate.start = async () => {
    candidate.calls.push('start')
    if (failAt === 'start') throw new Error('start failed')
  }
  candidate.createQueue = async (name) => {
    candidate.calls.push(`createQueue:${name}`)
    if (failAt === 'createQueue') throw new Error('create queue failed')
  }
  candidate.work = async (name, options, handler) => {
    candidate.calls.push(`work:${name}`)
    candidate.workerOptions = options
    candidate.handler = handler
    candidate.publishedDuringWork = getBoss()
    if (failAt === 'work') throw new Error('worker registration failed')
  }
  candidate.send = async () => '00000000-0000-0000-0000-000000000001'
  candidate.stop = async () => {
    candidate.stopCalls += 1
  }
  return candidate
}

afterEach(async () => {
  await stopQueue()
})

describe('episodeQueue lifecycle', () => {
  test('does not publish a partially initialized pg-boss instance', async () => {
    const candidate = createFakeBoss({ failAt: 'work' })

    await assert.rejects(
      initializeEpisodeWorker(
        { pg: {} },
        { queueOptions: { bossFactory: () => candidate } }
      ),
      /worker registration failed/
    )

    assert.equal(candidate.publishedDuringWork, null)
    assert.equal(getBoss(), null)
    assert.equal(candidate.stopCalls, 1)
    assert.deepEqual(candidate.calls, [
      'start',
      'createQueue:resolve-episode',
      'work:resolve-episode'
    ])
  })

  test('publishes only the fully initialized instance and can enqueue', async () => {
    const candidate = createFakeBoss()

    const initialized = await initializeEpisodeWorker(
      { pg: {} },
      {
        queueOptions: { bossFactory: () => candidate },
        workerOptions: { teamSize: 2 }
      }
    )

    assert.equal(candidate.publishedDuringWork, null)
    assert.equal(initialized, candidate)
    assert.equal(getBoss(), candidate)
    assert.equal(candidate.workerOptions.teamSize, 2)

    const jobId = await queueEpisodeResolution(
      2,
      1,
      '2025-10-27',
      'Test episode',
      'https://example.com/cover.jpg'
    )

    assert.equal(jobId, '00000000-0000-0000-0000-000000000001')
  })
})
