import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const files = {
  op3Adr: new URL('../../documentation/adr/adr_0015_op3_stats_integration.md', import.meta.url),
  spotifyAdr: new URL('../../documentation/adr/adr_0011_podcast_smartlink_multiplateforme.md', import.meta.url),
  authScript: new URL('../../scripts/test-op3-api-auth.js', import.meta.url),
  integrationScript: new URL('../../scripts/test-op3-integration.js', import.meta.url),
  op3Queue: new URL('../../server/queues/op3StatsQueue.js', import.meta.url),
  episodeQueue: new URL('../../server/queues/episodeQueue.js', import.meta.url)
}

describe('OP3 secret hygiene', () => {
  test('keeps real credentials and credential fragments out of documentation and logs', async () => {
    const [op3Adr, spotifyAdr, authScript, integrationScript, op3Queue, episodeQueue] = await Promise.all(
      Object.values(files).map((file) => readFile(file, 'utf8'))
    )
    const inspectedLogs = [authScript, integrationScript, op3Queue, episodeQueue].join('\n')

    assert.doesNotMatch(op3Adr, /OP3_API_TOKEN=[A-Za-z0-9_-]{20,}/)
    assert.doesNotMatch(spotifyAdr, /SPOTIFY_CLIENT_SECRET=(?![<{]|YOUR_)[A-Za-z0-9_-]{12,}/)
    assert.doesNotMatch(authScript, /(?:substring|slice)\s*\(\s*0\s*,\s*10\s*\)/)
    assert.doesNotMatch(
      inspectedLogs,
      /console\.(?:log|info|warn|error)\([^\n]*(?:\$\{(?:dbUrl|connectionString)\}|process\.env\.(?:DATABASE_URL|POSTGRESQL_ADDON_URI)|,\s*(?:dbUrl|connectionString)\b)/
    )
  })
})
