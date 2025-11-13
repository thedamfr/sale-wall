/**
 * Script de test pour vérifier l'OG image avec charbon-wafer-kintsugi.jpg en fond
 */

import { generateOGImage } from '../server/services/ogImageGenerator.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testOGImageGeneration() {
  console.log('🎨 Test génération OG Image avec nouveau fond...\n');
  
  // On utilise l'image locale elle-même comme vignette d'épisode pour le test
  const episodeImagePath = path.join(__dirname, '../public/images/charbon-wafer-kintsugi.jpg');
  
  try {
    console.log('📥 Génération de l\'image...');
    const buffer = await generateOGImage(episodeImagePath);
    
    const outputPath = path.join(__dirname, '../test_data/og_test_charbon_background.png');
    await fs.writeFile(outputPath, buffer);
    
    console.log('✅ Image générée avec succès !');
    console.log(`📁 Chemin: ${outputPath}`);
    console.log(`📊 Taille: ${(buffer.length / 1024).toFixed(2)} KB`);
    console.log('\n🖼️  Ouvrez le fichier pour voir le résultat avec le fond charbon-wafer-kintsugi.jpg blurré');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  }
}

testOGImageGeneration();
