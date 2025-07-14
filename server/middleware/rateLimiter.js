/**
 * Rate Limiting Configuration for Saleté Sincère
 * Protection contre spam/DDoS pendant les vacances
 */

// Configuration commune pour tous les limiters
const commonConfig = {
  message: 'Trop de requêtes, revenez demain !',
  standardHeaders: false,  // Pas de headers informatifs
  legacyHeaders: false,    // Pas d'anciens headers
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (request) => {
    // Utilise l'IP réelle (derrière proxy CleverCloud)
    return request.headers['x-forwarded-for'] || request.headers['x-real-ip'] || request.ip;
  }
};

// Upload audio : 3 requêtes par heure par IP
export const uploadLimiter = {
  ...commonConfig,
  max: 3,
  timeWindow: 1000 * 60 * 60, // 1 heure en ms
};

// Votes : 10 requêtes par heure par IP
export const voteLimiter = {
  ...commonConfig,
  max: 10,
  timeWindow: 1000 * 60 * 60, // 1 heure en ms
};

// Pages (GET) : 100 requêtes par minute par IP
export const pageLimiter = {
  ...commonConfig,
  max: 100,
  timeWindow: 1000 * 60, // 1 minute en ms
};

// API globale : 50 requêtes par heure par IP (fallback)
export const apiLimiter = {
  ...commonConfig,
  max: 50,
  timeWindow: 1000 * 60 * 60, // 1 heure en ms
};
