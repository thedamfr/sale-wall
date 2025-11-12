/**
 * Test memory leak pour ogImageGenerator
 * Vérifie que les ressources Jimp sont bien libérées
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { generateOGImage } from '../../server/services/ogImageGenerator.js';

const TEST_THUMBNAIL = 'https://cellar-c2.services.clever-cloud.com/salete-media-podcast/podcasts/charbonwafer/cover_feed.png';

test('generateOGImage - should not leak memory over multiple generations', async () => {
  // Force GC avant le test (si --expose-gc activé)
  if (global.gc) global.gc();
  
  const initialMemory = process.memoryUsage().heapUsed;
  
  // Générer 10 OG Images (simule 10 workers successifs)
  for (let i = 0; i < 10; i++) {
    await generateOGImage(TEST_THUMBNAIL);
    
    // Force GC après chaque génération
    if (global.gc) global.gc();
  }
  
  const finalMemory = process.memoryUsage().heapUsed;
  const memoryGrowth = finalMemory - initialMemory;
  const memoryGrowthMB = memoryGrowth / 1024 / 1024;
  
  console.log(`Memory growth after 10 generations: ${memoryGrowthMB.toFixed(2)} MB`);
  
  // Si croissance > 50MB après 10 générations, probable memory leak
  // (Chaque génération fait ~50MB pic, devrait être GC'ed)
  assert.ok(memoryGrowthMB < 50, `Memory leak detected: ${memoryGrowthMB.toFixed(2)} MB growth (expected < 50 MB)`);
});

test('generateOGImage - heap usage should stabilize after warmup', async () => {
  // Warmup (première génération alloue caches Jimp)
  await generateOGImage(TEST_THUMBNAIL);
  if (global.gc) global.gc();
  
  const memoryAfterWarmup = process.memoryUsage().heapUsed;
  
  // Générer 5 fois de plus
  for (let i = 0; i < 5; i++) {
    await generateOGImage(TEST_THUMBNAIL);
    if (global.gc) global.gc();
  }
  
  const finalMemory = process.memoryUsage().heapUsed;
  const growth = (finalMemory - memoryAfterWarmup) / 1024 / 1024;
  
  console.log(`Memory growth after warmup: ${growth.toFixed(2)} MB`);
  
  // Après warmup, croissance devrait être minimale (<10MB)
  assert.ok(growth < 10, `Memory not stabilizing: ${growth.toFixed(2)} MB growth after warmup`);
});
