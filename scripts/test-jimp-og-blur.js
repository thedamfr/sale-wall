/**
 * Phase 0 TDD : Validation Jimp blur effect pour OG Images
 * Test manuel : Vérifie que Jimp peut générer une OG Image avec effet blur
 * 
 * Usage: node scripts/test-jimp-og-blur.js
 */

import { Jimp } from 'jimp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testJimpBlur() {
  console.log('🎨 Phase 0 TDD : Test Jimp blur effect for OG Images');
  console.log('');
  
  try {
    // 1. Charger une image test (vignette épisode simulée)
    console.log('📥 Loading test image...');
    
    // Utiliser une image existante du projet ou créer une image de test
    const testImagePath = path.join(__dirname, '..', 'public', 'images', 'podcast-banner.png');
    
    if (!fs.existsSync(testImagePath)) {
      console.error('❌ Test image not found:', testImagePath);
      console.log('💡 Creating a test image instead...');
      
      // Créer une image de test 400×400 rouge
      const testImg = new Jimp(400, 400, 0xFF0000FF);
      await testImg.writeAsync(path.join(__dirname, 'test-source.png'));
      console.log('✅ Test source image created: scripts/test-source.png');
    }
    
    const sourceImage = fs.existsSync(testImagePath) 
      ? await Jimp.read(testImagePath)
      : await Jimp.read(path.join(__dirname, 'test-source.png'));
    
    console.log(`✅ Source image loaded: ${sourceImage.getWidth()}×${sourceImage.getHeight()}`);
    
    // 2. Créer canvas OG Image 1200×630
    console.log('🖼️  Creating OG Image canvas (1200×630)...');
    const ogImage = new Jimp(1200, 630, 0x000000FF); // Fond noir
    
    // 3. Redimensionner et blurrer l'image source pour le fond
    console.log('🌫️  Applying blur effect...');
    const background = sourceImage.clone()
      .cover(1200, 630) // Remplir tout le canvas
      .blur(40) // Blur 40px
      .brightness(-0.3); // Assombrir 30%
    
    console.log('✅ Blur effect applied (40px + brightness -30%)');
    
    // 4. Composite fond blurré
    console.log('🎨 Compositing blurred background...');
    ogImage.composite(background, 0, 0);
    
    // 5. Préparer image nette centrée (400×400)
    console.log('📐 Preparing sharp center image...');
    const centerImage = sourceImage.clone()
      .cover(400, 400); // Crop carré
    
    // 6. Arrondir les coins (simuler rounded corners)
    console.log('⭕ Applying rounded corners...');
    const radius = 20;
    const mask = new Jimp(400, 400, 0x00000000); // Transparent
    
    // Dessiner un rectangle arrondi (approximation avec scan)
    mask.scan(0, 0, 400, 400, function(x, y, idx) {
      // Distance des coins
      const corners = [
        { cx: radius, cy: radius }, // Top-left
        { cx: 400 - radius, cy: radius }, // Top-right
        { cx: radius, cy: 400 - radius }, // Bottom-left
        { cx: 400 - radius, cy: 400 - radius } // Bottom-right
      ];
      
      let inCorner = false;
      for (const corner of corners) {
        const dx = x - corner.cx;
        const dy = y - corner.cy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Si dans zone de coin ET hors du rayon
        if (
          (x < radius && y < radius && corner.cx === radius && corner.cy === radius && distance > radius) ||
          (x >= 400 - radius && y < radius && corner.cx === 400 - radius && corner.cy === radius && distance > radius) ||
          (x < radius && y >= 400 - radius && corner.cx === radius && corner.cy === 400 - radius && distance > radius) ||
          (x >= 400 - radius && y >= 400 - radius && corner.cx === 400 - radius && corner.cy === 400 - radius && distance > radius)
        ) {
          inCorner = true;
          break;
        }
      }
      
      if (!inCorner) {
        this.bitmap.data[idx + 3] = 255; // Alpha = opaque
      }
    });
    
    centerImage.mask(mask, 0, 0);
    console.log('✅ Rounded corners applied (radius 20px)');
    
    // 7. Composite image nette au centre
    const centerX = Math.floor((1200 - 400) / 2);
    const centerY = Math.floor((630 - 400) / 2);
    
    console.log(`🎯 Compositing center image at (${centerX}, ${centerY})...`);
    ogImage.composite(centerImage, centerX, centerY);
    
    // 8. Ajouter shadow (simulé avec un rectangle sombre sous l'image)
    console.log('🌑 Adding shadow effect...');
    const shadow = new Jimp(420, 420, 0x00000088); // Semi-transparent black
    shadow.blur(20);
    ogImage.composite(shadow, centerX - 10, centerY + 10, {
      mode: Jimp.BLEND_MULTIPLY,
      opacitySource: 0.5
    });
    
    // 9. Export PNG
    const outputPath = path.join(__dirname, 'test-og-output.png');
    console.log('💾 Exporting to PNG...');
    await ogImage.writeAsync(outputPath);
    
    const stats = fs.statSync(outputPath);
    const sizeKB = Math.round(stats.size / 1024);
    
    console.log('');
    console.log('✅ SUCCESS: OG Image generated!');
    console.log('📁 Output:', outputPath);
    console.log('📐 Dimensions: 1200×630');
    console.log('📦 Size:', sizeKB, 'KB');
    console.log('');
    console.log('🔍 Visual check:');
    console.log('   - Fond blurré visible ? ✓ ou ✗');
    console.log('   - Image nette centrée ? ✓ ou ✗');
    console.log('   - Coins arrondis ? ✓ ou ✗');
    console.log('   - Shadow visible ? ✓ ou ✗');
    console.log('');
    console.log('💡 Open the image to verify:');
    console.log(`   open ${outputPath}`);
    
  } catch (error) {
    console.error('');
    console.error('❌ FAILED:', error.message);
    console.error('');
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testJimpBlur();
