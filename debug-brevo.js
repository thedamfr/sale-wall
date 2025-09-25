/**
 * Script de debug pour tester directement l'API Brevo
 * Usage: node debug-brevo.js test@example.com
 */

import 'dotenv/config';

const BREVO_BASEURL = process.env.BREVO_BASEURL || 'https://api.brevo.com/v3';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_LIST_ID = Number(process.env.BREVO_LIST_ID);
const BREVO_DOI_TEMPLATE_ID = Number(process.env.BREVO_DOI_TEMPLATE_ID);
const SALENEWS_PUBLIC_BASEURL = process.env.SALENEWS_PUBLIC_BASEURL || 'http://localhost:3000';

async function testBrevoAPI(email) {
  console.log('🔧 Configuration Brevo:');
  console.log('- BREVO_BASEURL:', BREVO_BASEURL);
  console.log('- BREVO_API_KEY:', BREVO_API_KEY ? `${BREVO_API_KEY.substring(0, 20)}...` : 'NOT SET');
  console.log('- BREVO_LIST_ID:', BREVO_LIST_ID);
  console.log('- BREVO_DOI_TEMPLATE_ID:', BREVO_DOI_TEMPLATE_ID);
  console.log('- SALENEWS_PUBLIC_BASEURL:', SALENEWS_PUBLIC_BASEURL);
  console.log('');

  // Payload pour Brevo DOI
  const payload = {
    email,
    includeListIds: [Number(BREVO_LIST_ID)],
    templateId: Number(BREVO_DOI_TEMPLATE_ID),
    redirectionUrl: `${SALENEWS_PUBLIC_BASEURL}/newsletter/confirmed`
  };

  console.log('📤 Payload envoyé à Brevo:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');

  const url = `${BREVO_BASEURL}/contacts/doubleOptinConfirmation`;
  const options = {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  };

  console.log('🌐 Appel API:', url);
  console.log('');

  try {
    const response = await fetch(url, options);
    
    console.log('📥 Réponse Brevo:');
    console.log('- Status:', response.status, response.statusText);
    console.log('- Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('- Body brut:', responseText);
    
    if (responseText) {
      try {
        const responseJson = JSON.parse(responseText);
        console.log('- Body JSON:');
        console.log(JSON.stringify(responseJson, null, 2));
      } catch (e) {
        console.log('- Body n\'est pas du JSON valide');
      }
    }

    if (response.ok) {
      console.log('✅ Succès !');
    } else {
      console.log('❌ Erreur Brevo');
    }

  } catch (error) {
    console.log('💥 Erreur réseau:');
    console.log('- Message:', error.message);
    console.log('- Stack:', error.stack);
  }
}

// Usage
const email = process.argv[2] || 'test@example.com';
console.log('🧪 Test de l\'API Brevo avec:', email);
console.log('='.repeat(60));
testBrevoAPI(email);