#!/usr/bin/env node

/**
 * Script pour lister les templates Brevo disponibles
 */

import { config } from 'dotenv';

config();

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_BASEURL = process.env.BREVO_BASEURL || 'https://api.brevo.com/v3';

if (!BREVO_API_KEY) {
  console.error('❌ BREVO_API_KEY manquant dans .env');
  process.exit(1);
}

async function listTemplates() {
  console.log('🔍 Listing des templates Brevo disponibles');
  console.log('='.repeat(50));
  
  try {
    const response = await fetch(`${BREVO_BASEURL}/smtp/templates`, {
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
    console.log(`📧 Nombre de templates: ${data.templates?.length || 0}`);
    console.log('');

    if (data.templates && data.templates.length > 0) {
      data.templates.forEach(template => {
        console.log(`📋 Template ID: ${template.id}`);
        console.log(`   Nom: ${template.name}`);
        console.log(`   Sujet: ${template.subject || 'N/A'}`);
        console.log(`   Type: ${template.tag || 'N/A'}`);
        console.log(`   Actif: ${template.isActive ? '✅' : '❌'}`);
        console.log(`   Créé: ${template.createdAt || 'N/A'}`);
        console.log('   ---');
      });
    } else {
      console.log('⚠️  Aucun template trouvé');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des templates:', error.message);
  }
}

// Exécution
listTemplates().catch(console.error);