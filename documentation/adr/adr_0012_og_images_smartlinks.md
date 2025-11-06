# ADR-0012: Génération OG Images pour smartlinks podcast

**Date**: 2025-11-06  
**Auteur**: Damien Cavaillès  
**Statut**: 🚧 EN RÉDACTION (Phase 0 - Investigation)  
**Contexte**: Images Open Graph personnalisées pour les liens `/podcast/:season/:episode`  
**Dépend de**: ADR-0011 (smartlink implémenté)

---

## Problème

Quand on partage `/podcast/2/1` sur LinkedIn/Twitter/Facebook, tous les épisodes affichent la **même image** (cover générique du show).

**Objectif** : Générer une **image unique par épisode** (1200×630px) pour améliorer le partage social.

**Historique** : Reporté d'ADR-0011 car "les fonts Jimp marchaient pas".

---

## Solution retenue : Effet "blur background"

**Inspiration** : [Screenshot LinkedIn Estamitech](https://linkedin.com/post-inspector/)

### L'idée en une phrase

Au lieu de faire du text rendering complexe, on prend la **vignette de l'épisode** (déjà dans le RSS), on la **floute en fond**, et on la **superpose nette au centre** avec bords ronds + shadow.

### Résultat visuel

```
┌────────────────────────────────────────────┐
│  🌫️ Fond = vignette blurée + assombrie    │
│                                             │
│           ┌───────────────┐                 │
│           │   Vignette    │  ← Shadow       │
│           │   nette       │                 │
│           │   centrée     │                 │
│           │   400×400     │                 │
│           └───────────────┘                 │
│              (bords ronds)                  │
└────────────────────────────────────────────┘
```

### Pourquoi cette approche

✅ **Zéro fonts** : Pas de text rendering = pas de galère fonts  
✅ **Zéro template** : Vignette déjà dans Castopod  
✅ **Simple** : 30 lignes Canvas (`blur()` + `drawImage()` + `roundRect()`)  
✅ **Pro** : Même style que Ausha/Linkfire/Estamitech

---

## Alternatives considérées

### ✅ Option A : Jimp (Pure JS) - **RETENU**

**Pourquoi ça marche maintenant** :
- ✅ Zéro fonts nécessaires (pas de text rendering)
- ✅ Pure JS, pas de build Cairo
- ✅ `.blur(40)` + `.composite()` suffisent
- ✅ 3MB seulement
- 🟡 Performance ~1-2s (acceptable)

**Rejeté dans ADR-0011** car fonts custom cassées. **Valide maintenant** car approche blur sans texte.

---

### 🟡 Option B : Canvas (node-canvas)

- ✅ API familière, blur natif
- ❌ Build Cairo/Pango complexe CleverCloud
- ❌ Overkill pour effet simple

**Verdict** : Fallback si Jimp trop lent

---

### ❌ Option C : Sharp + SVG

Complexité inutile (SVG → PNG → composite)

### ❌ Option D : Puppeteer

300MB + 500MB RAM, rejeté

---

## Architecture technique

### 0. Fastify (server.js) : Décision AVANT queue

**Route `/podcast/:season/:episode`** :
1. Fetch RSS → Récupère `feedLastBuildDate` (channel-level)
2. Check BDD `episode_links` :
   - **Si `feed_last_build` < RSS lastBuildDate** → Queue job
   - **Si `generated_at` > 7 jours** → Queue job
   - **Si pas d'OG Image** → Queue job
   - **Sinon** → Skip (log "up-to-date")
3. Queue job `resolve-episode` SEULEMENT si nécessaire

**Avantage** : Pas de job inutile si OG déjà à jour

---

### 1. Service génération : `ogImageGenerator.js` (30 lignes)

```javascript
// Jimp : charge vignette → blur(40) → composite image nette → PNG
```

- Génération : ~1-2s
- RAM : ~50MB
- Output : ~150KB PNG

---

### 2. Worker : Génération OG + APIs plateformes

**Job `resolve-episode`** (1 seul worker pour tout) :
- Génère OG Image (Jimp blur)
- Appelle APIs Spotify/Apple/Deezer
- **⚠️ TODO** : Vérifier pourquoi Podcast Addict pas appelé
- DELETE ancienne S3 si re-génération
- Update BDD avec `feed_last_build` + `generated_at`

---

### 3. Migration : 4 colonnes `episode_links`

- `og_image_url` : URL CDN
- `og_image_s3_key` : Pour cleanup
- `feed_last_build` : Détection changements RSS
- `generated_at` : Fallback 7 jours

---

### 4. Template : Meta OG avec fallback

```handlebars
<meta property="og:image" content="{{episodeData.ogImageUrl}}" />
```

Si vide → Vignette RSS directe

---

## Sécurité (OWASP Top 10)

- ✅ **A03 Injection** : URL vignette validée (domaine Cellar uniquement)
- ✅ **A01 Access Control** : Rate limiting existant (ADR-0004)
- ✅ **A04 Insecure Design** : Zéro text rendering → Zéro XSS possible
- ✅ **A05 Misconfiguration** : Vignettes déjà publiques (RSS)

---

## Plan TDD

### Phase 0 : Validation Jimp (1h)

Script `test-jimp-og-blur.js` : Charge vignette → blur(40) → composite → PNG

**Critère** : Effet blur visible

---

### Phase 1 : RSS + Fastify check (2h)

- Ajouter `feedLastBuildDate` dans `castopodRSS.js`
- Check BDD dans `server.js` avant queue
- 3 tests : skip si up-to-date, queue si RSS changé, queue si > 7j

---

### Phase 2 : Service génération (2h)

3 tests : dimensions 1200×630, blur, rounded corners

---

### Phase 3 : Worker intégration (2h)

- OG Image dans job `resolve-episode` existant
- DELETE ancienne S3 avant upload nouvelle
- **⚠️ TODO** : Investiguer Podcast Addict manquant
- 2 tests : génération + cleanup S3

---

### Phase 4 : Template + migration (1h)

2 tests : meta OG fallback, migration SQL

---

### Phase 5 : Production (30min)

Deploy + test Facebook/LinkedIn preview

**Total** : ~7h (incluant investigation Podcast Addict)

---

## Critères d'acceptation
CREATE INDEX IF NOT EXISTS idx_episode_links_og_s3_key
ON episode_links(og_image_s3_key)
WHERE og_image_s3_key IS NOT NULL;

---

## Critères d'acceptation

- ✅ Cache intelligent : Skip génération, log "up-to-date"
- ✅ Re-génération si RSS changé : DELETE ancienne S3 + nouvelle OG Image
- ✅ Fallback 7 jours : Force refresh, log "too old"
- ✅ Preview Facebook/LinkedIn : Image custom affichée (blur visible)
- ✅ Fallback vignette RSS : Meta OG utilise vignette si pas d'OG générée

---

## Dépendances

2 tests : meta OG fallback, DELETE ancienne S3

---

### Phase 4 : Production (30min)

Migration SQL, test Facebook/LinkedIn

**Total** : ~6h

---

## Dépendances

```bash
npm install jimp
```

(Zéro build system, pure JS)

---

## Références

- Jimp : https://github.com/jimp-dev/jimp
- Open Graph : https://ogp.me/
- ADR-0011 : Smartlink (OG reportée initialement car fonts cassées)

---

## Métriques

| Métrique | Objectif |
|----------|----------|
| Génération | <2s |
| Taille PNG | <200KB |
| RAM worker | <400MB |
| Cache hit rate | >95% |

---

## Statut

🚧 **Phase 0** : Validation Jimp blur

**Prochaine étape** : `scripts/test-jimp-og-blur.js`

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
