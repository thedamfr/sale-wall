#!/usr/bin/env node

/**
 * Script pour lister les listes Brevo disponibles
 */

import { config } from 'dotenv';

config();

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_BASEURL = process.env.BREVO_BASEURL || 'https://api.brevo.com/v3';

if (!BREVO_API_KEY) {
  console.error('❌ BREVO_API_KEY manquant dans .env');
  process.exit(1);
}

async function listLists() {
  console.log('📋 Listing des listes Brevo disponibles');
  console.log('='.repeat(50));
  
  try {
    const response = await fetch(`${BREVO_BASEURL}/contacts/lists`, {
      method: 'GET',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log(`📡 Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Erreur HTTP: ${errorText}`);
      return;
    }

    const data = await response.json();
    console.log(`📝 Nombre de listes: ${data.lists?.length || 0}`);
    console.log('');

    if (data.lists && data.lists.length > 0) {
      data.lists.forEach(list => {
        console.log(`📋 Liste ID: ${list.id}`);
        console.log(`   Nom: ${list.name}`);
        console.log(`   Nombre de contacts: ${list.totalSubscribers || 0}`);
        console.log(`   Créée: ${list.createdAt || 'N/A'}`);
        console.log('   ---');
      });
    } else {
      console.log('⚠️  Aucune liste trouvée');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des listes:', error.message);
  }
}

// Exécution
listLists().catch(console.error);