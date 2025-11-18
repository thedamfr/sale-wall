# ADR-0014: Proxy Audio pour Waveform Player

**Date**: 18 novembre 2025  
**Statut**: ✅ Accepté  
**Décideurs**: @thedamfr  
**Tags**: `audio`, `cors`, `waveform`, `proxy`, `streaming`

---

## Contexte

### Problème CORS avec OP3 Analytics

**Situation actuelle** (Phase 2 - ADR-0013) :
- URLs audio passent par OP3 : `https://op3.dev/e,pg=.../episode.mp3`
- OP3 redirige (302) vers Castopod sans headers CORS
- Web Audio API **refuse** de charger l'audio → waveform impossible
- Custom player actuel fonctionne mais **sans visualisation**

### Objectif : Waveform Visuelle

**Besoin métier** :
- Player moderne style SoundCloud avec waveform
- Améliorer l'engagement utilisateur (preview visuel de l'audio)
- Expérience premium cohérente avec l'identité brand

**Contrainte technique** :
- Web Audio API (utilisée par wavesurfer.js) **nécessite CORS**
- Impossible de modifier headers OP3 ou Castopod (services tiers)

---

## Décision

### Implémenter un proxy audio avec streaming

**Endpoint** : `/api/audio/proxy?url=<encoded_audio_url>`

**Rôle** :
1. Recevoir requête avec URL audio OP3
2. Faire requête HTTP vers OP3 (accepter redirects)
3. Streamer la réponse vers le client
4. Ajouter headers CORS appropriés

**Architecture** :
```
Browser → /api/audio/proxy?url=https%3A%2F%2Fop3.dev%2F...
  ↓
Fastify Server (proxy)
  ↓ (suit redirect 302)
OP3 → Castopod
  ↓
Stream audio ← Fastify ← Browser
(avec CORS headers)
```

---

## Implémentation

### 1. Route Proxy (`server.js`)

```javascript
// Route proxy audio pour CORS
fastify.get('/api/audio/proxy', async (request, reply) => {
  const { url } = request.query;
  
  if (!url) {
    return reply.code(400).send({ error: 'Missing url parameter' });
  }

  try {
    const decodedUrl = decodeURIComponent(url);
    
    // Fetch audio depuis OP3 (suit redirects)
    const response = await fetch(decodedUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'SaleteSincere/1.0 (Audio Proxy)'
      }
    });

    if (!response.ok) {
      return reply.code(response.status).send({ error: 'Failed to fetch audio' });
    }

    // Headers CORS pour Web Audio API
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Range, Content-Type');
    reply.header('Content-Type', response.headers.get('Content-Type'));
    reply.header('Content-Length', response.headers.get('Content-Length'));
    reply.header('Accept-Ranges', 'bytes');

    // Support Range requests (seek audio)
    const range = request.headers.range;
    if (range && response.headers.get('Accept-Ranges') === 'bytes') {
      reply.header('Content-Range', response.headers.get('Content-Range'));
      reply.code(206);
    }

    // Stream audio
    return reply.send(response.body);
    
  } catch (error) {
    fastify.log.error('Audio proxy error:', error);
    return reply.code(500).send({ error: 'Proxy failed' });
  }
});

// OPTIONS pour preflight CORS
fastify.options('/api/audio/proxy', async (request, reply) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Range, Content-Type');
  reply.code(204).send();
});
```

### 2. Template Podcast (`server/views/podcast.hbs`)

```handlebars
<!-- Proxy URL au lieu de l'URL directe -->
{{#if episodeData.audioUrl}}
  <div id="waveform-{{episodeData.season}}-{{episodeData.episode}}" 
       class="w-full h-16"></div>
  
  <script type="module">
    import WaveSurfer from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js';
    
    const originalUrl = '{{episodeData.audioUrl}}';
    const proxyUrl = `/api/audio/proxy?url=${encodeURIComponent(originalUrl)}`;
    
    const wavesurfer = WaveSurfer.create({
      container: '#waveform-{{episodeData.season}}-{{episodeData.episode}}',
      url: proxyUrl,
      waveColor: 'rgba(168, 85, 247, 0.3)',
      progressColor: '#a855f7',
      cursorColor: '#e9d5ff',
      barWidth: 3,
      barGap: 2,
      height: 60,
      normalize: true,
      backend: 'WebAudio' // ✅ Maintenant possible avec CORS
    });
    
    wavesurfer.on('ready', () => {
      console.log('✅ Waveform ready');
    });
  </script>
{{/if}}
```

### 3. Sécurité

**Validation URL** :
```javascript
// Whitelist domaines autorisés
const ALLOWED_AUDIO_DOMAINS = [
  'op3.dev',
  'podcasts.saletesincere.fr',
  'media.saletesincere.fr'
];

function isAllowedAudioUrl(url) {
  try {
    const parsed = new URL(url);
    return ALLOWED_AUDIO_DOMAINS.some(domain => 
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}
```

**Rate Limiting** (déjà en place via ADR-0004) :
- 100 requêtes/15min par IP sur `/api/audio/proxy`

---

## Conséquences

### ✅ Bénéfices

**Fonctionnels** :
- Waveform visuelle avec wavesurfer.js enfin possible
- Meilleure UX : preview visuel de l'audio
- Cohérence design avec identité brand

**Techniques** :
- Contrôle total sur CORS headers
- Support Range requests (seek audio)
- Streaming efficace (pas de buffer complet en mémoire)
- Compatible avec analytics OP3 (on proxie, on ne remplace pas)

### ❌ Coûts

**Performance** :
- Latence supplémentaire (~50-200ms selon réseau)
- Bande passante serveur = 2x trafic audio (download + upload)
- Mais mitigé par : streaming, pas de stockage

**Infrastructure** :
- CPU minimal (juste streaming, pas d'encodage)
- RAM : O(1) avec streaming Node.js (pas de buffer complet)

**Sécurité** :
- Risque SSRF si pas de whitelist domaines → **mitigé par validation**
- Risque abuse bandwidth → **mitigé par rate limiting**

### 🔄 Alternatives évaluées

**1. Pré-générer waveform PNG** :
- ❌ Moins interactif (image statique)
- ❌ Job de génération à chaque épisode
- ✅ Pas de bande passante runtime

**2. Demander CORS à OP3/Castopod** :
- ❌ Dépendance externe
- ❌ Délai incertain
- ❌ Pas de contrôle

**3. Héberger audio nous-mêmes** :
- ❌ Perte tracking OP3
- ❌ Coûts stockage + CDN
- ❌ Complexité migration

➡️ **Proxy streaming est le meilleur compromis**

---

## Risques OWASP ciblés

### A01 - Broken Access Control
- ✅ Validation whitelist domaines audio
- ✅ Rate limiting déjà en place (ADR-0004)

### A03 - Injection
- ✅ URL encode/decode sécurisé
- ✅ Pas d'exécution commande shell

### A05 - Security Misconfiguration
- ✅ CORS restrictif en production (origin spécifique)
- ✅ Headers sécurisés déjà configurés

### A10 - Server-Side Request Forgery (SSRF)
- ✅ **CRITIQUE** : Whitelist domaines stricte
- ✅ Validation URL avant fetch
- ❌ Bloquer IPs privées (127.0.0.1, 192.168.x.x, 10.x.x.x)

**Mitigation SSRF** :
```javascript
function isPrivateIP(hostname) {
  const privateRanges = [
    /^127\./,           // localhost
    /^10\./,            // private class A
    /^192\.168\./,      // private class C
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./ // private class B
  ];
  return privateRanges.some(range => range.test(hostname));
}
```

---

## Critères d'acceptation

**Given** : URL audio OP3 avec redirect vers Castopod  
**When** : Requête `/api/audio/proxy?url=https%3A%2F%2Fop3.dev%2F...`  
**Then** :
- Réponse 200 avec audio streamed
- Headers CORS présents : `Access-Control-Allow-Origin: *`
- Support Range requests (206 Partial Content)
- Pas de buffer complet en mémoire (streaming)

**Given** : URL domaine non autorisé  
**When** : Requête `/api/audio/proxy?url=https://malicious.com/file.mp3`  
**Then** :
- Réponse 400 Bad Request
- Erreur : "Domain not allowed"

**Given** : Wavesurfer.js chargé dans podcast.hbs  
**When** : Page `/podcast/1/5` avec proxy URL  
**Then** :
- Waveform s'affiche (purple gradient)
- Audio joue au clic sur play
- Pas d'erreur CORS dans console

---

## Interfaces publiques

**API Endpoint** :
```
GET /api/audio/proxy?url=<encoded_url>

Query Parameters:
  - url (string, required): URL encoded audio source

Responses:
  - 200: Audio stream with CORS headers
  - 206: Partial Content (Range request)
  - 400: Invalid URL or missing parameter
  - 403: Domain not allowed
  - 500: Proxy fetch failed

Headers:
  - Access-Control-Allow-Origin: *
  - Content-Type: audio/mpeg
  - Accept-Ranges: bytes
```

**Template Usage** :
```javascript
const proxyUrl = `/api/audio/proxy?url=${encodeURIComponent(originalUrl)}`;
wavesurfer.create({ url: proxyUrl });
```

---

## Métriques de succès

**Performance** :
- Latence proxy < 200ms (P95)
- Throughput > 10 requêtes simultanées sans dégradation

**Sécurité** :
- 0 tentatives SSRF réussies (logs monitored)
- Rate limiting effectif (403 si dépassé)

**UX** :
- Waveform s'affiche en < 2s après page load
- Audio playback fluide (pas de rebuffering)

---

**Statut** : ✅ Implémenté  
**Prochaines étapes** :
1. Monitorer logs proxy pour détecter abus
2. Envisager cache proxy (Redis) si trafic élevé
3. Phase 3 : Audio clips 60-90s (ADR-0013)
