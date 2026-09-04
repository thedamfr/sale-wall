import { afterEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../../server.js'
import {
  createDatabaseAvailability,
  DatabaseState
} from '../../server/resilience/databaseAvailability.js'

const apps = []
const youtubeChannelUrl = 'https://www.youtube.com/@charbonwafer'

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

function episodeData({ hasVideo = true, videoFormats = { mp4: true, hls: true } } = {}) {
  return {
    season: 3,
    episode: 1,
    title: 'Mais l’IA consomme de l’eau',
    description: 'Description de test.',
    duration: '26:04',
    image: 'https://media.example/episode.jpg',
    episodeLink: 'https://podcasts.example/episode',
    audioUrl: null,
    itemGuid: 'guid-3-1',
    rawPubDate: '2026-08-25',
    feedLastBuildDate: '2026-09-04T08:00:00.000Z',
    hasVideo,
    videoFormats
  }
}

function databaseAdapter(platformLinks = null) {
  return {
    pool: { async query() { return { rows: [] } } },
    async connect() {
      return {
        async query() {
          return { rows: platformLinks ? [platformLinks] : [] }
        },
        release() {}
      }
    }
  }
}

async function createApp(platformLinks = null, {
  channelUrl = youtubeChannelUrl,
  episode = episodeData(),
  episodes = [episode]
} = {}) {
  const app = await buildApp({
    initializeStorage: false,
    databaseConfigured: false,
    databaseAdapter: databaseAdapter(platformLinks),
    databaseAvailability: createDatabaseAvailability({
      initialState: DatabaseState.READ_WRITE,
      probe: async () => DatabaseState.READ_WRITE
    }),
    episodeFetcher: async () => episode,
    podcastEpisodesFetcher: async () => episodes,
    youtubeChannelUrl: channelUrl,
    youtubeEpisodeResolutionEnabled: true
  })
  apps.push(app)
  return app
}

function elementById(body, tag, id) {
  const match = body.match(new RegExp(`<${tag}[^>]+id="${id}"[\\s\\S]*?<\\/${tag}>`))
  assert.ok(match, `Expected the ${id} element to be rendered`)
  return match[0]
}

describe('podcast format and platform availability', () => {
  test('shows a discreet video badge with the known platforms on /podcast', async () => {
    const app = await createApp()

    const response = await app.inject({ method: 'GET', url: '/podcast' })
    const availability = elementById(response.body, 'p', 'podcast-video-availability')

    assert.equal(response.statusCode, 200)
    assert.match(response.body, /Choisis ton format et ta plateforme/)
    assert.match(availability, />Vidéo</)
    assert.match(availability, /Site officiel/)
    assert.match(availability, /Apple Podcasts/)
    assert.match(availability, /Spotify \(HD\)/)
    assert.match(availability, /YouTube/)
    assert.doesNotMatch(response.body, /id="podcast-availability"/)
  })

  test('does not advertise video on /podcast when the feed and channel expose none', async () => {
    const audioEpisode = episodeData({
      hasVideo: false,
      videoFormats: { mp4: false, hls: false }
    })
    const app = await createApp(null, {
      channelUrl: null,
      episode: audioEpisode,
      episodes: [audioEpisode]
    })

    const response = await app.inject({ method: 'GET', url: '/podcast' })

    assert.equal(response.statusCode, 200)
    assert.doesNotMatch(response.body, /id="podcast-video-availability"/)
  })

  test('marks an RSS video episode as available on its direct platforms', async () => {
    const app = await createApp({
      spotify_url: 'https://open.spotify.com/episode/direct',
      apple_url: 'https://podcasts.apple.com/episode/direct',
      deezer_url: 'https://deezer.com/episode/direct',
      podcast_addict_url: 'https://podcastaddict.com/episode/direct',
      youtube_url: 'https://www.youtube.com/watch?v=Bbbbbbbbb-1',
      og_image_url: 'https://media.example/og.png',
      feed_last_build: '2026-09-04T08:00:00.000Z',
      generated_at: new Date().toISOString()
    })

    const response = await app.inject({ method: 'GET', url: '/podcast/3/1' })
    const availability = elementById(response.body, 'div', 'episode-video-availability')

    assert.equal(response.statusCode, 200)
    assert.match(availability, />Vidéo</)
    assert.match(availability, /Site officiel/)
    assert.match(availability, /Apple Podcasts/)
    assert.match(availability, /Spotify \(HD\)/)
    assert.match(availability, /YouTube/)
    assert.match(
      response.body,
      /href="https:\/\/open\.spotify\.com\/episode\/direct"[\s\S]*?>Vidéo HD<\/span>[\s\S]*?<\/a>/
    )
    assert.doesNotMatch(response.body, /id="episode-availability"/)
  })

  test('keeps RSS video availability visible while YouTube resolution is pending', async () => {
    const app = await createApp({
      spotify_url: 'https://open.spotify.com/episode/direct',
      apple_url: null,
      deezer_url: null,
      podcast_addict_url: null,
      youtube_url: null,
      og_image_url: 'https://media.example/og.png',
      feed_last_build: '2026-09-04T08:00:00.000Z',
      generated_at: new Date().toISOString()
    })

    const response = await app.inject({ method: 'GET', url: '/podcast/3/1' })
    const availability = elementById(response.body, 'div', 'episode-video-availability')

    assert.equal(response.statusCode, 200)
    assert.match(availability, /Site officiel/)
    assert.match(availability, /Spotify \(HD\)/)
    assert.doesNotMatch(availability, /Apple Podcasts/)
    assert.doesNotMatch(availability, /YouTube/)
  })

  test('lists only YouTube when the feed has no video enclosure', async () => {
    const app = await createApp({
      spotify_url: null,
      apple_url: null,
      deezer_url: null,
      podcast_addict_url: null,
      youtube_url: 'https://www.youtube.com/watch?v=Bbbbbbbbb-1',
      og_image_url: 'https://media.example/og.png',
      feed_last_build: '2026-09-04T08:00:00.000Z',
      generated_at: new Date().toISOString()
    }, {
      episode: episodeData({
        hasVideo: false,
        videoFormats: { mp4: false, hls: false }
      })
    })

    const response = await app.inject({ method: 'GET', url: '/podcast/3/1' })
    const availability = elementById(response.body, 'div', 'episode-video-availability')

    assert.equal(response.statusCode, 200)
    assert.match(availability, /YouTube/)
    assert.doesNotMatch(availability, /Site officiel/)
    assert.doesNotMatch(availability, /Apple Podcasts/)
    assert.doesNotMatch(availability, /Spotify \(HD\)/)
  })
})
