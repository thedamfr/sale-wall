#!/usr/bin/env node

/**
 * Test direct d'ajout de contact (sans DOI)
 */

import { config } from 'dotenv';

config();

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_BASEURL = process.env.BREVO_BASEURL || 'https://api.brevo.com/v3';
const BREVO_LIST_ID = process.env.BREVO_LIST_ID;

const email = process.argv[2] || 'test-direct@example.com';

async function testDirectContact() {
  console.log(`🧪 Test d'ajout direct de contact: ${email}`);
  console.log('='.repeat(60));
  
  const payload = {
    email,
    listIds: [Number(BREVO_LIST_ID)],
    attributes: {
      SOURCE: 'Salewall-Test'
    }
  };

  console.log('📤 Payload envoyé:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');

  try {
    const response = await fetch(`${BREVO_BASEURL}/contacts`, {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log(`📡 Status: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    
    if (response.ok) {
      console.log('✅ Contact ajouté avec succès !');
      if (responseText) {
        console.log('📥 Réponse:', responseText);
      }
    } else {
      console.log('❌ Erreur lors de l\'ajout du contact');
      console.log('📥 Réponse d\'erreur:', responseText);
      
      try {
        const errorData = JSON.parse(responseText);
        console.log('📋 Erreur structurée:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('⚠️  Impossible de parser la réponse JSON');
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur réseau:', error.message);
  }
}

testDirectContact().catch(console.error);