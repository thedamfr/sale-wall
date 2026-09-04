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

function episodeData() {
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
    feedLastBuildDate: '2026-09-04T08:00:00.000Z'
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

async function createApp(platformLinks = null, { channelUrl = youtubeChannelUrl } = {}) {
  const app = await buildApp({
    initializeStorage: false,
    databaseConfigured: false,
    databaseAdapter: databaseAdapter(platformLinks),
    databaseAvailability: createDatabaseAvailability({
      initialState: DatabaseState.READ_WRITE,
      probe: async () => DatabaseState.READ_WRITE
    }),
    episodeFetcher: async () => episodeData(),
    podcastEpisodesFetcher: async () => [],
    youtubeChannelUrl: channelUrl,
    youtubeEpisodeResolutionEnabled: true
  })
  apps.push(app)
  return app
}

function availabilitySection(body, id) {
  const match = body.match(new RegExp(`<section[^>]+id="${id}"[\\s\\S]*?<\\/section>`))
  assert.ok(match, `Expected the ${id} section to be rendered`)
  return match[0]
}

describe('podcast format and platform availability', () => {
  test('names the audio platforms and YouTube video availability on /podcast', async () => {
    const app = await createApp()

    const response = await app.inject({ method: 'GET', url: '/podcast' })
    const availability = availabilitySection(response.body, 'podcast-availability')

    assert.equal(response.statusCode, 200)
    assert.match(response.body, /Choisis ton format et ta plateforme/)
    assert.match(availability, /Écouter ou regarder Charbon &amp; Wafer/)
    assert.match(availability, /Castopod/)
    assert.match(availability, /Apple Podcasts/)
    assert.match(availability, /Spotify/)
    assert.match(availability, /Deezer/)
    assert.match(availability, /Podcast Addict/)
    assert.match(availability, /Les épisodes filmés sont disponibles en vidéo sur YouTube/)
  })

  test('does not advertise video on /podcast without a configured channel', async () => {
    const app = await createApp(null, { channelUrl: null })

    const response = await app.inject({ method: 'GET', url: '/podcast' })
    const availability = availabilitySection(response.body, 'podcast-availability')

    assert.equal(response.statusCode, 200)
    assert.match(availability, /Disponible sur Castopod, Apple Podcasts, Spotify, Deezer et Podcast Addict/)
    assert.doesNotMatch(availability, /disponibles en vidéo sur YouTube/)
  })

  test('announces video only when the episode has a resolved YouTube link', async () => {
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
    const availability = availabilitySection(response.body, 'episode-availability')

    assert.equal(response.statusCode, 200)
    assert.match(availability, /Formats disponibles pour cet épisode/)
    assert.match(availability, /Cet épisode est aussi disponible en vidéo sur YouTube/)
    assert.match(availability, /Castopod/)
    assert.match(availability, /Apple Podcasts/)
    assert.match(availability, /Spotify/)
    assert.match(availability, /Deezer/)
    assert.match(availability, /Podcast Addict/)
  })

  test('does not claim a video or unresolved direct audio platforms', async () => {
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
    const availability = availabilitySection(response.body, 'episode-availability')

    assert.equal(response.statusCode, 200)
    assert.match(availability, /Castopod/)
    assert.match(availability, /Spotify/)
    assert.doesNotMatch(availability, /disponible en vidéo sur YouTube/)
    assert.doesNotMatch(availability, /Apple Podcasts/)
    assert.doesNotMatch(availability, /Deezer/)
    assert.doesNotMatch(availability, /Podcast Addict/)
  })
})
