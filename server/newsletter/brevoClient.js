/**
 * Client Brevo API v3 pour newsletter Saleté Sincère
 * Ajout direct à liste temporaire + automation Brevo pour DOI
 * Approche conforme à la documentation officielle Brevo
 */

const BREVO_BASEURL = process.env.BREVO_BASEURL || 'https://api.brevo.com/v3';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_TEMP_LIST_ID = Number(process.env.BREVO_TEMP_LIST_ID || process.env.BREVO_LIST_ID); // Fallback pour migration
const BREVO_FINAL_LIST_ID = Number(process.env.BREVO_FINAL_LIST_ID || process.env.BREVO_LIST_ID); // Fallback pour migration

/**
 * Validation des variables d'environnement requises
 */
function validateConfig() {
  if (!BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY environment variable is required');
  }
  if (!BREVO_TEMP_LIST_ID || isNaN(BREVO_TEMP_LIST_ID)) {
    throw new Error('BREVO_TEMP_LIST_ID (or BREVO_LIST_ID) must be a valid number');
  }
}

/**
 * Client HTTP générique pour les appels API Brevo
 */
async function brevoApiCall(endpoint, method = 'GET', body = null) {
  validateConfig();

  const url = `${BREVO_BASEURL}${endpoint}`;
  const options = {
    method,
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  if (body && (method === 'POST' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  try {
    console.log(`🌐 Brevo API Call: ${method} ${url}`);
    if (body) {
      console.log('📤 Payload:', JSON.stringify(body, null, 2));
    }
    
    const response = await fetch(url, options);
    
    console.log(`📡 Brevo Response: ${response.status} ${response.statusText}`);
    
    // Brevo peut retourner 200/201 pour succès, 400+ pour erreurs
    if (response.ok) {
      // Certains endpoints retournent du contenu, d'autres pas
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log('📥 Success Data:', JSON.stringify(data, null, 2));
        return {
          success: true,
          data: data,
          status: response.status
        };
      }
      console.log('✅ Success (no content)');
      return { success: true, status: response.status };
    } else {
      // Tentative de récupération du message d'erreur Brevo
      let errorMessage = `HTTP ${response.status}`;
      let errorData = null;
      try {
        errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        console.log('❌ Error Data:', JSON.stringify(errorData, null, 2));
      } catch {
        // Si pas de JSON, garder le message HTTP
        console.log('❌ Error (no JSON):', errorMessage);
      }
      
      return {
        success: false,
        error: errorMessage,
        status: response.status,
        data: errorData
      };
    }
  } catch (error) {
    // Erreurs réseau ou autres
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

/**
 * Inscription à la newsletter - Ajout direct à liste temporaire
 * Le processus DOI est géré par une automation Brevo configurée séparément
 * @param {string} email - Email à inscrire (déjà validé par les routes)
 * @returns {Promise<{success: boolean, contactId?: number, message?: string, error?: string}>}
 */
export async function subscribeToNewsletter(email) {
  if (!email || typeof email !== 'string') {
    return { success: false, error: 'Email is required' };
  }

  const body = {
    email: email.toLowerCase().trim(),
    listIds: [BREVO_TEMP_LIST_ID], // Liste temporaire pour DOI
    attributes: {
      SOURCE: 'Salewall',
      SUBSCRIPTION_DATE: new Date().toISOString()
    }
  };

  const result = await brevoApiCall('/contacts', 'POST', body);
  
  if (result.success) {
    // Contact ajouté à la liste temporaire
    // L'automation Brevo se déclenche automatiquement pour envoyer le DOI
    return {
      success: true,
      contactId: result.data?.id, // ID du contact créé
      message: 'Contact added to temporary list. DOI process started by Brevo automation.'
    };
  } else if (result.data?.code === 'duplicate_parameter') {
    // Contact existe déjà, essayer de l'ajouter à la liste temporaire
    console.log('📋 Contact exists, adding to temp list...');
    
    const addToListResult = await brevoApiCall(`/contacts/lists/${BREVO_TEMP_LIST_ID}/contacts/add`, 'POST', {
      emails: [email.toLowerCase().trim()]
    });
    
    if (addToListResult.success) {
      return {
        success: true,
        message: 'Existing contact added to temporary list. DOI process started by Brevo automation.'
      };
    } else {
      // Si échec d'ajout à la liste, peut-être déjà dans la liste
      console.log('⚠️ Failed to add to list, contact might already be in DOI process');
      return {
        success: true,
        message: 'Contact already in system. Please check your email for confirmation if not already confirmed.'
      };
    }
  } else {
    return {
      success: false,
      error: result.error || 'Failed to add contact to temporary list'
    };
  }
}

/**
 * Désinscription d'un email de la liste newsletter
 * @param {string} email - Email à désinscrire
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */

/**
 * Fonction utilitaire pour vérifier la configuration
 */
export function checkConfig() {
  try {
    validateConfig();
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}