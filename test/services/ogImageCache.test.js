/**
 * Tests unitaires pour checkOGImageNeeds() (Phase 2.2)
 * Logique de cache invalidation OG Images
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Fonction copiée depuis server.js pour test (DRY violation temporaire)
 * TODO Phase 3: Extraire dans server/services/ogImageCache.js
 */
function checkOGImageNeeds(ogImageUrl, cachedFeedLastBuild, generatedAt, rssFeedLastBuildDate) {
  if (!ogImageUrl) return true;
  
  if (cachedFeedLastBuild && rssFeedLastBuildDate) {
    const cachedDate = new Date(cachedFeedLastBuild);
    const rssDate = new Date(rssFeedLastBuildDate);
    
    if (rssDate > cachedDate) {
      return true;
    }
  }
  
  if (generatedAt) {
    const daysSinceGeneration = (Date.now() - new Date(generatedAt)) / (1000 * 60 * 60 * 24);
    if (daysSinceGeneration > 7) {
      return true;
    }
  }
  
  return false;
}

describe('checkOGImageNeeds', () => {
  it('should return true if no OG image URL', () => {
    const needsRegeneration = checkOGImageNeeds(
      null,                    // ogImageUrl
      '2025-01-01T00:00:00Z', // cachedFeedLastBuild
      '2025-01-01T00:00:00Z', // generatedAt
      '2025-01-01T00:00:00Z'  // rssFeedLastBuildDate
    );
    
    assert.strictEqual(needsRegeneration, true, 'Should regenerate if no OG image');
  });

  it('should return true if RSS lastBuildDate newer than cache', () => {
    const needsRegeneration = checkOGImageNeeds(
      'https://example.com/og.png', // ogImageUrl exists
      '2025-01-01T00:00:00Z',       // cachedFeedLastBuild (old)
      '2025-01-01T00:00:00Z',       // generatedAt (recent)
      '2025-01-10T00:00:00Z'        // rssFeedLastBuildDate (newer!)
    );
    
    assert.strictEqual(needsRegeneration, true, 'Should regenerate if RSS changed');
  });

  it('should return false if RSS lastBuildDate same as cache', () => {
    const needsRegeneration = checkOGImageNeeds(
      'https://example.com/og.png',
      '2025-01-10T00:00:00Z',       // cachedFeedLastBuild
      new Date().toISOString(),     // generatedAt (today)
      '2025-01-10T00:00:00Z'        // rssFeedLastBuildDate (same)
    );
    
    assert.strictEqual(needsRegeneration, false, 'Should NOT regenerate if RSS unchanged');
  });

  it('should return true if OG image older than 7 days', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    
    const needsRegeneration = checkOGImageNeeds(
      'https://example.com/og.png',
      '2025-01-01T00:00:00Z',       // cachedFeedLastBuild
      eightDaysAgo,                 // generatedAt (8 days ago)
      '2025-01-01T00:00:00Z'        // rssFeedLastBuildDate (same)
    );
    
    assert.strictEqual(needsRegeneration, true, 'Should regenerate if image > 7 days old');
  });

  it('should return false if OG image less than 7 days old and RSS unchanged', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    
    const needsRegeneration = checkOGImageNeeds(
      'https://example.com/og.png',
      '2025-01-01T00:00:00Z',
      twoDaysAgo,                   // generatedAt (2 days ago, fresh)
      '2025-01-01T00:00:00Z'        // rssFeedLastBuildDate (same)
    );
    
    assert.strictEqual(needsRegeneration, false, 'Should NOT regenerate if fresh and unchanged');
  });

  it('should handle missing feedLastBuildDate gracefully', () => {
    const needsRegeneration = checkOGImageNeeds(
      'https://example.com/og.png',
      null,                         // cachedFeedLastBuild (missing)
      new Date().toISOString(),     // generatedAt (today)
      '2025-01-01T00:00:00Z'        // rssFeedLastBuildDate
    );
    
    assert.strictEqual(needsRegeneration, false, 'Should fallback to 7-day check if no cached date');
  });

  it('should handle Date objects as RSS lastBuildDate', () => {
    const needsRegeneration = checkOGImageNeeds(
      'https://example.com/og.png',
      '2025-01-01T00:00:00Z',
      new Date().toISOString(),
      new Date('2025-01-10T00:00:00Z') // Date object (RSS peut retourner ça)
    );
    
    assert.strictEqual(needsRegeneration, true, 'Should handle Date objects');
  });
});
