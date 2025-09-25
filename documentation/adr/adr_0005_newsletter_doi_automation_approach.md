# ADR-0005: Newsletter DOI - Approche par automation Brevo

**Date**: 2025-09-25  
**Statut**: Accepté  
**Contexte**: Correction d'approche après découverte documentation Brevo

## Contexte

Lors de l'implémentation du module Newsletter (ADR-0004), nous avons tenté d'utiliser l'endpoint Brevo `/contacts/doubleOptinConfirmation` pour gérer le double opt-in directement via l'API. Cette approche a échoué avec l'erreur "An active DOI template does not exist" malgré un template DOI configuré et actif.

L'analyse de la documentation officielle Brevo révèle que **l'endpoint `/doubleOptinConfirmation` n'est pas supporté pour les formulaires externes**. La bonne pratique Brevo pour les formulaires créés hors de leur plateforme est d'utiliser une **automation** qui se déclenche automatiquement.

## Décision

**Abandonner l'approche API directe DOI** au profit de **l'automation Brevo** :

### Architecture simplifiée
1. **Application → API Brevo classique** : `/contacts` pour ajout direct à liste temporaire
2. **Brevo automation** : Processus DOI automatique (email confirmation, déplacement liste finale, blocklist échecs)
3. **Application** : Pages de callback simples (confirmed, error)

### Configuration Brevo requise
- **Liste temporaire** : `TEMPORARY_DOI_Newsletter` (aucun email envoyé directement)
- **Liste finale** : `Newsletter_Confirmed` (destinataires newsletters)
- **Automation** : Déclencheur "contact ajouté à liste temporaire"

### Variables d'environnement mises à jour
```bash
# Supprimé - plus nécessaire
# BREVO_DOI_TEMPLATE_ID=1

# Nouvelle configuration
BREVO_TEMP_LIST_ID=3        # Liste temporaire pour DOI
BREVO_FINAL_LIST_ID=4       # Liste finale après confirmation
```

## Conséquences

### ✅ Bénéfices
- **Conformité documentation Brevo** : Approche officiellement supportée
- **Simplification code** : Plus d'endpoint DOI complexe, juste ajout contact standard
- **Fiabilité** : Automation Brevo gère tous les edge cases (timeouts, blocklist, etc.)
- **Maintenance réduite** : Logique DOI externalisée vers Brevo

### ❌ Coûts
- **Configuration manuelle** : Automation à créer dans interface Brevo
- **Couplage** : Dépendance à l'automation externe (mais documentée)
- **Debugging** : Logs DOI dans Brevo, pas dans notre application

## Critères d'acceptation (Given/When/Then)

### Ajout contact
- **Given** : Utilisateur soumet email valide via formulaire
- **When** : API POST /newsletter/subscribe
- **Then** : Contact ajouté à `BREVO_TEMP_LIST_ID`, redirection vers page "En attente de confirmation"

### Processus DOI (automation Brevo)
- **Given** : Contact dans liste temporaire
- **When** : Automation se déclenche
- **Then** : Email confirmation envoyé, attente clic 24h, déplacement liste finale ou blocklist

### Pages callback
- **Given** : Utilisateur clique lien confirmation
- **When** : Redirection vers `/newsletter/confirmed`
- **Then** : Page "Inscription confirmée" affichée

## Interfaces publiques

### API modifiée
```javascript
// server/newsletter/brevoClient.js
export async function subscribeToNewsletter(email) {
  const payload = {
    email,
    listIds: [Number(process.env.BREVO_TEMP_LIST_ID)],
    attributes: { SOURCE: 'Salewall' }
  };
  return await fetch(`${BREVO_BASEURL}/contacts`, { 
    method: 'POST', 
    body: JSON.stringify(payload) 
  });
}
```

### Automation Brevo (configuration manuelle)
1. **Trigger** : Contact ajouté à liste temporaire
2. **Action 1** : Envoi email confirmation avec lien vers `/newsletter/confirmed`
3. **Attente** : Clic sur lien (24h max)
4. **Action 2a** : Déplacement vers liste finale + suppression liste temporaire
5. **Action 2b** : Blocklist si pas de clic

## Risques OWASP ciblés

- **A01 Broken Access Control** : Rate limiting maintenu sur endpoint `/newsletter/subscribe`
- **A03 Injection** : Validation email côté serveur avant appel API
- **A05 Security Misconfiguration** : Variables d'environnement pour IDs listes

## Migration

1. ✅ **Documentation** : ADR présent
2. **Configuration Brevo** : Créer automation via interface
3. **Code** : Modifier `brevoClient.js` (endpoint `/contacts` standard)
4. **Variables** : Ajouter `BREVO_TEMP_LIST_ID`, `BREVO_FINAL_LIST_ID`
5. **Tests** : Adapter tests pour nouveau flux

---

**Référence** : [Documentation Brevo DOI externe](https://help.brevo.com/hc/en-us/articles/27353832123026-Set-up-a-double-opt-in-process-for-a-sign-up-form-created-outside-of-Brevo)

**Validation** : Configuration testée avec `debug-direct-contact.js` → Status 201 ✅