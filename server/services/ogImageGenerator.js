/**
 * OG Image Generator Service
 * Génère images Open Graph 1200×630 avec effet blur background
 * 
 * Phase 1 TDD - MVP sans rounded corners
 */

import { Jimp } from 'jimp';

// Constantes OG Image
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const CENTER_IMAGE_SIZE = 400;
const BLUR_RADIUS = 40;
const BG_COLOR = 0x333333ff; // Gris foncé

/**
 * Génère une OG Image 1200×630 avec effet blur
 * @param {string} episodeImageUrl - URL vignette épisode (depuis RSS)
 * @returns {Promise<Buffer>} PNG buffer
 * @throws {Error} Si chargement vignette échoue
 */
export async function generateOGImage(episodeImageUrl) {
  // 1. Charger vignette épisode
  const thumbnail = await Jimp.read(episodeImageUrl);
  
  // 2. Créer canvas OG avec fond gris
  const canvas = new Jimp({ width: OG_WIDTH, height: OG_HEIGHT, color: BG_COLOR });
  
  // 3. Fond blurré (cover + blur)
  const background = thumbnail.clone();
  background.cover({ w: OG_WIDTH, h: OG_HEIGHT }); // Remplir tout le canvas
  background.blur(BLUR_RADIUS); // Effet blur
  
  // 4. Composite fond blurré sur canvas
  canvas.composite(background, 0, 0);
  
  // 5. Image nette centrée (carrée MVP)
  const centerImage = thumbnail.clone();
  centerImage.cover({ w: CENTER_IMAGE_SIZE, h: CENTER_IMAGE_SIZE });
  
  // 6. Composite au centre du canvas
  const x = Math.floor((OG_WIDTH - CENTER_IMAGE_SIZE) / 2);
  const y = Math.floor((OG_HEIGHT - CENTER_IMAGE_SIZE) / 2);
  canvas.composite(centerImage, x, y);
  
  // 7. Export PNG buffer
  return await canvas.getBuffer('image/png');
}
