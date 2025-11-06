# ADR-0012: Génération OG Images pour smartlinks podcast

**Date**: 2025-11-06  
**Auteur**: Damien Cavaillès  
**Statut**: 🚧 EN RÉDACTION (Phase 0 - Investigation)  
**Contexte**: Génération d'images Open Graph custom pour `/podcast/:season/:episode`  
**Dépend de**: ADR-0011 (smartlink implémenté et fonctionnel)

---

## Contexte

### Besoin business

**Problème utilisateur** : Quand un lien smartlink `/podcast/2/1` est partagé sur LinkedIn/Twitter/Facebook, l'image Open Graph par défaut (cover Castopod) n'est **pas contextualisée** à l'épisode.

**Impact UX** :
- ❌ Tous les épisodes ont la même image (cover show générique)
- ❌ Pas de différenciation visuelle entre épisodes
- ❌ Taux de clic potentiellement plus faible (pas de "teasing" visuel)

**Objectif** : Générer une **image OG custom par épisode** (1200×630px) avec :
- Titre épisode
- Numéro saison/épisode (S2E1)
- Cover art show
- Branding "Saleté Sincère"

**Référence visuelle** : Ausha, Linkfire (images OG personnalisées par épisode)

---

### Historique technique

**ADR-0011 (2025-10-31)** : Génération OG Images **reportée** pour approche lean.

**Raisons du report** :
- ✅ Livraison plus rapide du smartlink (feature core)
- ✅ Réduit complexité initiale
- ⚠️ **Problème identifié** : "On avait essayé avec Jimp je crois mais les fonts marchaient pas"

**Fallback actuel** : Meta tags Open Graph avec texte uniquement + cover art Castopod générique.

---

## Investigation Phase 0 : Alternatives techniques

### Contraintes

**Environnement** :
- CleverCloud Node.js (pas de headless browser par défaut)
- RAM limitée (~512MB dyno S)
- CPU partagé (pas de GPU)
- Latence acceptable : <3s génération (worker pg-boss)

**Exigences** :
- Support **fonts custom** (problème Jimp précédent)
- Format PNG 1200×630px
- Text rendering qualité (antialiasing)
- Upload S3/MinIO après génération

---

### Option A : Jimp (pure JavaScript)

**Package** : `jimp` (~3MB)

**Workflow** :
```javascript
import Jimp from 'jimp'

const image = await Jimp.read('background.png')
const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK)

image
  .print(font, 50, 50, 'Mon titre épisode')
  .write('output.png')
```

**✅ Avantages** :
- Pure JavaScript (pas de dépendance système)
- Léger (~3MB)
- Déjà tenté (code existant ?)
- Compatible CleverCloud natif

**❌ Inconvénients** :
- **Fonts custom cassées** (problème connu, raison du report)
- Qualité text rendering moyenne (pas d'antialiasing avancé)
- Performances moyennes (100% JS)
- API limitée (pas de layout complexe)

**Problème fonts** : 
- Jimp utilise format `.fnt` propriétaire (bitmap fonts)
- Pas de support TTF/OTF direct
- Conversion fonts complexe (`bmfont-lato`, `bmfont` CLI)
- Rendu pixelisé si scale custom

**Déclencheur réouverture** : Si solution fonts `.fnt` trouvée + tests validés.

**Verdict** : ❌ **Rejetée** (même problème qu'avant, pas de solution fonts robuste)

---

### Option B : Sharp + SVG templating

**Package** : `sharp` (~10MB) + librsvg (système)

**Workflow** :
```javascript
import sharp from 'sharp'

// 1. Générer SVG avec text
const svg = `
<svg width="1200" height="630">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@700');
      text { font-family: 'Inter', sans-serif; }
    </style>
  </defs>
  <rect width="1200" height="630" fill="#1a1a2e"/>
  <text x="50" y="100" font-size="48" fill="white">
    ${episodeTitle}
  </text>
</svg>
`

// 2. Render SVG → PNG via Sharp
await sharp(Buffer.from(svg))
  .png()
  .toFile('output.png')
```

**✅ Avantages** :
- **Fonts custom via CSS @font-face** ✅
- SVG = layout déclaratif (flexbox-like avec `<foreignObject>`)
- Sharp ultra-performant (libvips C++)
- Antialiasing qualité production
- Text wrapping, gradients, filters natifs

**❌ Inconvénients** :
- Dépendance système : `librsvg` (render SVG)
- ~10MB package + dépendances natives
- CleverCloud : Doit builder librsvg ou utiliser buildpack
- SVG template = string interpolation (XSS risk si pas échappé)

**Dépendances CleverCloud** :
```bash
# Buildpack requis
CC_POST_BUILD_HOOK=apt-get install -y librsvg2-dev
```

**Déclencheur réouverture** : Si besoin features avancées (blur, composition layers).

**Verdict** : 🟡 **Option viable** mais complexité infra +1

---

### Option C : Canvas (node-canvas)

**Package** : `canvas` (~5MB) + Cairo (système)

**Workflow** :
```javascript
import { createCanvas, loadImage, registerFont } from 'canvas'

// 1. Register custom font
registerFont('./fonts/Inter-Bold.ttf', { family: 'Inter', weight: '700' })

// 2. Create canvas
const canvas = createCanvas(1200, 630)
const ctx = canvas.getContext('2d')

// 3. Draw background
ctx.fillStyle = '#1a1a2e'
ctx.fillRect(0, 0, 1200, 630)

// 4. Draw text with custom font
ctx.font = '48px Inter'
ctx.fillStyle = 'white'
ctx.fillText('Mon titre épisode', 50, 100)

// 5. Load and draw image (cover art)
const cover = await loadImage('https://podcasts.saletesincere.fr/cover.jpg')
ctx.drawImage(cover, 900, 50, 250, 250)

// 6. Export PNG
const buffer = canvas.toBuffer('image/png')
```

**✅ Avantages** :
- **API Canvas standard** (même que browser) ✅
- **Fonts TTF/OTF via `registerFont()`** ✅
- Antialiasing natif (Cairo)
- Performance excellente (C++ binding)
- Control pixel-perfect (fillRect, gradients, shadows)
- Compatible avec code frontend (partage helpers)

**❌ Inconvénients** :
- Dépendance système : `libcairo`, `libpango`, `libjpeg`, `libgif`
- ~5MB package + libs natives
- Build complexe (pré-built binaries parfois manquants)
- CleverCloud : Buildpack requis

**Dépendances CleverCloud** :
```bash
# Buildpack Node.js inclut Cairo par défaut sur certaines images
# Sinon :
CC_POST_BUILD_HOOK=apt-get install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev
```

**Gestion fonts** :
```javascript
// Embarquer fonts dans repo
registerFont('./public/fonts/Inter-Bold.ttf', { family: 'Inter', weight: 'bold' })
registerFont('./public/fonts/Inter-Regular.ttf', { family: 'Inter' })
```

**Text wrapping manuel** :
```javascript
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let currentLine = words[0]
  
  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + ' ' + words[i]
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth) {
      lines.push(currentLine)
      currentLine = words[i]
    } else {
      currentLine = testLine
    }
  }
  lines.push(currentLine)
  return lines
}
```

**Déclencheur réouverture** : Jamais (choix retenu si tests Phase 0 passent).

**Verdict** : ✅ **CHOIX RETENU** (balance fonctionnalité/complexité optimale)

---

### Option D : Puppeteer (headless browser)

**Package** : `puppeteer` (~300MB Chromium)

**Workflow** :
```javascript
import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()

await page.setViewport({ width: 1200, height: 630 })
await page.setContent(`
  <html>
    <head>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@700');
        body { font-family: 'Inter', sans-serif; }
      </style>
    </head>
    <body style="background: #1a1a2e; color: white;">
      <h1>${episodeTitle}</h1>
    </body>
  </html>
`)

const screenshot = await page.screenshot({ type: 'png' })
await browser.close()
```

**✅ Avantages** :
- **Fonts via CSS** (Google Fonts, @font-face) ✅
- Layout CSS natif (flexbox, grid)
- Rendering browser-grade (antialiasing perfect)
- Preview WYSIWYG (même HTML que prod)

**❌ Inconvénients** :
- **300MB Chromium** ❌
- RAM ~200-300MB par instance browser
- Latence startup ~500ms-1s
- CleverCloud : Buildpack + flags `--no-sandbox`
- Overkill pour layout simple

**Déclencheur réouverture** : Si besoin layout CSS complexe (multi-columns, animations).

**Verdict** : ❌ **Rejetée** (trop lourd pour use case simple)

---

## Décision : Canvas (node-canvas) avec approche "vignette RSS blurée"

### Choix retenu : **Canvas minimaliste - Zéro text rendering**

**Inspiration** : Estamitech (screenshot LinkedIn partagée)

**Approche simplifiée** :
1. ✅ **Vignette depuis RSS Castopod** : `rssEpisode.image` (déjà disponible)
2. ✅ **Fond blurré** : Même image en background avec `filter: blur(40px)`
3. ✅ **Image centrée** : Bords ronds + shadow effect
4. ✅ **Zéro fonts** : Pas de text rendering (titre dans meta tags OG uniquement)
5. ✅ **Zéro template** : Pas de fichier PNG à maintenir

**Justification** :
- ✅ **Résout problème fonts** : Pas de fonts du tout ! ✨
- ✅ **Maintenance zéro** : Vignette déjà dans Castopod
- ✅ **Canvas ultra-léger** : Juste `drawImage()` + `filter` + `roundRect()`
- ✅ **Style pro** : Blur + shadow = effet premium (comme Ausha/Linkfire)
- 🟡 **Infra** : Buildpack Cairo requis (one-time setup acceptable)

**Trade-off assumé** :
- Pas de titre dans l'image (uniquement dans meta tags) vs Simplicité extrême
- Dépendances système Cairo vs Pure JS (mais gains qualité +10)

---

## Architecture technique

### 1. Service OG Image Generator

**Fichier** : `server/services/ogImageGenerator.js`

```javascript
import { createCanvas, loadImage } from 'canvas'

/**
 * Génère une image OG 1200x630 avec effet blur background
 * Approche minimaliste : vignette RSS blurée en fond + image nette centrée
 * 
 * @param {Object} options
 * @param {string} options.episodeImageUrl - URL vignette épisode (depuis RSS Castopod)
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function generateEpisodeOGImage({ episodeImageUrl }) {
  const WIDTH = 1200
  const HEIGHT = 630
  
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')
  
  // Load image (depuis Cellar Castopod)
  const image = await loadImage(episodeImageUrl)
  
  // 1. Background blurré (plein écran avec débordement pour effet)
  ctx.filter = 'blur(40px) brightness(0.7)' // Blur + assombrir
  ctx.drawImage(image, -50, -50, WIDTH + 100, HEIGHT + 100) // Déborde pour éviter bords nets
  
  // 2. Overlay dark (améliore contraste avec image centrale)
  ctx.filter = 'none'
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  
  // 3. Shadow effect pour image centrale
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 15
  
  // 4. Image centrée avec bords ronds (style Estamitech)
  const imgSize = 400
  const x = (WIDTH - imgSize) / 2
  const y = (HEIGHT - imgSize) / 2
  
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, imgSize, imgSize, 20) // Coins arrondis 20px
  ctx.clip()
  ctx.drawImage(image, x, y, imgSize, imgSize)
  ctx.restore()
  
  // Reset shadow pour éviter effets indésirables
  ctx.shadowColor = 'transparent'
  
  // Export PNG buffer
  return canvas.toBuffer('image/png')
}
```

**Note sécurité** :
- ✅ `episodeImageUrl` provient du RSS Castopod (trusted source)
- ✅ Pas de text rendering → Pas de XSS possible
- ✅ Pas de fonts externes → Pas de SSRF

**Performance** :
- Génération : ~500ms-1s (loadImage + Canvas rendering)
- RAM pic : ~50MB (image buffer temporaire)
- Output size : ~150-250KB PNG

---

### 2. Intégration Worker pg-boss

**Fichier** : `server/queues/episodeQueue.js` (modification existant)

**Stratégie de cache invalidation** :
- Check `lastBuildDate` du RSS Castopod
- Si `feed_last_build` en BDD < `lastBuildDate` RSS → Re-générer OG Image
- **Fallback temporel** : Si dernière génération > 7 jours → Force refresh (évite images obsolètes si RSS non mis à jour)

```javascript
import { generateEpisodeOGImage } from '../services/ogImageGenerator.js'
import { uploadToS3, deleteFromS3 } from '../services/s3Service.js'

// Dans le worker existant
await boss.work('resolve-episode', {
  teamSize: 3,
  teamConcurrency: 1
}, async (job) => {
  const { season, episode, episodeImageUrl, rssLastBuildDate } = job.data
  
  const client = await fastify.pg.connect()
  
  try {
    // 1. Check si OG Image doit être re-générée
    const cached = await client.query(`
      SELECT og_image_url, og_image_s3_key, feed_last_build, generated_at
      FROM episode_links 
      WHERE season=$1 AND episode=$2
    `, [season, episode])
    
    let shouldRegenerate = false
    let oldS3Key = null
    
    if (cached.rows.length === 0) {
      // Nouveau : générer
      shouldRegenerate = true
    } else {
      const { feed_last_build, generated_at, og_image_s3_key } = cached.rows[0]
      
      // Check 1 : RSS lastBuildDate a changé
      if (new Date(feed_last_build) < new Date(rssLastBuildDate)) {
        console.log(`[Job ${job.id}] RSS updated, regenerate OG image`)
        shouldRegenerate = true
        oldS3Key = og_image_s3_key
      }
      
      // Check 2 : Dernière génération > 7 jours (fallback anti-obsolescence)
      const daysSinceGeneration = (Date.now() - new Date(generated_at)) / (1000 * 60 * 60 * 24)
      if (daysSinceGeneration > 7) {
        console.log(`[Job ${job.id}] OG image too old (${daysSinceGeneration.toFixed(1)} days), regenerate`)
        shouldRegenerate = true
        oldS3Key = og_image_s3_key
      }
    }
    
    let ogImageUrl = cached.rows[0]?.og_image_url
    let ogImageS3Key = cached.rows[0]?.og_image_s3_key
    
    if (shouldRegenerate) {
      // 2. Génération OG Image
      console.log(`[Job ${job.id}] Generating OG image for S${season}E${episode}`)
      const imageBuffer = await generateEpisodeOGImage({ 
        episodeImageUrl // Vignette depuis RSS Castopod (même Cellar, bucket différent)
      })
      
      // 3. Upload S3 (bucket salete-media/og-images/)
      const newS3Key = `og-images/s${season}e${episode}.png`
      ogImageUrl = await uploadToS3({
        key: newS3Key,
        body: imageBuffer,
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000, immutable' // 1 an cache
      })
      ogImageS3Key = newS3Key
      
      console.log(`[Job ${job.id}] ✅ OG Image uploaded: ${ogImageUrl}`)
      
      // 4. ⚠️ IMPORTANT : Supprimer ancienne OG Image S3 si key a changé
      if (oldS3Key && oldS3Key !== newS3Key) {
        await deleteFromS3(oldS3Key).catch(err => {
          console.error(`[Job ${job.id}] Failed to delete old S3 key ${oldS3Key}:`, err)
        })
        console.log(`[Job ${job.id}] 🗑️ Deleted old OG image: ${oldS3Key}`)
      }
    } else {
      console.log(`[Job ${job.id}] OG image up-to-date, skip generation`)
    }
    
    // 5. Résolution APIs (existant, inchangé)
    const [spotifyResult, appleResult, deezerResult] = await Promise.allSettled([
      // ... existant
    ])
    
    // 6. Update BDD avec lastBuildDate + OG Image
    await client.query(`
      INSERT INTO episode_links (
        season, episode, 
        og_image_url,
        og_image_s3_key,
        feed_last_build,
        generated_at,
        spotify_url, apple_url, deezer_url,
        resolved_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, NOW())
      ON CONFLICT (season, episode) 
      DO UPDATE SET
        og_image_url = EXCLUDED.og_image_url,
        og_image_s3_key = EXCLUDED.og_image_s3_key,
        feed_last_build = EXCLUDED.feed_last_build,
        generated_at = EXCLUDED.generated_at,
        spotify_url = EXCLUDED.spotify_url,
        apple_url = EXCLUDED.apple_url,
        deezer_url = EXCLUDED.deezer_url,
        resolved_at = NOW()
      WHERE episode_links.feed_last_build < EXCLUDED.feed_last_build
         OR episode_links.spotify_url IS NULL
         OR episode_links.apple_url IS NULL
         OR episode_links.deezer_url IS NULL
    `, [
      season, episode, 
      ogImageUrl, 
      ogImageS3Key,
      rssLastBuildDate,
      spotifyResult.value, 
      appleResult.value, 
      deezerResult.value
    ])
    
  } catch (err) {
    console.error(`[Job ${job.id}] ❌ Failed:`, err)
    throw err
  } finally {
    client.release()
  }
})
```

**Note importante** :
- ✅ **Vignette RSS pas copiée** : Reste dans Cellar Castopod (même infrastructure, bucket différent)
- ✅ **OG Image seule stockée** : Bucket `salete-media/og-images/`
- ✅ **Cleanup S3** : Ancienne OG Image supprimée si re-générée
- ✅ **Fallback 7 jours** : Évite images obsolètes si Castopod ne met pas à jour `lastBuildDate`

---

### 3. Migration BDD

**Fichier** : `sql/006_add_og_image_columns.sql`

```sql
-- Ajouter colonnes pour OG Images + cache invalidation
ALTER TABLE episode_links 
ADD COLUMN IF NOT EXISTS og_image_url TEXT,
ADD COLUMN IF NOT EXISTS og_image_s3_key TEXT, -- Pour cleanup S3
ADD COLUMN IF NOT EXISTS feed_last_build TIMESTAMPTZ, -- lastBuildDate du RSS
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ; -- Date génération OG Image

-- Index pour queries de cache invalidation
CREATE INDEX IF NOT EXISTS idx_episode_links_feed_last_build 
ON episode_links(feed_last_build) 
WHERE og_image_url IS NOT NULL;

-- Index pour cleanup S3 (retrouver images orphelines)
CREATE INDEX IF NOT EXISTS idx_episode_links_og_s3_key
ON episode_links(og_image_s3_key)
WHERE og_image_s3_key IS NOT NULL;

-- Note : Vignettes épisodes RSS PAS stockées dans episode_links
-- Elles restent dans Cellar Castopod (bucket podcasts/)
-- On stocke UNIQUEMENT les OG Images générées (bucket salete-media/og-images/)
```

**Pourquoi `og_image_s3_key` séparée** :
- Permet de supprimer l'ancienne image S3 quand on re-génère
- Évite de parser l'URL complète pour extraire la clé
- Simplifie le cleanup (retrouver images orphelines)

---

### 4. Service S3 (ajout deleteFromS3)

**Fichier** : `server/services/s3Service.js` (modification)

```javascript
// ... uploadToS3 existant ...

/**
 * Supprime un objet S3
 * Utilisé pour cleanup des anciennes OG Images
 * 
 * @param {string} key - S3 key (ex: "og-images/s2e1.png")
 * @returns {Promise<void>}
 */
export async function deleteFromS3(key) {
  const endpoint = process.env.S3_ENDPOINT || 'https://cellar-c2.services.clever-cloud.com'
  const bucket = process.env.S3_BUCKET || 'salete-media'
  
  const url = `${endpoint}/${bucket}/${key}`
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `AWS ${process.env.S3_ACCESS_KEY}:${signatureV2('DELETE', key)}`
    }
  })
  
  if (!response.ok && response.status !== 404) {
    throw new Error(`S3 delete failed: ${response.status} ${response.statusText}`)
  }
  
  console.log(`🗑️ Deleted S3 object: ${key}`)
}

// Note : signature AWS V2 helper (déjà présent pour uploadToS3)
```

**Pourquoi DELETE est important** :
- ✅ Évite accumulation d'OG Images obsolètes dans S3
- ✅ Économie stockage (chaque PNG ~150-250KB)
- ✅ Évite confusion (URLs anciennes toujours accessibles)

**Sécurité** :
- ✅ Key fournie par BDD (pas de param utilisateur)
- ✅ DELETE limité au bucket `salete-media` (pas de traversal)
- ⚠️ 404 ignoré (fichier déjà supprimé = OK)

### 5. Template Handlebars (modification)

**Fichier** : `server/views/podcast.hbs` (ligne ~10-15)

```handlebars
<!-- Meta OG dynamiques -->
<meta property="og:image" content="{{#if episodeData.ogImageUrl}}{{episodeData.ogImageUrl}}{{else}}{{episodeData.episodeImageUrl}}{{/if}}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{{#if episodeData.ogImageUrl}}{{episodeData.ogImageUrl}}{{else}}{{episodeData.episodeImageUrl}}{{/if}}">
```

**Fallback** :
- Si `og_image_url` NULL (pas encore générée) → Utilise vignette RSS directe
- Crawlers sociaux voient toujours une image (OG custom ou vignette épisode)

---

## Sécurité (OWASP Top 10)

### A03 - Injection (XSS dans Canvas)

**Vecteur** : Titre épisode avec caractères spéciaux.

**Mesures** :
```javascript
// ✅ Canvas API échappe automatiquement (pas de HTML rendering)
ctx.fillText(maliciousTitle, x, y) // Safe, rendu text brut

// ⚠️ Si SVG (Option B) : MUST escape
const svg = `<text>${escapeXML(title)}</text>`
```

### A05 - Security Misconfiguration (fonts externes)

**Vecteur** : Chargement fonts depuis URL externe non contrôlée.

**Mesures** :
```javascript
// ✅ Fonts embarquées dans repo (pas de fetch externe)
registerFont('./public/fonts/Inter-Bold.ttf', { family: 'Inter' })

// ❌ JAMAIS ça :
registerFont(userProvidedUrl) // SSRF risk
```

### A10 - SSRF (loadImage URL)

**Vecteur** : `loadImage(coverUrl)` avec URL manipulée.

**Mesures** :
```javascript
// ✅ URL cover validée upstream (RSS Castopod trust)
const coverUrl = rssEpisode.image // https://podcasts.saletesincere.fr/...

// ✅ Timeout fetch
const cover = await loadImage(coverUrl, { timeout: 5000 })

// ✅ Whitelist domains
if (!coverUrl.startsWith('https://podcasts.saletesincere.fr/')) {
  throw new Error('Untrusted cover URL')
}
```

---

## Plan d'implémentation TDD

### Phase 0 : Investigation Canvas (STOP si échec)

**Objectif** : Valider que `node-canvas` fonctionne sur CleverCloud avec effet blur + rounded corners.

**Tests manuels** :
- [ ] Installer `canvas` local : `npm install canvas`
- [ ] Script test `scripts/test-canvas-og-blur.js` :

```javascript
import { createCanvas, loadImage } from 'canvas'
import fs from 'fs'

// Test avec une image existante (ou URL test)
const testImageUrl = 'https://cellar-c2.services.clever-cloud.com/salete-media-podcast/podcasts/charbonwafer/cover_feed.png'

const canvas = createCanvas(1200, 630)
const ctx = canvas.getContext('2d')

const image = await loadImage(testImageUrl)

// 1. Background blurré
ctx.filter = 'blur(40px) brightness(0.7)'
ctx.drawImage(image, -50, -50, 1300, 730)

// 2. Overlay
ctx.filter = 'none'
ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
ctx.fillRect(0, 0, 1200, 630)

// 3. Shadow + image centrée
ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
ctx.shadowBlur = 30
ctx.shadowOffsetY = 15

const imgSize = 400
const x = (1200 - imgSize) / 2
const y = (630 - imgSize) / 2

ctx.save()
ctx.beginPath()
ctx.roundRect(x, y, imgSize, imgSize, 20)
ctx.clip()
ctx.drawImage(image, x, y, imgSize, imgSize)
ctx.restore()

fs.writeFileSync('test-og-blur-output.png', canvas.toBuffer('image/png'))
console.log('✅ PNG généré : test-og-blur-output.png')
console.log('👀 Vérifier : fond blurré + image nette centrée + bords ronds')
```

- [ ] Run local : `node scripts/test-canvas-og-blur.js`
- [ ] Vérifier PNG : Fond blurré visible + image nette centrée + bords ronds
- [ ] Deploy test CleverCloud : Push + vérifier logs build Cairo
- [ ] Si échec build : Ajouter buildpack `CC_POST_BUILD_HOOK`

**Critères STOP** :
- ❌ Effet blur pas visible → Revoir approche (peut-être Sharp+SVG)
- ❌ Erreur build Cairo CleverCloud → Investiguer buildpack

**Critères GO** :
- ✅ PNG généré avec effet blur correct (local + prod)
- ✅ Rounded corners visibles
- ✅ Shadow effect visible
- ✅ Pas d'erreur build CleverCloud

---

### Phase 1 : Service ogImageGenerator

**RED 1** : Test génère PNG 1200×630 avec effet blur
```javascript
test('generates OG image 1200x630 with blur background', async () => {
  const buffer = await generateEpisodeOGImage({
    episodeImageUrl: 'https://cellar-c2.services.clever-cloud.com/.../cover_feed.png'
  })
  
  const image = await loadImage(buffer)
  assert.strictEqual(image.width, 1200)
  assert.strictEqual(image.height, 630)
})
```

**GREEN 1** : Implémenter structure minimale (background blur + image centrée)

**RED 2** : Test rounded corners visibles
```javascript
test('image has rounded corners', async () => {
  const buffer = await generateEpisodeOGImage({ ... })
  
  // Vérification visuelle (snapshot testing ou pixel inspection)
  fs.writeFileSync('test-output.png', buffer)
  // Manual check: Coins arrondis visibles
})
```

**GREEN 2** : Ajouter `ctx.roundRect()` + clip path

**RED 3** : Test shadow effect
```javascript
test('image has shadow effect', async () => {
  const buffer = await generateEpisodeOGImage({ ... })
  
  // Visual check: Shadow visible autour de l'image centrée
  fs.writeFileSync('test-shadow.png', buffer)
})
```

**GREEN 3** : Ajouter `ctx.shadowColor` + `shadowBlur`

**REFACTOR 1** : Extraire constantes (WIDTH, HEIGHT, imgSize, blur radius)

**Pause state** : 3 tests verts (dimensions, blur, rounded corners)

---

### Phase 2 : Intégration Worker + Cache invalidation

**RED 3** : Test worker génère et upload S3 seulement si RSS lastBuildDate changé
```javascript
test('worker skips generation if RSS unchanged', async () => {
  // Setup: Insert episode avec feed_last_build récent
  await db.query(`
    INSERT INTO episode_links (season, episode, feed_last_build, og_image_url, generated_at)
    VALUES (2, 1, '2025-11-06 10:00:00', 'https://cellar.../og-images/s2e1.png', NOW())
  `)
  
  // Queue job avec même lastBuildDate
  await boss.send('resolve-episode', {
    season: 2,
    episode: 1,
    rssLastBuildDate: '2025-11-06 10:00:00'
  })
  
  // Wait job completion
  await sleep(3000)
  
  // Verify: Pas de nouveau upload S3 (même URL)
  const logs = await getWorkerLogs()
  assert.ok(logs.includes('OG image up-to-date, skip generation'))
})
```

**GREEN 3** : Implémenter check `feed_last_build` dans worker

**RED 4** : Test re-génération si RSS lastBuildDate plus récent
```javascript
test('worker regenerates if RSS updated', async () => {
  // Setup: Insert avec ancien lastBuildDate
  await db.query(`
    INSERT INTO episode_links (season, episode, feed_last_build, og_image_url, og_image_s3_key)
    VALUES (2, 1, '2025-11-05 10:00:00', 'https://...old.png', 'og-images/s2e1-old.png')
  `)
  
  // Queue job avec nouveau lastBuildDate
  await boss.send('resolve-episode', {
    season: 2,
    episode: 1,
    rssLastBuildDate: '2025-11-06 12:00:00',
    episodeImageUrl: 'https://...'
  })
  
  await sleep(5000)
  
  // Verify: Nouveau S3 upload + ancienne image supprimée
  const result = await db.query('SELECT og_image_url, og_image_s3_key FROM episode_links WHERE season=2 AND episode=1')
  assert.notStrictEqual(result.rows[0].og_image_url, 'https://...old.png')
  
  const logs = await getWorkerLogs()
  assert.ok(logs.includes('Deleted old OG image: og-images/s2e1-old.png'))
})
```

**GREEN 4** : Implémenter re-génération + S3 cleanup

**RED 5** : Test fallback 7 jours (anti-obsolescence)
```javascript
test('worker regenerates if OG image > 7 days old', async () => {
  await db.query(`
    INSERT INTO episode_links (season, episode, feed_last_build, generated_at)
    VALUES (2, 1, NOW(), NOW() - INTERVAL '8 days') -- 8 jours
  `)
  
  await boss.send('resolve-episode', { season: 2, episode: 1, rssLastBuildDate: NOW() })
  await sleep(5000)
  
  const logs = await getWorkerLogs()
  assert.ok(logs.includes('OG image too old (8.0 days), regenerate'))
})
```

**GREEN 5** : Ajouter check `generated_at > 7 days`

**REFACTOR 2** : Extraire logique cache invalidation en helper

**Pause state** : 6 tests verts (worker + cache + S3 cleanup)

---

### Phase 3 : Template meta OG + S3 Service

**RED 6** : Test page HTML contient OG image custom
```javascript
test('GET /podcast/2/1 includes custom OG image', async () => {
  // Setup: Insert episode_links avec og_image_url
  await db.query(`
    INSERT INTO episode_links (season, episode, og_image_url)
    VALUES (2, 1, 'https://cellar.../og-images/s2e1.png')
  `)
  
  const response = await fastify.inject('/podcast/2/1')
  
  assert.ok(response.body.includes('<meta property="og:image" content="https://cellar.../og-images/s2e1.png"'))
})
```

**GREEN 6** : Modifier template Handlebars

**RED 7** : Test fallback vignette RSS si OG pas générée
```javascript
test('GET /podcast/3/5 uses RSS thumbnail as fallback', async () => {
  // Setup: episode sans og_image_url
  const response = await fastify.inject('/podcast/3/5')
  
  // Should use episodeImageUrl from RSS
  assert.ok(response.body.includes('<meta property="og:image" content="https://cellar.../podcasts/.../cover_feed.png"'))
})
```

**GREEN 7** : Ajouter fallback `{{episodeData.episodeImageUrl}}`

**RED 8** : Test S3 deleteFromS3 helper
```javascript
test('deleteFromS3 removes object', async () => {
  // Upload test file
  await uploadToS3({ key: 'test-delete.png', body: Buffer.from('test') })
  
  // Delete
  await deleteFromS3('test-delete.png')
  
  // Verify 404
  const response = await fetch('https://cellar.../salete-media/test-delete.png')
  assert.strictEqual(response.status, 404)
})
```

**GREEN 8** : Implémenter `deleteFromS3()` dans `s3Service.js`

**REFACTOR 3** : Extraire signature AWS helper (réutilisé upload + delete)

**Pause state** : 9 tests verts (template + fallback + S3 delete)

---

### Phase 4 : Production end-to-end

- [ ] Deploy CleverCloud avec buildpack Cairo
- [ ] Déclencher worker sur épisode test (S2E1)
- [ ] Vérifier S3 : `og-images/s2e1.png` existe
- [ ] Test Facebook Debugger : https://developers.facebook.com/tools/debug/
  - Input : `https://saletesincere.fr/podcast/2/1`
  - Verify : Image OG custom affichée (pas cover générique)
- [ ] Test LinkedIn Post Inspector : https://www.linkedin.com/post-inspector/
  - Verify : Image OG custom crawlée

**Critères succès** :
- ✅ Image générée en <3s (logs worker)
- ✅ Facebook/LinkedIn affichent image custom
- ✅ Pas d'erreur OOM (RAM stable <400MB)

---

## Métriques cibles

| Métrique | Objectif | Critique si |
|----------|----------|-------------|
| Génération OG image | <2s | >5s |
| Taille PNG | <200KB | >500KB |
| Worker RAM pic | <400MB | >500MB |
| S3 upload latency | <1s | >3s |
| Cache hit rate OG | >95% | <80% |

---

## Dépendances

**NPM packages** :
```json
{
  "dependencies": {
    "canvas": "^2.11.2"
  }
}
```

**CleverCloud buildpack** (si nécessaire) :
```bash
# clever.json ou CC_POST_BUILD_HOOK
{
  "hooks": {
    "postBuild": "apt-get update && apt-get install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev"
  }
}
```

**Note** : Pas de fonts custom requises (approche sans text rendering)

---

## Critères d'acceptation (Given/When/Then)

### Test 1 : Génération image blur effect
- **Given** : Épisode S2E1 avec vignette RSS disponible
- **When** : Worker génère OG image
- **Then** :
  - PNG 1200×630 créé
  - Background blurré visible (même image)
  - Image centrale nette 400×400
  - Bords ronds 20px radius
  - Shadow effect visible

### Test 2 : Cache invalidation RSS lastBuildDate
- **Given** : Épisode S2E1 déjà en cache avec `feed_last_build = 2025-11-05`
- **When** : RSS Castopod met à jour `lastBuildDate = 2025-11-06` (vignette modifiée)
- **Then** :
  - Worker détecte changement
  - Nouvelle OG Image générée
  - Ancienne image S3 supprimée
  - BDD updated avec nouveau `feed_last_build`

### Test 3 : Skip génération si RSS inchangé
- **Given** : Épisode S2E1 avec OG image générée hier + RSS `lastBuildDate` identique
- **When** : Worker traite job
- **Then** :
  - Log "OG image up-to-date, skip generation"
  - Pas de nouveau upload S3
  - Pas de requête `generateEpisodeOGImage()`

### Test 4 : Fallback 7 jours anti-obsolescence
- **Given** : Épisode S1E2 avec OG image générée il y a 8 jours
- **When** : Worker traite job (même si RSS inchangé)
- **Then** :
  - Log "OG image too old (8.0 days), regenerate"
  - Nouvelle OG Image générée
  - BDD updated avec `generated_at = NOW()`

### Test 5 : Facebook OG preview
- **Given** : `/podcast/2/1` avec `og_image_url` en BDD
- **When** : Facebook Debugger crawl URL
- **Then** :
  - Image OG custom affichée (fond blurré + vignette nette)
  - Dimensions 1200×630 détectées
  - Pas d'erreur crawl

### Test 6 : Fallback vignette RSS si OG pas générée
- **Given** : `/podcast/3/5` nouveau (pas encore de `og_image_url`)
- **When** : Page chargée
- **Then** :
  - Meta OG utilise vignette RSS directe (pas de blur)
  - Pas d'erreur 404 image
  - Worker queue job génération en background

### Test 7 : Cleanup S3 ancien fichier
- **Given** : Re-génération OG image S2E1 (key change)
- **When** : Worker upload nouvelle image `og-images/s2e1-v2.png`
- **Then** :
  - Ancienne image `og-images/s2e1.png` supprimée via DELETE S3
  - Log "🗑️ Deleted old OG image: og-images/s2e1.png"
  - Pas d'accumulation fichiers orphelins

---

## Références

**Canvas API** :
- node-canvas : https://github.com/Automattic/node-canvas
- Canvas 2D spec : https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API

**Open Graph** :
- OG Protocol : https://ogp.me/
- Facebook Debugger : https://developers.facebook.com/tools/debug/
- LinkedIn Inspector : https://www.linkedin.com/post-inspector/

**Fonts** :
- Inter font : https://rsms.me/inter/
- Google Fonts : https://fonts.google.com/

**ADRs liés** :
- ADR-0011 : Smartlink podcast (génération OG reportée)

---

## Statut : 🚧 EN RÉDACTION

**Prochaine étape** : **Phase 0 TDD** - Valider `node-canvas` + fonts custom sur CleverCloud

**Bloqueurs potentiels** :
- ❌ Cairo build fail CleverCloud → Investiguer buildpack/alternatives
- ❌ Fonts pas chargées → Revoir Sharp+SVG (Option B)
- ❌ RAM OOM worker → Réduire cover size ou générer hors worker

**Timeline estimée** :
- Phase 0 (investigation) : 1h
- Phase 1-3 (implémentation) : 3h
- Phase 4 (production) : 1h
- **Total** : ~5h
