#!/usr/bin/env node

/**
 * Phase exploratoire ADR-0015: Test OP3 API avec authentification
 */

import 'dotenv/config';

const OP3_API_TOKEN = process.env.OP3_API_TOKEN;
const OP3_GUID = process.env.OP3_GUID;

if (!OP3_API_TOKEN || !OP3_GUID) {
  console.error('❌ Variables manquantes dans .env');
  console.error('Requis: OP3_API_TOKEN, OP3_GUID');
  console.error('Trouvées:', { OP3_API_TOKEN: !!OP3_API_TOKEN, OP3_GUID: !!OP3_GUID });
  process.exit(1);
}

console.log('🔍 OP3 API Exploration avec Auth (ADR-0015)\n');
console.log('Token OP3 chargé depuis l’environnement');
console.log(`Podcast GUID: ${OP3_GUID}\n`);

// Test 1: Lookup show UUID depuis GUID
async function testShowLookup() {
  console.log('Test 1: GET /api/1/shows/{guid} - Résolution GUID → Show UUID');
  
  try {
    const res = await fetch(`https://op3.dev/api/1/shows/${OP3_GUID}`, {
      headers: {
        'Authorization': `Bearer ${OP3_API_TOKEN}`,
        'User-Agent': 'SaleteSincere/1.0 (API Explorer)'
      }
    });
    
    console.log(`  Status: ${res.status}`);
    
    if (res.ok) {
      const data = await res.json();
      console.log(`  ✅ Show trouvé:`);
      console.log(`    - Show UUID: ${data.showUuid}`);
      console.log(`    - Titre: ${data.title}`);
      console.log(`    - Stats page: ${data.statsPageUrl}`);
      console.log('');
      return data.showUuid;
    } else {
      const error = await res.text();
      console.log(`  ❌ Erreur: ${error}\n`);
      return null;
    }
  } catch (err) {
    console.error('  ❌ Exception:', err.message, '\n');
    return null;
  }
}

// Test 2: Episode download counts (ce qu'on affichera)
async function testEpisodeDownloadCounts(showUuid) {
  console.log('Test 2: GET /api/1/queries/episode-download-counts?showUuid=XXX');
  
  if (!showUuid) {
    console.log('  ⏭️  Skipped (pas de show UUID)\n');
    return null;
  }
  
  try {
    const res = await fetch(`https://op3.dev/api/1/queries/episode-download-counts?showUuid=${showUuid}`, {
      headers: {
        'Authorization': `Bearer ${OP3_API_TOKEN}`,
        'User-Agent': 'SaleteSincere/1.0 (API Explorer)'
      }
    });
    
    console.log(`  Status: ${res.status}`);
    
    if (res.ok) {
      const data = await res.json();
      console.log(`  ✅ Données épisodes:`);
      console.log(`    - Show: ${data.showTitle}`);
      console.log(`    - Nombre d'épisodes: ${data.episodes?.length || 0}`);
      console.log(`    - Période: ${data.minDownloadHour} → ${data.maxDownloadHour}`);
      
      if (data.episodes?.length > 0) {
        console.log(`\n  📊 Top 3 épisodes (all-time):`);
        const top3 = data.episodes
          .sort((a, b) => b.downloadsAll - a.downloadsAll)
          .slice(0, 3);
        
        top3.forEach((ep, i) => {
          console.log(`    ${i+1}. "${ep.title}"`);
          console.log(`       - All-time: ${ep.downloadsAll} téléchargements`);
          console.log(`       - 30 jours: ${ep.downloads30 || 'N/A'}`);
          console.log(`       - 7 jours: ${ep.downloads7 || 'N/A'}`);
          console.log(`       - itemGuid: ${ep.itemGuid.substring(0, 50)}...`);
        });
      }
      console.log('');
      return data;
    } else {
      const error = await res.text();
      console.log(`  ❌ Erreur: ${error}\n`);
      return null;
    }
  } catch (err) {
    console.error('  ❌ Exception:', err.message, '\n');
    return null;
  }
}

// Test 3: Raw downloads (détails bas niveau)
async function testRawDownloads(showUuid) {
  console.log('Test 3: GET /api/1/downloads/show/{uuid}?start=2025-11-01&limit=5');
  
  if (!showUuid) {
    console.log('  ⏭️  Skipped (pas de show UUID)\n');
    return;
  }
  
  try {
    const params = new URLSearchParams({
      start: '2025-11-01',
      limit: '5',
      format: 'json'
    });
    
    const res = await fetch(`https://op3.dev/api/1/downloads/show/${showUuid}?${params}`, {
      headers: {
        'Authorization': `Bearer ${OP3_API_TOKEN}`,
        'User-Agent': 'SaleteSincere/1.0 (API Explorer)'
      }
    });
    
    console.log(`  Status: ${res.status}`);
    
    if (res.ok) {
      const data = await res.json();
      console.log(`  ✅ Raw downloads:`);
      console.log(`    - Rows returned: ${data.count}`);
      console.log(`    - Query time: ${data.queryTime}ms`);
      
      if (data.rows?.length > 0) {
        const dl = data.rows[0];
        console.log(`\n  📱 Premier download:`);
        console.log(`    - App: ${dl.agentName} (${dl.deviceName})`);
        console.log(`    - Pays: ${dl.countryCode} - ${dl.regionName}`);
        console.log(`    - Referrer: ${dl.referrerName || 'Direct'}`);
        console.log(`    - URL: ${dl.url.substring(0, 80)}...`);
      }
      console.log('');
    } else {
      const error = await res.text();
      console.log(`  ❌ Erreur: ${error}\n`);
    }
  } catch (err) {
    console.error('  ❌ Exception:', err.message, '\n');
  }
}
// Test 4: Rate limits check
async function testRateLimits() {
  console.log('Test 4: Rate limits (3 requêtes rapides)');
  const timestamps = [];
  
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    const res = await fetch(`https://op3.dev/api/1/shows/${OP3_GUID}`, {
      headers: {
        'Authorization': `Bearer ${OP3_API_TOKEN}`,
        'User-Agent': 'SaleteSincere/1.0 (API Explorer)'
      }
    });
    const duration = Date.now() - start;
    
    console.log(`  Request ${i+1}: ${res.status} (${duration}ms)`);
    
    timestamps.push(duration);
    if (i < 2) await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`  ✅ Latence moyenne: ${Math.round(timestamps.reduce((a,b) => a+b, 0) / timestamps.length)}ms`);
  console.log('');
}

// Exécution
(async () => {
  const showUuid = await testShowLookup();
  const episodesData = await testEpisodeDownloadCounts(showUuid);
  await testRawDownloads(showUuid);
  await testRateLimits();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 CONCLUSIONS ADR-0015\n');
  
  console.log('✅ API OP3 fonctionnelle:');
  console.log(`  - Show UUID résolu: ${showUuid || 'N/A'}`);
  console.log(`  - Épisodes trouvés: ${episodesData?.episodes?.length || 0}`);
  console.log(`  - Granularité: Par épisode ✅`);
  console.log('');
  
  console.log('📊 Données disponibles:');
  console.log('  - downloads1/3/7/30 (cumul des premiers jours après publication)');
  console.log('  - downloadsAll (all-time)');
  console.log('  - téléchargements bruts paginés pour calculer les fenêtres glissantes');
  console.log('');
  
  console.log('🎯 Architecture retenue:');
  console.log('  1. GUID stocké en .env (OP3_GUID)');
  console.log('  2. Appels OP3 uniquement dans le worker en arrière-plan');
  console.log('  3. Fenêtres glissantes 7/30 calculées depuis /downloads/show');
  console.log('  4. Cache PostgreSQL alimenté quotidiennement sur le singleton pg-boss');
  console.log('  5. Badge public contrôlé par OP3_PUBLIC_STATS_ENABLED et seuil ≥ 10');
  console.log('');
  
  console.log('🔒 Avant activation production:');
  console.log('  [ ] Révoquer et remplacer le token historiquement exposé');
  console.log('  [ ] Appliquer les migrations autorisées jusqu’à 008');
  console.log('  [ ] Remplir puis inspecter le cache avant d’activer le flag public');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
})();
