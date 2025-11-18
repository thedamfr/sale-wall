# ADR 0013: Audio Player sur Smartlink

**Statut** : ✅ Implémenté  
**Date** : 2025-11-17  
**Décideurs** : @thedamfr  
**Tags** : audio, smartlink, mvp, ux

## Contexte

Les smartlinks `/podcast/:season/:episode` affichent les boutons vers les plateformes (Spotify, Apple, Deezer) mais n'offrent pas de preview audio directement sur la page. User Story US1.1 : permettre la pré-écoute sans quitter le site.

**Contraintes** :
- Performance : Pas de transcoding/clipping pour le MVP (éviter ffmpeg)
- UX : Player intégré dans le bloc "Episode Highlight" existant
- Audio : Format MP3 fourni par RSS Castopod
- Cover : Privilégier OG image (16:9) sur cover RSS (carrée)
- Sécurité : CORS déjà configuré pour `saletesincere.fr`

## Décision

**Player HTML5 audio natif avec cover OG image** :

1. **Implémentation MVP** :
   - `<audio controls>` natif (pas de lib JS lourde)
   - Lecture complète de l'épisode (30s-3min)
   - Cover OG image (1200x630) avec fallback sur cover RSS carrée
   - Player intégré DANS le bloc "Episode Highlight" (pas séparé)

2. **Données** :
   - `audioUrl` : Déjà fourni par RSS Castopod (`enclosure.url`)
   - `ogImageUrl` : Depuis `episode_links.og_image_url` (DB cache)
   - Fallback : `episodeData.imageUrl` si OG image pas générée

3. **Template Handlebars** :
```handlebars
{{#if episodeData.audioUrl}}
<div class="bg-gray-900/50 rounded-xl p-4">
  <div class="flex items-start gap-3">
    <img src="{{ogImageUrl}}" 
         onerror="this.src='{{episodeData.imageUrl}}'" 
         class="w-24 h-auto rounded-lg">
    <div class="flex-1">
      <div class="text-white text-sm">Pré-écoute</div>
      <audio controls class="w-full">
        <source src="{{episodeData.audioUrl}}" type="audio/mpeg">
      </audio>
    </div>
  </div>
</div>
{{/if}}
```

4. **Permissions MinIO/S3** :
   - Dossier `/og-images/` rendu public en lecture
   - Script `setup-local-minio.sh` mis à jour
   - Command : `mc anonymous set download minio/salete-media/og-images`

## Conséquences

### ✅ Bénéfices
- **Zéro dépendance** : HTML5 natif, pas de lib audio tierce
- **Temps de dev** : 1 session (< 2h), pas de transcoding
- **SEO/OG** : Cover 16:9 optimale pour partage horizontal
- **Mobile-friendly** : `<audio>` natif supporté partout
- **Validation rapide** : Tester l'intérêt avant clip 90s

### ❌ Coûts/Dette
- **Bande passante** : Charge fichier MP3 complet (3-10 MB/épisode)
- **UX optimale** : Pas de clip 90s avec fade out (post-MVP)
- **Analytics** : Pas de tracking de lecture (OP3 stats future)

### 🔄 Évolution future (US1.1 complete)
- Créer service `audioClipService.js` avec ffmpeg
- Générer clips 60-90s avec fade out
- Stocker dans S3 `/previews/sXeY.mp3`
- Remplacer `audioUrl` par `clipUrl` dans template

---

## Phase 2 : Custom Audio Player (Implémenté 18/11/2025)

### Contexte Phase 2

Après validation du MVP, amélioration de l'expérience utilisateur avec :
- **Waveform visuelle** style SoundCloud (objectif initial)
- **Design cohérent** avec l'identité visuelle (purple gradient)
- **Interactions riches** (hover, animations, scrubbing fluide)

### Tentative : wavesurfer.js (abandonné)

**Bibliothèque testée** : `wavesurfer.js` v7
- CDN : `https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js`
- Configuration : WebAudio API avec purple gradient

**Problème bloquant** : CORS avec redirections OP3
- Les URLs audio passent par `https://op3.dev/e,pg=...` (analytics)
- OP3 redirige (302) vers Castopod sans headers CORS
- Web Audio API refuse de charger l'audio sans `Access-Control-Allow-Origin`
- Tentatives échouées : `backend: 'MediaElement'`, `xhr: {mode: 'no-cors'}`

### Solution Implémentée : Custom Player

**Approche** : Player vanilla JS sans waveform
- HTML5 `<audio>` sans attribut `crossorigin` (permet redirects opaques)
- Interface custom avec gradient purple/indigo
- Pas de dépendances externes

**Fonctionnalités** :
- ✅ Bouton play/pause circulaire avec gradient
- ✅ Barre de progression interactive (click-to-seek)
- ✅ Hover preview sur la barre (opacity transition)
- ✅ Affichage temps (current / total) en format MM:SS
- ✅ Animations fluides (transitions CSS)
- ✅ Compatible OP3 redirects (pas de CORS requis)

**Code Structure** :
```handlebars
<!-- Bouton Play/Pause -->
<button id="playBtn-{{episodeData.season}}-{{episodeData.episode}}"
        class="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600">
  <svg><!-- Icons dynamiques --></svg>
</button>

<!-- Barre de Progression -->
<div class="progress-bar relative h-2 bg-gray-700 rounded cursor-pointer">
  <div class="progress-hover"></div>
  <div id="progress-{id}" class="bg-gradient-to-r from-purple-500 to-indigo-500"></div>
</div>

<!-- Audio Element (sans crossorigin) -->
<audio id="audio-{id}" preload="metadata">
  <source src="{{episodeData.audioUrl}}" type="audio/mpeg">
</audio>

<script>
  // Event listeners : play/pause, timeupdate, click-to-seek
</script>
```

**Design** : Purple/Indigo gradient
- `from-purple-500 to-indigo-600` (bouton)
- `from-purple-500 to-indigo-500` (progress bar)
- `text-purple-300` (timer)
- Transitions : `transition-all duration-300 ease-in-out`

### Trade-offs

**❌ Perdus** :
- Waveform visuelle (impossible avec OP3 redirect + CORS)
- Web Audio API (nécessite `crossorigin="anonymous"`)

**✅ Gagnés** :
- Compatible avec OP3 analytics (redirects opaques)
- Zéro dépendances externes
- Performance optimale (vanilla JS)
- Contrôle total sur le design
- Interface fluide et responsive

### Options Futures pour Waveform

1. **Proxy audio** : Passer par notre serveur pour ajouter CORS headers
   - Coût : Bande passante supplémentaire
   - Complexité : Gestion du cache, redirects

2. **Pré-générer waveform** : Backend génère image PNG de la waveform
   - Tools : `ffmpeg` + `audiowaveform`
   - Store : S3 `/waveforms/{episode}.png`
   - Display : Superposer PNG + progress bar

3. **Castopod CORS** : Si Castopod ajoute headers CORS à l'avenir
   - Contacter équipe Castopod
   - Migrer vers OP3 avec support CORS

**Statut Phase 2** : ✅ Terminé le 18/11/2025

## Critères d'acceptation

**Given** : Page `/podcast/1/5` chargée avec RSS valide  
**When** : Utilisateur voit le bloc "Episode Highlight"  
**Then** : 
- Player audio visible avec cover OG image (16:9)
- Bouton play/pause fonctionnel
- Audio MP3 se charge et joue depuis Castopod
- Si OG image 403/404 → fallback sur cover RSS carrée

**Given** : Bucket MinIO local sans permissions  
**When** : `./scripts/setup-local-minio.sh` exécuté  
**Then** : 
- Dossier `/audio/` public en lecture
- Dossier `/og-images/` public en lecture
- Test `curl -I http://localhost:9000/salete-media/og-images/s1e5.png` → 200 OK

## Interfaces publiques

**Template data** (server.js → podcast.hbs) :
```javascript
{
  episodeData: {
    audioUrl: 'https://..../episode.mp3',
    imageUrl: 'https://..../cover.png', // RSS square cover
    title: 'Episode Title',
    duration: 123
  },
  ogImageUrl: 'http://localhost:9000/salete-media/og-images/s1e5.png' || null
}
```

**Bucket Policy MinIO** :
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"AWS": ["*"]},
    "Action": ["s3:GetObject"],
    "Resource": [
      "arn:aws:s3:::salete-media/audio/*",
      "arn:aws:s3:::salete-media/og-images/*"
    ]
  }]
}
```

## Risques OWASP ciblés

**A05 Security Misconfiguration** :
- ✅ CORS déjà restrictif (`saletesincere.fr`)
- ✅ Bucket policy limitée à GET sur `/audio/` et `/og-images/`
- ✅ Pas d'upload public (ACL `public-read` côté serveur uniquement)

**A07 Identification Failures** :
- N/A : Pas d'authentification pour le player (contenu public)

## Références

- US1.1 : Audio player sur smartlink
- RSS Castopod : `enclosure.url` fournit MP3
- OG Images : ADR 0012 (génération avec blur background)
- S3 Service : `server/services/s3Service.js` avec ACL `public-read`

## Notes d'implémentation

**Fichiers modifiés** :
- `server/views/podcast.hbs` : Player ajouté dans Episode Highlight
- `server.js` : Route `/podcast/:season/:episode` passe `ogImageUrl` + fix bucket policy
- `scripts/setup-local-minio.sh` : Permissions publiques pour `/og-images/`
- `readme.md` : Ajout étape `./scripts/setup-local-minio.sh` dans troubleshooting

**Tests manuels** :
- ✅ Player visible sur http://localhost:3000/podcast/1/5
- ✅ Audio joue depuis Castopod
- ✅ Bouton download masqué (`controlsList="nodownload"`)
- ✅ Permissions MinIO corrigées (200 OK sur og-images)

**Déploiement production** :
- Cellar S3 : Appliquer même bucket policy sur `/og-images/`
- Script : `./scripts/setup-cellar-cors.sh` (à mettre à jour si besoin)

## Évolution : Waveform Player (Phase 2)

**Objectif** : Remplacer `<audio>` natif par player avec visualisation waveform type SoundCloud.

**Choix technique** : wavesurfer.js v7
- Lib moderne, active community
- ~50KB gzipped (acceptable pour feature premium)
- Support WebAudio API pour visualisation temps réel
- Responsive et customizable

**Design cible** :
```
┌─────────────────────────────────────┐
│  ⏯  ████▓▓▓▓▓▓▓▓▓░░░░░░░░  1:23/3:45│
└─────────────────────────────────────┘
```

**Implémentation** :
```html
<div id="waveform"></div>
<script type="module">
import WaveSurfer from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js'

const wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: '#9333EA',
  progressColor: '#4F46E5',
  height: 80,
  barWidth: 2,
  barGap: 1,
  barRadius: 2
})
wavesurfer.load('{{episodeData.audioUrl}}')
</script>
```

**Avantages** :
- 🎨 Visuellement attractif (incite à l'écoute)
- 🖱️ Scrubbing précis (clic sur waveform)
- 📱 Responsive mobile/desktop
- ⚡ Performance correcte (WebAudio API optimisé)

**Todo Phase 2** :
- [ ] Intégrer wavesurfer.js via CDN ou npm
- [ ] Custom controls (play/pause button circulaire)
- [ ] Affichage durée current/total
- [ ] Style purple/indigo match design
- [ ] Tests mobile responsive

**Référence** : Voir `todolist.md` section "Audio Player Enhancement Phase 2"
