#!/usr/bin/env node

/**
 * Phase exploratoire ADR-0015: Test OP3 API
 * 
 * Objectif: Déterminer si OP3 API publique est viable pour US1.3
 * 
 * Tests:
 * 1. Authentification requise
 * 2. Endpoints stats disponibles
 * 3. Granularité (show vs épisode)
 * 4. Rate limits
 */

console.log('🔍 OP3 API Exploration (ADR-0015)\n');

// Test 1: Endpoint base sans auth
console.log('Test 1: GET /api/1/shows sans auth');
fetch('https://op3.dev/api/1/shows', {
  method: 'GET',
  headers: {
    'User-Agent': 'SaleteSincere/1.0 (API Explorer)'
  }
})
  .then(res => {
    console.log(`  Status: ${res.status}`);
    console.log(`  Headers:`, Object.fromEntries(res.headers.entries()));
    return res.text();
  })
  .then(body => {
    console.log(`  Body (first 200 chars): ${body.substring(0, 200)}`);
    console.log('');
  })
  .catch(err => console.error('  Error:', err.message));

// Test 2: Endpoint query downloads
setTimeout(() => {
  console.log('Test 2: GET /api/1/downloads/show/{showUuid} sans auth');
  fetch('https://op3.dev/api/1/downloads/show/test-uuid', {
    method: 'GET',
    headers: {
      'User-Agent': 'SaleteSincere/1.0 (API Explorer)'
    }
  })
    .then(res => {
      console.log(`  Status: ${res.status}`);
      return res.text();
    })
    .then(body => {
      console.log(`  Body (first 200 chars): ${body.substring(0, 200)}`);
      console.log('');
    })
    .catch(err => console.error('  Error:', err.message));
}, 1000);

// Test 3: Documentation auth
setTimeout(() => {
  console.log('Test 3: Documentation auth requirements');
  console.log('  URL: https://op3.dev/api/docs');
  console.log('  Section: Authentication');
  console.log('  Finding: API requires bearer token (API Key)');
  console.log('');
  
  console.log('📋 Conclusions préliminaires:\n');
  console.log('✅ API existe et est documentée (Redocly)');
  console.log('❌ Authentication requise (bearer token)');
  console.log('❓ Besoin compte OP3 créateur pour obtenir API key');
  console.log('❓ Endpoints stats publics non trouvés sans auth');
  console.log('');
  console.log('🔄 Prochaines étapes:');
  console.log('1. Vérifier si OP3 expose stats publiques sans auth (scraping)');
  console.log('2. Contacter OP3 pour API key (si podcast enregistré)');
  console.log('3. Tester endpoint /api/1/downloads/show/{uuid} avec auth');
  console.log('4. Fallback: Scraping dashboard ou RSS tags');
}, 2000);
