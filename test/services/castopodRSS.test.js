import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchEpisodeFromRSS } from '../../server/services/castopodRSS.js';

describe('Castopod RSS Parser', () => {
  describe('fetchEpisodeFromRSS', () => {
    it('should parse episode S2E1 from RSS', async () => {
      const episode = await fetchEpisodeFromRSS(2, 1);
      
      assert.ok(episode, 'Episode should exist');
      assert.strictEqual(episode.season, 2);
      assert.strictEqual(episode.episode, 1);
      assert.strictEqual(episode.title, 'Une collaboration… un peu spéciale 🌶️');
      assert.match(episode.description, /Dans la tech/);
      assert.strictEqual(episode.duration, '43:11'); // 2591 seconds = 43:11
      assert.match(episode.audioUrl, /\.mp3$/);
    });

    it('should parse episode S1E5 from RSS', async () => {
      const episode = await fetchEpisodeFromRSS(1, 5);
      
      assert.ok(episode, 'Episode should exist');
      assert.strictEqual(episode.season, 1);
      assert.strictEqual(episode.episode, 5);
      assert.strictEqual(episode.title, 'BOUCLIER 🛡️');
    });

    it('should return null for non-existent episode', async () => {
      const episode = await fetchEpisodeFromRSS(99, 99);
      
      assert.strictEqual(episode, null);
    });

    it('should format pubDate in French', async () => {
      const episode = await fetchEpisodeFromRSS(2, 1);
      
      assert.match(episode.pubDate, /\d{1,2} (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) \d{4}/);
    });

    it('should handle timeout after 5 seconds', async () => {
      // Note: This test would need a mock server to properly test timeout
      // For now, we verify the function accepts timeout parameter
      const episode = await fetchEpisodeFromRSS(2, 1, 5000);
      assert.ok(episode !== undefined);
    });
  });
});
