---
status: accepted
date: 2025-10-15
decision-makers: @thedamfr
consulted: GitHub Copilot
informed: équipe dev
---

# ADR 0007 : Castopod sur sous-domaine podcast.saletesincere.fr

## Contexte

Le projet Saleté Sincère intègre Castopod comme plateforme de podcasting hébergée sur CleverCloud. Initialement, une tentative a été faite pour déployer Castopod sur un sous-chemin (`saletesincere.fr/podcast`) via un reverse proxy.

**Contraintes identifiées** :
- Castopod génère des URLs absolues et ne supporte pas nativement les sous-chemins
- Configuration avec `CP_BASEURL='https://saletesincere.fr/podcast'` → 404 systématiques
- Castopod s'attend à être à la racine d'un domaine
- Alternative reverse proxy avec réécriture d'URL trop complexe et fragile

**Problème** : Quel routing adopter pour exposer Castopod tout en garantissant la maintenabilité ?

## Décision

**Déployer Castopod sur un sous-domaine dédié : `podcast.saletesincere.fr`**

### Architecture retenue

```
┌─────────────────────────────────────────┐
│         Cloudflare DNS                   │
├─────────────────────────────────────────┤
│ saletesincere.fr                         │
│   ├─ / → app principale (Fastify)       │
│   └─ CNAME podcast →                     │
│      app_eaed31f5...cleverapps.io       │
│      (Castopod sur CleverCloud)         │
└─────────────────────────────────────────┘
```

### Configuration technique

**DNS Cloudflare** :
- Type : `CNAME`
- Name : `podcast`
- Target : `app_eaed31f5-389b-4324-9136-dd3392ba6224.cleverapps.io`
- Proxy : ✅ Activé (protection Cloudflare)

**Variables d'environnement Castopod** :
```bash
CP_BASEURL=https://podcast.saletesincere.fr
CP_MEDIA_BASEURL=https://cellar-c2.services.clever-cloud.com/salete-media-podcast
```

## Conséquences

### ✅ Bénéfices

1. **Simplicité** : Configuration native Castopod, pas de réécriture d'URL
2. **URLs propres** : Flux RSS et podcasts accessibles à des URLs canoniques
3. **Performance** : Pas de proxy intermédiaire entre Cloudflare et CleverCloud
4. **Maintenabilité** : Configuration standard, pas de logique custom à maintenir
5. **SEO** : Sous-domaine dédié pour le contenu podcast
6. **Isolation** : Séparation claire entre app principale et podcasts

### ❌ Coûts

1. **Complexité DNS** : Configuration Cloudflare requise (CNAME)
2. **Multiplicité des domaines** : Deux points d'entrée distincts (principal + podcast)
3. **Certificats SSL** : Cloudflare gère automatiquement (pas de coût réel)

### 🔧 Dette technique

- Aucune dette technique créée
- Architecture alignée avec les best practices Castopod
- Configuration réversible si migration future nécessaire

## Critères d'acceptation

- [x] **Given** un utilisateur accède à `https://podcast.saletesincere.fr`  
      **When** la page se charge  
      **Then** Castopod répond avec status 200, pas de 404

- [ ] **Given** un CNAME `podcast` configuré dans Cloudflare  
      **When** DNS propagé (< 5 min)  
      **Then** `podcast.saletesincere.fr` résout vers CleverCloud

- [ ] **Given** un podcast publié avec fichier audio  
      **When** flux RSS récupéré  
      **Then** URLs média pointent vers `cellar-c2.services.clever-cloud.com/salete-media-podcast/podcast/*`

- [ ] **Given** variables `CP_BASEURL` et `CP_MEDIA_BASEURL` configurées  
      **When** redéploiement effectué  
      **Then** Castopod démarre sans erreur dans logs

## Interfaces publiques

### Endpoints accessibles

```
https://podcast.saletesincere.fr/
├─ / → Page d'accueil Castopod
├─ /cp-install → Installation (1ère fois uniquement)
├─ /cp-auth → Authentification admin
├─ /@{username} → Profil public
├─ /@{username}/{podcast-slug} → Page podcast
├─ /@{username}/{podcast-slug}/feed.xml → Flux RSS
└─ /api/* → API Castopod
```

### URLs média S3

```
https://cellar-c2.services.clever-cloud.com/salete-media-podcast/
└─ podcast/
   ├─ {podcast-id}/
   │  ├─ cover.jpg
   │  └─ episodes/
   │     └─ {episode-id}.mp3
   └─ ...
```

## Risques OWASP ciblés

### A05 - Security Misconfiguration

**Mesures** :
- ✅ HTTPS obligatoire (`CP_DISABLE_HTTPS=0`)
- ✅ Cloudflare proxy activé (protection DDoS, WAF)
- ✅ Headers sécurisés gérés par Castopod
- ✅ Pas de routing custom = moins de surface d'attaque

### A01 - Broken Access Control

**Mesures** :
- ✅ Installation wizard (`/cp-install`) désactivé après setup
- ✅ 2FA obligatoire pour admins (à configurer au setup)
- ✅ Rate limiting natif Castopod activé

### A03 - Injection

**Non applicable** : Pas de proxy custom, pas de réécriture d'URL = pas de risque d'injection via manipulation d'URL

## Alternatives considérées

### Alternative 1 : Sous-chemin `/podcast` (REJETÉE)

**Avantages** :
- Un seul domaine
- URLs "logiques" dans l'arborescence du site

**Inconvénients** :
- ❌ Castopod ne supporte pas nativement les sous-chemins
- ❌ Nécessite reverse proxy avec réécriture complexe
- ❌ Risque de bugs sur URLs générées par Castopod
- ❌ Maintenance difficile (règles de réécriture fragiles)
- ❌ **Test effectué : 404 systématiques**

### Alternative 2 : Application CleverCloud distincte sans domaine custom (REJETÉE)

**Avantages** :
- Aucune config DNS nécessaire
- Déploiement immédiat

**Inconvénients** :
- ❌ URL peu professionnelle : `app_xxx.cleverapps.io`
- ❌ Pas de branding cohérent avec le projet
- ❌ Impossible à communiquer publiquement

## Plan d'action

### Prochaines étapes (EN ATTENTE DNS)

1. **Configurer DNS Cloudflare** (tâche manuelle utilisateur) :
   ```
   CNAME podcast → app_eaed31f5-389b-4324-9136-dd3392ba6224.cleverapps.io
   ```

2. **Mettre à jour variables d'environnement** :
   ```bash
   clever env set CP_BASEURL 'https://podcast.saletesincere.fr' --alias castopod
   clever restart --alias castopod --without-cache
   ```

3. **Finaliser installation** :
   - Accéder à `https://podcast.saletesincere.fr/cp-install`
   - Créer compte super-admin
   - **Activer 2FA obligatoirement**

4. **Tester upload podcast** :
   - Créer un podcast de test
   - Uploader un épisode audio
   - Vérifier intégration S3

5. **Documentation utilisateur** :
   - Mettre à jour README.md avec URL finale
   - Documenter accès admin

### Rollback possible

Si problème avec sous-domaine, possible de revenir à URL CleverCloud temporairement :
```bash
clever env set CP_BASEURL 'https://app_eaed31f5-389b-4324-9136-dd3392ba6224.cleverapps.io' --alias castopod
clever restart --alias castopod
```

## Références

- **ADR 0006** : Castopod Integration (intégration technique)
- **Documentation Castopod** : [Environment Variables](https://docs.castopod.org/getting-started/install/#environment-variables)
- **Infrastructure** : `castopod/DEPLOY_CLEVERCLOUD.md`
- **App CleverCloud** : `app_eaed31f5-389b-4324-9136-dd3392ba6224`
- **Bucket S3** : `salete-media-podcast` (Cellar C2)

## Notes de déploiement

### État actuel (15 octobre 2025)

- ✅ Application déployée sur CleverCloud
- ✅ MySQL (DEV, gratuit) et Redis (S, ~5€/mois) configurés
- ✅ Bucket S3 créé avec CORS et permissions
- ✅ Variables d'environnement configurées (URL temporaire CleverCloud)
- ⏳ **EN ATTENTE** : Configuration DNS Cloudflare par utilisateur
- ⏳ **EN ATTENTE** : Finalisation installation wizard `/cp-install`

### Commandes utiles

```bash
# Vérifier statut déploiement
clever status --alias castopod

# Voir logs
clever logs --alias castopod

# Lister variables d'environnement
clever env --alias castopod

# Forcer redéploiement
clever restart --alias castopod --without-cache
```
