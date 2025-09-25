---
title: ADR-0005 - Module Newsletter Brevo
description: Intégration newsletter Saleté Sincère avec API Brevo (double opt-in, backend-only)
owner: @thedamfr
status: implemented
date: 2025-09-25
domain: Newsletter, API Integration
impact: feature
---

# ADR-0005: Module Newsletter Saleté Sincère avec Brevo

**Contexte**: Le projet audio Saleté Sincère doit intégrer un système de newsletter pour fidéliser les utilisateurs. Contraintes strictes : aucune ressource Brevo côté frontend (pas de scripts/cookies), utilisation exclusive de l'API REST Brevo v3 côté backend Fastify. Les campagnes et exports restent dans l'UI Brevo (pas de routes admin). Double opt-in obligatoire pour RGPD.

**Décision**: 
- **API Integration**: Client HTTP backend vers API Brevo v3 (`/contacts/doubleOptinConfirmation`, `/contacts`)
- **Architecture**: Module `server/newsletter/` avec client Brevo, routes Fastify, templates Pug
- **Sécurité**: Validation email stricte, rate limiting spécifique, pas d'exposition côté client
- **Stack**: Fastify native (pas de librairie tierce), templates Pug cohérents avec l'existant

**Conséquences**: 
- ✅ RGPD-compliant (double opt-in natif Brevo)
- ✅ Performance (pas de scripts tiers côté client) 
- ✅ Sécurité (backend-only, validation stricte)
- ✅ Maintenabilité (architecture modulaire cohérente)
- ❌ Dépendance API externe (availability Brevo)
- ❌ Pas de analytics côté client (acceptable pour MVP)

**Critères d'acceptation** (Given/When/Then):
- Given: utilisateur sur `/newsletter` When: saisit email valide Then: reçoit email confirmation Brevo
- Given: utilisateur clique lien confirmation When: arrive sur `/newsletter/confirmed` Then: ajouté à liste Brevo
- Given: attaquant tente injection When: envoie email malformé Then: reçoit erreur 400 (pas d'appel API)

**Interfaces publiques**:
```javascript
// server/newsletter/brevoClient.js
subscribeWithDOI(email) → Promise<{success: boolean, message: string}>

// Routes Fastify
GET /newsletter → page formulaire
POST /newsletter/subscribe → traitement inscription  
GET /newsletter/confirmed → page confirmation
```

**Risques OWASP ciblés**:
- **A03 Injection** : Validation email regex stricte + échappement dans templates Pug
- **A05 Security Misconfiguration** : Variables ENV sécurisées (BREVO_API_KEY), headers API appropriés
- **A10 SSRF** : URL Brevo fixe en dur (`https://api.brevo.com/v3`), pas d'URL utilisateur

**Variables d'environnement**:
```env
BREVO_BASEURL="https://api.brevo.com/v3"
BREVO_API_KEY="xkeysib-xxx"
BREVO_LIST_ID="3"
BREVO_DOI_TEMPLATE_ID="TBD"  
SALENEWS_PUBLIC_BASEURL="https://saletesincere.fr"
```

**Constantes internes**:
```javascript
// Dans les templates Pug
const SALENEWS_TAGLINE = "Passe en cuisine. Rejoins Saleté Sincère."
```

**Rate Limiting Newsletter** (cohérent avec l'existant):
- Formulaire: 5 tentatives/heure par IP
- Confirmation/désinscription: 10/heure par IP