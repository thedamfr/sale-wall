/**
 * Routes Newsletter Saleté Sincère - Integration Brevo
 * Formulaire, inscription double opt-in, confirmation, désinscription
 */

import { subscribeToNewsletter } from './brevoClient.js';
import { newsletterLimiter, newsletterActionLimiter, pageLimiter } from '../middleware/rateLimiter.js';

const TAGLINE = "Passe en cuisine. Rejoins Saleté Sincère.";

/**
 * Validation email stricte (sécurité A03)
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email requis' };
  }

  const cleanEmail = email.trim().toLowerCase();
  
  if (!cleanEmail) {
    return { valid: false, error: 'Email vide' };
  }

  // Regex RFC 5322 simplifiée mais stricte
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(cleanEmail)) {
    return { valid: false, error: 'Format email invalide' };
  }

  if (cleanEmail.length > 254) {
    return { valid: false, error: 'Email trop long' };
  }

  return { valid: true, email: cleanEmail };
}

/**
 * Routes Plugin Fastify
 */
export default async function newsletterRoutes(fastify, options) {
  
  // GET /newsletter - Page formulaire d'inscription
  fastify.get('/', {
    config: {
      rateLimit: pageLimiter
    }
  }, async (request, reply) => {
    return reply.view('newsletter/subscribe', {
      title: 'Newsletter Saleté Sincère',
      tagline: TAGLINE,
      description: 'Recevez nos nouveautés audio et les épisodes longs avant tout le monde.'
    });
  });

  // POST /newsletter/subscribe - Traitement inscription
  fastify.post('/subscribe', {
    config: {
      rateLimit: newsletterLimiter
    }
  }, async (request, reply) => {
    try {
      // Validation email
      const { email } = request.body;
      const validation = validateEmail(email);
      
      if (!validation.valid) {
        return reply.status(400).view('newsletter/error', {
          title: 'Erreur d\'inscription',
          error: validation.error,
          backLink: '/newsletter'
        });
      }

      // Appel API Brevo - Ajout à liste temporaire
      const result = await subscribeToNewsletter(validation.email);
      
      if (result.success) {
        return reply.view('newsletter/pending', {
          title: 'Vérifiez votre email',
          email: validation.email,
          tagline: TAGLINE,
          message: 'Un email de confirmation vous a été envoyé. Cliquez sur le lien pour finaliser votre inscription.'
        });
      } else {
        // Erreur API Brevo
        fastify.log.warn('Newsletter subscription failed:', {
          email: validation.email,
          error: result.error,
          brevoResponse: result
        });
        
        return reply.status(500).view('newsletter/error', {
          title: 'Erreur d\'inscription',
          error: 'Service temporairement indisponible, réessayez plus tard.',
          backLink: '/newsletter'
        });
      }
      
    } catch (error) {
      fastify.log.error('Newsletter subscription error:', error);
      
      return reply.status(500).view('newsletter/error', {
        title: 'Erreur d\'inscription',
        error: 'Une erreur inattendue s\'est produite.',
        backLink: '/newsletter'
      });
    }
  });

  // GET /newsletter/confirmed - Page après confirmation email
  fastify.get('/confirmed', {
    config: {
      rateLimit: newsletterActionLimiter
    }
  }, async (request, reply) => {
    return reply.view('newsletter/confirmed', {
      title: 'Inscription confirmée !',
      tagline: TAGLINE,
      homeLink: '/'
    });
  });



}