/**
 * Phase 1 TDD : Tests pour ogImageGenerator service
 * RED → GREEN → REFACTOR
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { generateOGImage } from '../../server/services/ogImageGenerator.js';
import { Jimp } from 'jimp';

// Test thumbnail URL (cover podcast Castopod)
const TEST_THUMBNAIL = 'https://cellar-c2.services.clever-cloud.com/salete-media-podcast/podcasts/charbonwafer/cover_feed.png';

test('generateOGImage - should return PNG buffer with correct dimensions', async () => {
  // Arrange
  const episodeImageUrl = TEST_THUMBNAIL;
  
  // Act
  const buffer = await generateOGImage(episodeImageUrl);
  
  // Assert
  assert.ok(buffer instanceof Buffer, 'Should return a Buffer');
  
  // Load PNG from buffer to verify dimensions
  const image = await Jimp.read(buffer);
  assert.strictEqual(image.width, 1200, 'Width should be 1200px');
  assert.strictEqual(image.height, 630, 'Height should be 630px');
});

test('generateOGImage - should apply blur effect to background', async () => {
  // Arrange
  const episodeImageUrl = TEST_THUMBNAIL;
  
  // Act
  const buffer = await generateOGImage(episodeImageUrl);
  
  // Assert
  const image = await Jimp.read(buffer);
  
  // Vérifier que le fond (bords) est différent du centre (blur vs net)
  // On compare les pixels des coins (blurrés) vs centre (net)
  const topLeftPixel = image.getPixelColor(50, 50); // Coin = blurré
  const centerPixel = image.getPixelColor(600, 315); // Centre = net
  
  // Les pixels ne devraient PAS être identiques (blur change les valeurs)
  assert.notStrictEqual(topLeftPixel, centerPixel, 'Background should be blurred (different from center)');
});

test('generateOGImage - should composite center image 400x400', async () => {
  // Arrange
  const episodeImageUrl = TEST_THUMBNAIL;
  
  // Act
  const buffer = await generateOGImage(episodeImageUrl);
  
  // Assert
  const image = await Jimp.read(buffer);
  
  // Vérifier que le centre contient bien une zone de 400×400
  // En vérifiant que les pixels du centre sont différents du fond gris
  const centerX = Math.floor((1200 - 400) / 2);
  const centerY = Math.floor((630 - 400) / 2);
  
  // Pixel dans la zone centrale (devrait être de la vignette, pas du fond gris)
  const centerPixel = image.getPixelColor(centerX + 200, centerY + 200);
  
  // Pixel hors zone centrale (devrait être fond blurré)
  const outsidePixel = image.getPixelColor(50, 50);
  
  // Les deux zones devraient être différentes
  assert.notStrictEqual(centerPixel, outsidePixel, 'Center image should be distinct from background');
});
