/**
 * Middleware de sécurité pour Saleté Sincère
 * Phase 3: Nettoyage des headers et obscurcissement des infos techniques
 */

/**
 * Configuration des headers de sécurité
 */
export const securityHeaders = {
  // Masquer les informations sur le serveur
  removeServerHeaders: true,
  
  // Headers de sécurité à ajouter
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }
};

/**
 * Middleware Fastify pour nettoyer les headers
 */
export function setupSecurityHeaders(fastify) {
  // Hook pour nettoyer les headers sur chaque réponse
  fastify.addHook('onSend', async (request, reply, payload) => {
    // Supprimer les headers informatifs
    if (securityHeaders.removeServerHeaders) {
      reply.removeHeader('x-powered-by');
      reply.removeHeader('server');
      reply.removeHeader('x-fastify-version');
    }
    
    // Ajouter les headers de sécurité
    Object.entries(securityHeaders.headers).forEach(([key, value]) => {
      reply.header(key, value);
    });
    
    return payload;
  });
}

/**
 * Transforme les messages d'erreur techniques en messages utilisateur
 */
export function sanitizeErrorMessage(error, isProduction = true) {
  // En développement, garder les messages détaillés
  if (!isProduction) {
    return error.message;
  }
  
  // En production, messages génériques selon le type d'erreur
  const errorMappings = {
    // Erreurs de validation
    'FST_ERR_VALIDATION': 'Données invalides',
    'FST_ERR_CTP_EMPTY_JSON_BODY': 'Requête invalide',
    'FST_ERR_CTP_INVALID_MEDIA_TYPE': 'Format de données non supporté',
    
    // Erreurs de base de données
    'DatabaseError': 'Erreur temporaire, réessayez plus tard',
    'ConnectionError': 'Service temporairement indisponible',
    
    // Erreurs de rate limiting
    'FST_ERR_RATE_LIMIT': 'Trop de requêtes, revenez demain !',
    
    // Erreurs de fichier
    'LIMIT_FILE_SIZE': 'Fichier trop volumineux',
    'LIMIT_UNEXPECTED_FILE': 'Type de fichier non autorisé',
    
    // Erreurs S3/Upload
    'NoSuchBucket': 'Erreur de stockage',
    'AccessDenied': 'Erreur de stockage',
    
    // Erreurs génériques
    'Error': 'Une erreur est survenue',
    'TypeError': 'Erreur temporaire',
    'ReferenceError': 'Erreur temporaire'
  };
  
  // Chercher le type d'erreur dans les mappings
  const errorType = error.code || error.name || 'Error';
  
  // Retourner le message mappé ou un message générique
  return errorMappings[errorType] || 'Erreur temporaire, réessayez plus tard';
}

/**
 * Handler d'erreur Fastify avec messages sanitisés
 */
export function setupErrorHandler(fastify) {
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.CELLAR_ADDON_HOST;
  
  fastify.setErrorHandler(async (error, request, reply) => {
    // Logger l'erreur complète côté serveur
    request.log.error(error);
    
    // Déterminer le status code
    const statusCode = error.statusCode || error.status || 500;
    
    // Message sanitisé pour le client
    const clientMessage = sanitizeErrorMessage(error, isProduction);
    
    // Réponse uniforme
    const response = {
      success: false,
      message: clientMessage
    };
    
    // En développement, ajouter des détails limités (pas de stack trace)
    if (!isProduction && process.env.DEBUG_ERRORS === 'true') {
      response.debug = {
        type: error.name,
        code: error.code,
        originalMessage: error.message
        // Stack trace supprimée même en développement pour éviter l'exposition
      };
    }
    
    reply.status(statusCode).send(response);
  });
}
