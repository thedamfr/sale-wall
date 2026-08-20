import { afterEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../../server.js'
import {
  createDatabaseAvailability,
  DatabaseState
} from '../../server/resilience/databaseAvailability.js'

const NOW = new Date('2026-08-20T12:00:00.000Z')
const apps = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

function publishedEpisodes() {
  return [
    {
      season: 2,
      episode: 3,
      title: 'Le troisième épisode',
      description: 'Un extrait concret pour donner envie de découvrir cet épisode.',
      duration: '38:12',
      image: 'https://media.example/episode-3.jpg',
      episodeLink: 'https://podcasts.example/3',
      itemGuid: 'guid-3',
      rawPubDate: '2026-08-15'
    },
    {
      season: 2,
      episode: 2,
      title: 'Le deuxième épisode',
      description: 'Deuxième description.',
      duration: '41:00',
      image: 'https://media.example/episode-2.jpg',
      episodeLink: 'https://podcasts.example/2',
      itemGuid: 'guid-2',
      rawPubDate: '2026-08-08'
    },
    {
      season: 2,
      episode: 1,
      title: 'Le premier épisode',
      description: 'Première description.',
      duration: '43:11',
      image: 'https://media.example/episode-1.jpg',
      episodeLink: 'https://podcasts.example/1',
      itemGuid: 'guid-1',
      rawPubDate: '2026-08-01'
    }
  ]
}

function availability(initialState, probe) {
  return createDatabaseAvailability({ initialState, probe })
}

function databaseAdapter({ episodeStats } = {}) {
  const row = episodeStats || null
  return {
    async query() { return { rows: [] } },
    pool: {
      async query() {
        return { rows: row ? [row] : [] }
      }
    },
    async connect() {
      return {
        async query() {
          return {
            rows: [{
              spotify_url: 'https://open.spotify.com/episode/direct',
              apple_url: 'https://podcasts.apple.com/episode/direct',
              deezer_url: 'https://deezer.com/episode/direct',
              podcast_addict_url: null,
              og_image_url: 'https://media.example/og.png',
              feed_last_build: '2026-08-20T08:00:00.000Z',
              generated_at: '2026-08-20T08:00:00.000Z'
            }]
          }
        },
        release() {}
      }
    }
  }
}

async function createApp(options = {}) {
  const app = await buildApp({
    initializeStorage: false,
    databaseConfigured: false,
    databaseAdapter: databaseAdapter(),
    databaseAvailability: availability(DatabaseState.READ_WRITE, async () => DatabaseState.READ_WRITE),
    op3PublicStatsEnabled: true,
    now: () => NOW,
    ...options
  })
  apps.push(app)
  return app
}

describe('podcast canonical URL', () => {
  test('redirects /podcast/ permanently while preserving ordinary query parameters', async () => {
    const app = await createApp()

    const response = await app.inject({ method: 'GET', url: '/podcast/?source=newsletter' })

    assert.equal(response.statusCode, 301)
    assert.equal(response.headers.location, '/podcast?source=newsletter')
  })

  test('keeps compatibility for slash URLs with season and episode', async () => {
    const app = await createApp()

    const response = await app.inject({
      method: 'GET',
      url: '/podcast/?season=2&episode=1'
    })

    assert.equal(response.statusCode, 301)
    assert.equal(response.headers.location, '/podcast/2/1')
  })
})

describe('GET /podcast traction card', () => {
  test('renders the selected popular episode from RSS and cached OP3 stats', async () => {
    let queueCalls = 0
    const app = await createApp({
      podcastEpisodesFetcher: async () => publishedEpisodes(),
      op3StatsListReader: async () => [
        { itemGuid: 'guid-1', downloads7: 12, downloadsAll: 30, fetchedAt: NOW },
        { itemGuid: 'guid-2', downloads7: 18, downloadsAll: 60, fetchedAt: NOW },
        { itemGuid: 'guid-3', downloads7: 42, downloadsAll: 80, fetchedAt: NOW }
      ],
      episodeQueuer: async () => {
        queueCalls += 1
        return { queued: true }
      }
    })

    const response = await app.inject({ method: 'GET', url: '/podcast' })

    assert.equal(response.statusCode, 200)
    assert.match(response.body, /Le plus populaire cette semaine/)
    assert.match(response.body, /Le troisième épisode/)
    assert.match(response.body, /42 téléchargements mesurés par OP3/)
    assert.match(response.body, /href="\/podcast\/2\/3"/)
    assert.match(response.body, /media\.example\/episode-3\.jpg/)
    assert.equal(queueCalls, 0)
  })

  test('renders the editorial fallback without a DB probe or RSS call', async () => {
    let probeCalls = 0
    let rssCalls = 0
    let statsCalls = 0
    const app = await createApp({
      databaseAvailability: availability(DatabaseState.UNAVAILABLE, async () => {
        probeCalls += 1
        return DatabaseState.UNAVAILABLE
      }),
      podcastEpisodesFetcher: async () => {
        rssCalls += 1
        return publishedEpisodes()
      },
      op3StatsListReader: async () => {
        statsCalls += 1
        return []
      }
    })

    const response = await app.inject({ method: 'GET', url: '/podcast' })

    assert.equal(response.statusCode, 200)
    assert.match(response.body, /Le Podcast est sorti/)
    assert.equal(probeCalls, 0)
    assert.equal(rssCalls, 0)
    assert.equal(statsCalls, 0)
  })

  test('renders the editorial fallback when the RSS fetch fails', async () => {
    const app = await createApp({
      podcastEpisodesFetcher: async () => { throw new Error('RSS unavailable') },
      op3StatsListReader: async () => { throw new Error('must not read stats') }
    })

    const response = await app.inject({ method: 'GET', url: '/podcast' })

    assert.equal(response.statusCode, 200)
    assert.match(response.body, /Le Podcast est sorti/)
    assert.doesNotMatch(response.body, /RSS unavailable/)
  })

  test('renders the editorial fallback when the optional cache read fails', async () => {
    const databaseAvailability = availability(
      DatabaseState.READ_WRITE,
      async () => DatabaseState.READ_WRITE
    )
    const error = new Error('database connection lost')
    error.code = 'ECONNRESET'
    const app = await createApp({
      databaseAvailability,
      podcastEpisodesFetcher: async () => publishedEpisodes(),
      op3StatsListReader: async () => { throw error }
    })

    const response = await app.inject({ method: 'GET', url: '/podcast' })

    assert.equal(response.statusCode, 200)
    assert.match(response.body, /Le Podcast est sorti/)
    assert.doesNotMatch(response.body, /database connection lost/)
    assert.equal(databaseAvailability.getState(), DatabaseState.UNAVAILABLE)
  })

  test('does no RSS or cache work while public stats are disabled', async () => {
    let calls = 0
    const app = await createApp({
      op3PublicStatsEnabled: false,
      podcastEpisodesFetcher: async () => { calls += 1; return publishedEpisodes() },
      op3StatsListReader: async () => { calls += 1; return [] }
    })

    const response = await app.inject({ method: 'GET', url: '/podcast' })

    assert.equal(response.statusCode, 200)
    assert.match(response.body, /Le Podcast est sorti/)
    assert.equal(calls, 0)
  })
})

describe('episode OP3 proof', () => {
  test('shows a stable accessible download badge without IAB claims', async () => {
    const rssEpisode = {
      ...publishedEpisodes()[0],
      pubDate: '15 août 2026',
      rawPubDate: '2026-08-15',
      audioUrl: 'https://media.example/episode-3.mp3',
      feedLastBuildDate: '2026-08-20T08:00:00.000Z',
      isTruncated: false
    }
    const app = await createApp({
      episodeFetcher: async () => rssEpisode,
      op3EpisodeStatsReader: async () => ({
        itemGuid: 'guid-3',
        downloads7: 4,
        downloads30: 30,
        downloadsAll: 81,
        fetchedAt: NOW
      })
    })

    const response = await app.inject({ method: 'GET', url: '/podcast/2/3' })

    assert.equal(response.statusCode, 200)
    assert.match(response.body, /81 téléchargements mesurés par OP3/)
    assert.match(response.body, /Un téléchargement peut être automatique/)
    assert.doesNotMatch(response.body, /certifi[ée].*IAB/i)
  })

  test('hides a weak download count on an episode page', async () => {
    const rssEpisode = {
      ...publishedEpisodes()[0],
      pubDate: '15 août 2026',
      audioUrl: 'https://media.example/episode-3.mp3',
      feedLastBuildDate: '2026-08-20T08:00:00.000Z',
      isTruncated: false
    }
    const app = await createApp({
      episodeFetcher: async () => rssEpisode,
      op3EpisodeStatsReader: async () => ({
        itemGuid: 'guid-3',
        downloadsAll: 9,
        fetchedAt: NOW
      })
    })

    const response = await app.inject({ method: 'GET', url: '/podcast/2/3' })

    assert.equal(response.statusCode, 200)
    assert.doesNotMatch(response.body, /téléchargements mesurés par OP3/)
  })
})
