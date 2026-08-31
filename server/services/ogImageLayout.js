import { createHash } from 'node:crypto'

export const OG_IMAGE_LAYOUT_VERSION = '2'
export const OG_IMAGE_CENTER_SIZE = 560

function normalizeFeedLastBuildDate(feedLastBuildDate) {
  if (!feedLastBuildDate) return ''
  if (feedLastBuildDate instanceof Date) return feedLastBuildDate.toISOString()
  return String(feedLastBuildDate)
}

export function getOGImageS3Key({
  season,
  episode,
  imageUrl,
  feedLastBuildDate
}) {
  const fingerprint = JSON.stringify({
    layoutVersion: OG_IMAGE_LAYOUT_VERSION,
    season,
    episode,
    imageUrl: imageUrl || '',
    feedLastBuildDate: normalizeFeedLastBuildDate(feedLastBuildDate)
  })
  const digest = createHash('sha256').update(fingerprint).digest('hex').slice(0, 16)

  return `og-images/s${season}e${episode}-${digest}.png`
}

export function isExpectedOGImageUrl(ogImageUrl, expectedS3Key) {
  if (!ogImageUrl || !expectedS3Key) return false

  try {
    const pathname = decodeURIComponent(new URL(ogImageUrl).pathname)
    return pathname.endsWith(`/${expectedS3Key}`)
  } catch {
    return false
  }
}
