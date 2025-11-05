#!/usr/bin/env node

/**
 * Test de la nouvelle fonction subscribeToNewsletter
 */

import { config } from 'dotenv';

// Charger explicitement les variables d'environnement
config();

import { subscribeToNewsletter } from './server/newsletter/brevoClient.js';

const email = process.argv[2] || 'test-final@example.com';

async function testNewFunction() {
  console.log(`🧪 Test de subscribeToNewsletter avec: ${email}`);
  console.log('='.repeat(60));
  
  try {
    const result = await subscribeToNewsletter(email);
    
    console.log('📥 Résultat:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ Succès ! Contact ajouté à la liste temporaire');
      if (result.contactId) {
        console.log(`📋 Contact ID: ${result.contactId}`);
      }
    } else {
      console.log('❌ Échec:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Erreur inattendue:', error.message);
    console.error(error.stack);
  }
}

testNewFunction().catch(console.error);