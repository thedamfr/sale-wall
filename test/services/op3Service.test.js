/**
 * TDD - OP3 Service (ADR-0015)
 * Test minimal : cache, fetch, format
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatStatsForDisplay } from '../../server/services/op3Service.js';

test('formatStatsForDisplay: should return null if downloads < 10', () => {
  assert.strictEqual(formatStatsForDisplay(0), null);
  assert.strictEqual(formatStatsForDisplay(9), null);
});

test('formatStatsForDisplay: should format for < 1000 downloads', () => {
  assert.strictEqual(formatStatsForDisplay(12), '12 écoutes');
  assert.strictEqual(formatStatsForDisplay(999), '999 écoutes');
});

test('formatStatsForDisplay: should format for >= 1000 downloads', () => {
  assert.strictEqual(formatStatsForDisplay(1200), '1.2k écoutes');
  assert.strictEqual(formatStatsForDisplay(10000), '10.0k écoutes');
});

// RED: Test cache BDD (mock)
test('getEpisodeStats (cache): should return null if not in cache', async () => {
  // Mock pool.query
  const pool = { query: async () => ({ rows: [] }) };
  const { getEpisodeStats } = await import('../../server/services/op3Service.js');
  const result = await getEpisodeStats(pool, 'fake-guid');
  assert.strictEqual(result, null);
});

// GREEN: Test cache valide avec données
test('getEpisodeStats (cache): should return stats if cache valid', async () => {
  // Oracle: Cache valide (< 24h) retourne downloadsAll, downloads30, fetchedAt, cached=true
  const mockRow = {
    downloads_all: 1234,
    downloads_30: 567,
    fetched_at: new Date()
  };
  const pool = { query: async () => ({ rows: [mockRow] }) };
  const { getEpisodeStats } = await import('../../server/services/op3Service.js');
  
  const result = await getEpisodeStats(pool, 'valid-guid');
  
  assert.strictEqual(result.downloadsAll, 1234);
  assert.strictEqual(result.downloads30, 567);
  assert.strictEqual(result.cached, true);
  assert.ok(result.fetchedAt instanceof Date);
});

// GREEN: Test cache expiré (> 24h)
test('getEpisodeStats (cache): should return null if cache expired', async () => {
  // Oracle: Cache > 24h retourne rows vide (filtre WHERE fetched_at > NOW() - INTERVAL '24 hours')
  const pool = { query: async () => ({ rows: [] }) };
  const { getEpisodeStats } = await import('../../server/services/op3Service.js');
  
  const result = await getEpisodeStats(pool, 'expired-guid');
  
  assert.strictEqual(result, null);
});

// GREEN: Test getShowUuid validation env
test('getShowUuid: should throw if OP3_API_TOKEN missing', async () => {
  // Oracle: Si OP3_API_TOKEN manquant → Error('Missing OP3_API_TOKEN or OP3_GUID in .env')
  const originalToken = process.env.OP3_API_TOKEN;
  delete process.env.OP3_API_TOKEN;
  
  // Reset cached UUID to force re-fetch
  const { getShowUuid } = await import('../../server/services/op3Service.js');
  
  await assert.rejects(
    () => getShowUuid(),
    { message: 'Missing OP3_API_TOKEN or OP3_GUID in .env' }
  );
  
  // Restore env
  process.env.OP3_API_TOKEN = originalToken;
});

test('getShowUuid: should throw if OP3_GUID missing', async () => {
  // Oracle: Si OP3_GUID manquant → Error('Missing OP3_API_TOKEN or OP3_GUID in .env')
  const originalGuid = process.env.OP3_GUID;
  delete process.env.OP3_GUID;
  
  const { getShowUuid } = await import('../../server/services/op3Service.js');
  
  await assert.rejects(
    () => getShowUuid(),
    { message: 'Missing OP3_API_TOKEN or OP3_GUID in .env' }
  );
  
  // Restore env
  process.env.OP3_GUID = originalGuid;
});

// GREEN: Test fetchEpisodeStatsFromOP3 avec mock fetch
test('fetchEpisodeStatsFromOP3: should map API response to { itemGuid, downloadsAll, downloads30 }', async () => {
  // Oracle: API retourne episodes[] → map vers { itemGuid, downloadsAll, downloads30 }
  const mockApiResponse = {
    episodes: [
      { itemGuid: 'guid-1', downloadsAll: 1234, downloads30: 567 },
      { itemGuid: 'guid-2', downloadsAll: 5678, downloads30: null },
      { itemGuid: 'guid-3', downloadsAll: 0, downloads30: 0 }
    ]
  };
  
  // Mock global fetch
  global.fetch = async () => ({
    ok: true,
    json: async () => mockApiResponse
  });
  
  // Mock getShowUuid pour éviter double fetch
  const originalEnv = { token: process.env.OP3_API_TOKEN, guid: process.env.OP3_GUID };
  process.env.OP3_API_TOKEN = 'fake-token';
  process.env.OP3_GUID = 'fake-guid';
  
  const { fetchEpisodeStatsFromOP3 } = await import('../../server/services/op3Service.js');
  const result = await fetchEpisodeStatsFromOP3();
  
  // Valider structure et mapping
  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0].itemGuid, 'guid-1');
  assert.strictEqual(result[0].downloadsAll, 1234);
  assert.strictEqual(result[0].downloads30, 567);
  assert.strictEqual(result[1].downloadsAll, 5678);
  assert.strictEqual(result[1].downloads30, null);
  assert.strictEqual(result[2].downloadsAll, 0);
  
  // Restore env
  process.env.OP3_API_TOKEN = originalEnv.token;
  process.env.OP3_GUID = originalEnv.guid;
  delete global.fetch;
});

// GREEN: Test updateOP3StatsCache avec mock pool et fetchEpisodeStatsFromOP3
test('updateOP3StatsCache: should insert/update each episode in cache and return count', async () => {
  // Oracle: fetchEpisodeStatsFromOP3 → INSERT/UPDATE op3_stats pour chaque épisode → retourne count
  const queries = [];
  const mockPool = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rowCount: 1 };
    }
  };
  
  // Mock fetchEpisodeStatsFromOP3
  const mockEpisodes = [
    { itemGuid: 'guid-1', downloadsAll: 1234, downloads30: 567 },
    { itemGuid: 'guid-2', downloadsAll: 5678, downloads30: null }
  ];
  
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ episodes: mockEpisodes })
  });
  
  const originalEnv = { token: process.env.OP3_API_TOKEN, guid: process.env.OP3_GUID };
  process.env.OP3_API_TOKEN = 'fake-token';
  process.env.OP3_GUID = 'fake-guid';
  
  const { updateOP3StatsCache } = await import('../../server/services/op3Service.js');
  const count = await updateOP3StatsCache(mockPool);
  
  // Valider count et queries
  assert.strictEqual(count, 2);
  assert.strictEqual(queries.length, 2);
  assert.ok(queries[0].sql.includes('INSERT INTO op3_stats'));
  assert.deepStrictEqual(queries[0].params, ['guid-1', 1234, 567]);
  assert.deepStrictEqual(queries[1].params, ['guid-2', 5678, null]);
  
  // Restore
  process.env.OP3_API_TOKEN = originalEnv.token;
  process.env.OP3_GUID = originalEnv.guid;
  delete global.fetch;
});
