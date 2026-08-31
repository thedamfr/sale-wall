import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  getOGImageS3Key,
  isExpectedOGImageUrl
} from '../../server/services/ogImageLayout.js'

const episodeData = {
  season: 3,
  episode: 1,
  imageUrl: 'https://podcast.example/s3e1.png',
  feedLastBuildDate: '2026-08-31T06:00:00.000Z'
}

describe('OG image cache key', () => {
  test('derives a stable SHA key from the episode data and layout version', () => {
    const firstKey = getOGImageS3Key(episodeData)
    const secondKey = getOGImageS3Key({ ...episodeData })

    assert.equal(firstKey, secondKey)
    assert.match(firstKey, /^og-images\/s3e1-[a-f0-9]{16}\.png$/)
  })

  test('changes when data affecting the generated image changes', () => {
    const originalKey = getOGImageS3Key(episodeData)

    assert.notEqual(
      getOGImageS3Key({ ...episodeData, imageUrl: 'https://podcast.example/new.png' }),
      originalKey
    )
    assert.notEqual(
      getOGImageS3Key({ ...episodeData, feedLastBuildDate: '2026-09-01T06:00:00.000Z' }),
      originalKey
    )
  })

  test('recognizes only the expected generated image URL', () => {
    const expectedKey = getOGImageS3Key(episodeData)

    assert.equal(
      isExpectedOGImageUrl(`https://media.example/bucket/${expectedKey}`, expectedKey),
      true
    )
    assert.equal(
      isExpectedOGImageUrl('https://media.example/og-images/s3e1.png', expectedKey),
      false
    )
  })
})
