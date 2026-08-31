/**
 * Phase 1 TDD : Tests pour ogImageGenerator service
 * RED → GREEN → REFACTOR
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { generateOGImage } from '../../server/services/ogImageGenerator.js';
import { Jimp } from 'jimp';
import { fileURLToPath } from 'node:url';

const TEST_THUMBNAIL = fileURLToPath(
  new URL('../../public/images/charbon-wafer-original.png', import.meta.url)
);

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

test('generateOGImage - should composite center image 560x560', async () => {
  // Arrange
  const episodeImageUrl = TEST_THUMBNAIL;
  
  // Act
  const buffer = await generateOGImage(episodeImageUrl);
  
  // Assert
  const image = await Jimp.read(buffer);
  
  const centerImageSize = 560;
  const centerX = Math.floor((1200 - centerImageSize) / 2);
  const centerY = Math.floor((630 - centerImageSize) / 2);
  const expectedCenterImage = (await Jimp.read(TEST_THUMBNAIL)).cover({
    w: centerImageSize,
    h: centerImageSize
  });

  const leftEdgePixel = image.getPixelColor(centerX + 10, centerY + 280);
  const expectedLeftEdgePixel = expectedCenterImage.getPixelColor(10, 280);

  assert.strictEqual(
    leftEdgePixel,
    expectedLeftEdgePixel,
    'The sharp episode artwork should cover 560px and remain readable in social previews'
  );
});
