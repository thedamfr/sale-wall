import { describe, it, expect } from '@jest/globals';
import { fetchEpisodeFromRSS } from '../../server/services/castopodRSS.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock fetch to use local test data
global.fetch = async (url) => {
  const xmlPath = path.join(__dirname, '../../test_data/castopod_rss_minimal.xml');
  const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
  return {
    ok: true,
    text: async () => xmlContent
  };
};

describe('Castopod RSS Parser', () => {
  describe('fetchEpisodeFromRSS', () => {
    it('should parse episode S2E1 from RSS', async () => {
      // RED: Function doesn't exist yet
      const episode = await fetchEpisodeFromRSS(2, 1);
      
      expect(episode).toBeTruthy();
      expect(episode.season).toBe(2);
      expect(episode.episode).toBe(1);
      expect(episode.title).toBe('Une collaboration… un peu spéciale 🌶️');
      expect(episode.description).toContain('Dans la tech');
      expect(episode.duration).toBe('43:11'); // 2591 seconds = 43:11
      expect(episode.audioUrl).toContain('.mp3');
    });

    it('should parse episode S1E5 from RSS', async () => {
      const episode = await fetchEpisodeFromRSS(1, 5);
      
      expect(episode).toBeTruthy();
      expect(episode.season).toBe(1);
      expect(episode.episode).toBe(5);
      expect(episode.title).toBe('BOUCLIER 🛡️');
    });

    it('should return null for non-existent episode', async () => {
      const episode = await fetchEpisodeFromRSS(99, 99);
      
      expect(episode).toBeNull();
    });

    it('should format pubDate in French', async () => {
      const episode = await fetchEpisodeFromRSS(2, 1);
      
      expect(episode.pubDate).toMatch(/\d{1,2} (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) \d{4}/);
    });

    it('should handle timeout after 5 seconds', async () => {
      // Mock slow fetch
      global.fetch = async () => {
        await new Promise(resolve => setTimeout(resolve, 6000));
        return { ok: true, text: async () => '<rss></rss>' };
      };

      await expect(fetchEpisodeFromRSS(1, 1, 5000)).rejects.toThrow();
    });
  });
});
