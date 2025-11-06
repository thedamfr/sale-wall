/**
 * Test simple Jimp : Juste blur + composite
 */

import { Jimp } from 'jimp';

console.log('🔬 Test simple Jimp blur');

const TEST_URL = 'https://cellar-c2.services.clever-cloud.com/salete-media-podcast/podcasts/charbonwafer/cover_feed.png';

async function simpleTest() {
  console.log('1. Chargement vignette...');
  const img = await Jimp.read(TEST_URL);
  console.log(`   ✅ ${img.width}×${img.height}`);
  
  console.log('2. Création canvas 1200×630...');
  const canvas = new Jimp({ width: 1200, height: 630, color: 0x333333ff }); // Gris foncé au lieu de noir
  
  console.log('3. Fond blurré...');
  const bg = img.clone();
  bg.cover({ w: 1200, h: 630 });
  bg.blur(40);
  // bg.brightness(-0.3); // ← RETIRÉ : Pas besoin d'assombrir
  console.log('   ✅ Blur appliqué');
  
  console.log('4. Composite fond...');
  canvas.composite(bg, 0, 0);
  
  console.log('5. Image nette 400×400...');
  const center = img.clone();
  center.cover({ w: 400, h: 400 });
  
  console.log('6. Rounded corners (radius 20px)...');
  const radius = 20;
  const mask = new Jimp({ width: 400, height: 400, color: 0xFFFFFFFF }); // Blanc = opaque
  
  // Rendre les 4 coins transparents en dessinant des cercles
  mask.scan(0, 0, 400, 400, function(x, y, idx) {
    let makeTransparent = false;
    
    // Top-left corner
    if (x < radius && y < radius) {
      const dx = x - radius;
      const dy = y - radius;
      if (Math.sqrt(dx * dx + dy * dy) > radius) makeTransparent = true;
    }
    // Top-right corner
    if (x >= 400 - radius && y < radius) {
      const dx = x - (400 - radius - 1);
      const dy = y - radius;
      if (Math.sqrt(dx * dx + dy * dy) > radius) makeTransparent = true;
    }
    // Bottom-left corner
    if (x < radius && y >= 400 - radius) {
      const dx = x - radius;
      const dy = y - (400 - radius - 1);
      if (Math.sqrt(dx * dx + dy * dy) > radius) makeTransparent = true;
    }
    // Bottom-right corner
    if (x >= 400 - radius && y >= 400 - radius) {
      const dx = x - (400 - radius - 1);
      const dy = y - (400 - radius - 1);
      if (Math.sqrt(dx * dx + dy * dy) > radius) makeTransparent = true;
    }
    
    if (makeTransparent) {
      this.bitmap.data[idx + 3] = 0; // Alpha transparent
    }
  });
  
  center.mask(mask);
  console.log('   ✅ Rounded corners appliqués');
  
  console.log('7. Composite au centre...');
  const x = Math.floor((1200 - 400) / 2);
  const y = Math.floor((630 - 400) / 2);
  canvas.composite(center, x, y);
  
  console.log('8. Export PNG...');
  await canvas.write('scripts/phase0-simple-output.png');
  
  console.log('✅ Done! Check scripts/phase0-simple-output.png');
}

simpleTest().catch(console.error);
