# Plan d'Audit OWASP Top 10 - Saleté Sincère

## Vue d'ensemble

Ce document présente un plan d'audit complet basé sur l'OWASP Top 10 2021 pour l'application "Saleté Sincère". L'application est un mur de posts vocaux avec les fonctionnalités suivantes :

### Architecture de l'Application
- **Backend** : Node.js avec Fastify 5.x
- **Frontend** : Server-Side Rendering (SSR) avec Pug, Tailwind CSS v4
- **Base de données** : PostgreSQL avec addons CleverCloud
- **Stockage** : S3/Cellar pour les fichiers audio
- **Déploiement** : CleverCloud avec autoscaler limité
- **Sécurité** : Rate limiting, validation audio, headers sécurisés

### Fonctionnalités Principales
1. **Enregistrement vocal** : Capture audio via MediaRecorder API
2. **Upload de posts** : Soumission avec titre, transcription, badge, audio
3. **Système de votes** : Vote unique par IP/hash
4. **Affichage des posts** : Page d'accueil avec liste des posts
5. **Manifeste** : Page statique informative
6. **API Health** : Endpoint de santé

---

## OWASP Top 10 2021 - Tests d'Audit

### A01: Broken Access Control (Contrôle d'Accès Défaillant)

#### Fonctionnalités Concernées
- **Système de votes** : Prévention du double vote
- **Upload de posts** : Accès aux endpoints API
- **Fichiers audio** : Accès aux médias stockés
- **Pages admin** : Vérification d'absence d'interfaces admin exposées

#### Tests à Effectuer

##### 1. Test de Double Vote
```bash
# Test multiple votes depuis la même IP
curl -X POST http://localhost:3000/api/posts/[POST_ID]/vote \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 192.168.1.100"
```
- ✅ **Attendu** : Premier vote accepté, suivants rejetés (400)
- ❌ **Échec** : Votes multiples acceptés

##### 2. Test d'Accès aux Fichiers Audio
```bash
# Test accès direct aux fichiers audio
curl -I http://localhost:3000/audio/audio_1234567890.webm
curl -I https://s3-endpoint/bucket/audio/audio_1234567890.webm
```
- ✅ **Attendu** : Accès autorisé aux fichiers légitimes
- ❌ **Échec** : Accès à des fichiers non autorisés

##### 3. Test de Manipulation d'ID
```bash
# Test manipulation d'ID de post
curl -X POST http://localhost:3000/api/posts/../../admin/users/vote
curl -X POST http://localhost:3000/api/posts/admin/vote
```
- ✅ **Attendu** : 404 ou 400 pour IDs invalides
- ❌ **Échec** : Accès à des ressources non autorisées

##### 4. Test d'Énumération d'Endpoints
```bash
# Test découverte d'endpoints cachés
curl -I http://localhost:3000/admin
curl -I http://localhost:3000/api/admin
curl -I http://localhost:3000/debug
```
- ✅ **Attendu** : 404 pour tous les endpoints non documentés
- ❌ **Échec** : Découverte d'interfaces admin/debug

---

### A02: Cryptographic Failures (Défaillances Cryptographiques)

#### Fonctionnalités Concernées
- **Connexion base de données** : Chiffrement des communications
- **Stockage S3** : Chiffrement des fichiers audio
- **Hachage des IPs** : Pour le système de votes
- **Variables d'environnement** : Stockage des secrets

#### Tests à Effectuer

##### 1. Test de Chiffrement Base de Données
```bash
# Vérification SSL/TLS pour PostgreSQL
openssl s_client -connect postgresql-host:5432 -starttls postgres
```
- ✅ **Attendu** : Connexion SSL établie
- ❌ **Échec** : Connexion non chiffrée

##### 2. Test de Chiffrement S3
```bash
# Vérification HTTPS pour S3/Cellar
curl -v https://s3-endpoint/bucket/audio/test.webm
```
- ✅ **Attendu** : Connexion HTTPS avec certificat valide
- ❌ **Échec** : Connexion HTTP ou certificat invalide

##### 3. Test de Stockage des Secrets
```bash
# Vérification absence de secrets dans le code
grep -r "password\|secret\|key" --include="*.js" --include="*.json" .
```
- ✅ **Attendu** : Aucun secret hardcodé
- ❌ **Échec** : Secrets trouvés dans le code

##### 4. Test de Hachage des IPs
```bash
# Test du système de vote avec IP hachée
curl -X POST http://localhost:3000/api/posts/[POST_ID]/vote \
  -H "X-Forwarded-For: 192.168.1.100" -v
```
- ✅ **Attendu** : IP hachée dans la base (pas en clair)
- ❌ **Échec** : IP stockée en clair

---

### A03: Injection

#### Fonctionnalités Concernées
- **Formulaire de post** : Champs titre, transcription, badge
- **Requêtes base de données** : Toutes les requêtes SQL
- **Upload de fichiers** : Noms de fichiers et métadonnées
- **Headers HTTP** : X-Forwarded-For, User-Agent

#### Tests à Effectuer

##### 1. Test d'Injection SQL
```bash
# Test injection dans les champs du formulaire
curl -X POST http://localhost:3000/api/posts \
  -F "title=Test'; DROP TABLE posts; --" \
  -F "transcription=Test" \
  -F "badge=wafer" \
  -F "audio=@test.webm"
```
- ✅ **Attendu** : Caractères échappés, pas d'exécution SQL
- ❌ **Échec** : Injection SQL réussie

##### 2. Test d'Injection NoSQL (Headers)
```bash
# Test injection dans les headers
curl -X POST http://localhost:3000/api/posts/[POST_ID]/vote \
  -H "X-Forwarded-For: {'$ne': null}"
```
- ✅ **Attendu** : Header traité comme string
- ❌ **Échec** : Injection dans la logique de vote

##### 3. Test d'Injection dans les Noms de Fichiers
```bash
# Test nom de fichier malicieux
curl -X POST http://localhost:3000/api/posts \
  -F "title=Test" \
  -F "transcription=Test" \
  -F "badge=wafer" \
  -F "audio=@../../../etc/passwd;type=audio/webm"
```
- ✅ **Attendu** : Nom de fichier sanitisé
- ❌ **Échec** : Traversée de répertoire ou injection

##### 4. Test d'Injection Template (Pug)
```bash
# Test injection dans les templates
curl -X POST http://localhost:3000/api/posts \
  -F "title=#{process.env.DATABASE_URL}" \
  -F "transcription=Test" \
  -F "badge=wafer" \
  -F "audio=@test.webm"
```
- ✅ **Attendu** : Contenu échappé dans le template
- ❌ **Échec** : Exécution de code dans le template

---

### A04: Insecure Design (Conception Non Sécurisée)

#### Fonctionnalités Concernées
- **Système de votes** : Prévention du spam
- **Rate limiting** : Protection contre les abus
- **Validation audio** : Contrôle de qualité
- **Architecture générale** : Principes de sécurité

#### Tests à Effectuer

##### 1. Test de Logique Métier - Votes
```bash
# Test accumulation de votes avec différentes techniques
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/posts/[POST_ID]/vote \
    -H "X-Forwarded-For: 192.168.1.$i"
done
```
- ✅ **Attendu** : Système de détection/limitation efficace
- ❌ **Échec** : Votes illimités possibles

##### 2. Test de Validation Audio
```bash
# Test upload de fichiers non-audio
curl -X POST http://localhost:3000/api/posts \
  -F "title=Test" \
  -F "transcription=Test" \
  -F "badge=wafer" \
  -F "audio=@fake_audio.txt;type=audio/webm"
```
- ✅ **Attendu** : Validation stricte du contenu audio
- ❌ **Échec** : Fichiers non-audio acceptés

##### 3. Test de Rate Limiting
```bash
# Test dépassement des limites
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/posts \
    -F "title=Test$i" \
    -F "transcription=Test$i" \
    -F "badge=wafer" \
    -F "audio=@test.webm"
done
```
- ✅ **Attendu** : Blocage après limite atteinte
- ❌ **Échec** : Pas de limitation effective

##### 4. Test de Durée Audio
```bash
# Test audio trop court ou trop long
curl -X POST http://localhost:3000/api/posts \
  -F "title=Test" \
  -F "transcription=Test" \
  -F "badge=wafer" \
  -F "duration=5000" \
  -F "audio=@short_audio.webm"
```
- ✅ **Attendu** : Rejet des audios < 30s ou > 3min
- ❌ **Échec** : Audio invalide accepté

---

### A05: Security Misconfiguration (Configuration de Sécurité Défaillante)

#### Fonctionnalités Concernées
- **Headers HTTP** : Headers de sécurité
- **Gestion d'erreurs** : Messages d'erreur exposés
- **Logging** : Logs en production
- **Configuration serveur** : Paramètres Fastify

#### Tests à Effectuer

##### 1. Test des Headers de Sécurité
```bash
# Vérification des headers de sécurité
curl -I http://localhost:3000/
```
- ✅ **Attendu** : Presence de X-Content-Type-Options, X-Frame-Options, etc.
- ❌ **Échec** : Headers de sécurité manquants

##### 2. Test des Headers Techniques
```bash
# Vérification absence d'infos techniques
curl -I http://localhost:3000/
```
- ✅ **Attendu** : Pas de Server, X-Powered-By, X-Fastify-Version
- ❌ **Échec** : Headers techniques exposés

##### 3. Test des Messages d'Erreur
```bash
# Test erreurs détaillées
curl -X POST http://localhost:3000/api/posts \
  -F "title=" \
  -F "transcription=" \
  -F "badge=invalid"
```
- ✅ **Attendu** : Messages d'erreur génériques
- ❌ **Échec** : Stack traces ou détails techniques

##### 4. Test des Logs
```bash
# Test exposition des logs
curl http://localhost:3000/logs
curl http://localhost:3000/debug
```
- ✅ **Attendu** : 404 pour tous les endpoints de debug
- ❌ **Échec** : Logs accessibles

---

### A06: Vulnerable and Outdated Components (Composants Vulnérables et Obsolètes)

#### Fonctionnalités Concernées
- **Dépendances npm** : Packages Node.js
- **Dépendances frontend** : Tailwind, etc.
- **Base de données** : Version PostgreSQL
- **Système** : Version Node.js

#### Tests à Effectuer

##### 1. Test des Vulnérabilités npm
```bash
# Audit des dépendances
npm audit
npm audit --audit-level=moderate
```
- ✅ **Attendu** : Aucune vulnérabilité critique
- ❌ **Échec** : Vulnérabilités détectées

##### 2. Test des Versions Obsolètes
```bash
# Vérification des versions
npm outdated
node --version
```
- ✅ **Attendu** : Versions récentes et supportées
- ❌ **Échec** : Versions obsolètes ou non supportées

##### 3. Test des Dépendances de Sécurité
```bash
# Vérification des packages critiques
npm ls fastify
npm ls @fastify/rate-limit
```
- ✅ **Attendu** : Versions récentes des packages de sécurité
- ❌ **Échec** : Packages de sécurité obsolètes

---

### A07: Identification and Authentication Failures (Défaillances d'Identification et d'Authentification)

#### Fonctionnalités Concernées
- **Système de votes** : Identification par IP/hash
- **Session management** : Gestion des sessions (si applicable)
- **Tokens/API keys** : Authentification API (si applicable)

#### Tests à Effectuer

##### 1. Test d'Usurpation d'Identité
```bash
# Test manipulation d'IP
curl -X POST http://localhost:3000/api/posts/[POST_ID]/vote \
  -H "X-Forwarded-For: 127.0.0.1"
curl -X POST http://localhost:3000/api/posts/[POST_ID]/vote \
  -H "X-Real-IP: 127.0.0.1"
```
- ✅ **Attendu** : Cohérence dans l'identification
- ❌ **Échec** : Possibilité d'usurpation

##### 2. Test de Session Fixation
```bash
# Test persistance des sessions
curl -c cookies.txt -b cookies.txt http://localhost:3000/
```
- ✅ **Attendu** : Pas de session persistante nécessaire
- ❌ **Échec** : Vulnérabilité de session

##### 3. Test d'Authentification Faible
```bash
# Test absence d'authentification obligatoire
curl -X POST http://localhost:3000/api/posts \
  -F "title=Test" \
  -F "transcription=Test" \
  -F "badge=wafer" \
  -F "audio=@test.webm"
```
- ✅ **Attendu** : Fonctionnalité accessible sans auth (par design)
- ❌ **Échec** : Authentification faible sur fonctions sensibles

---

### A08: Software and Data Integrity Failures (Défaillances d'Intégrité des Logiciels et des Données)

#### Fonctionnalités Concernées
- **Upload de fichiers** : Intégrité des fichiers audio
- **Données utilisateur** : Intégrité des posts
- **Dépendances** : Intégrité des packages
- **Déploiement** : Intégrité du code

#### Tests à Effectuer

##### 1. Test d'Intégrité des Fichiers Audio
```bash
# Test corruption de fichier
curl -X POST http://localhost:3000/api/posts \
  -F "title=Test" \
  -F "transcription=Test" \
  -F "badge=wafer" \
  -F "audio=@corrupted.webm"
```
- ✅ **Attendu** : Détection de corruption
- ❌ **Échec** : Fichier corrompu accepté

##### 2. Test de Validation des Données
```bash
# Test modification des données POST
curl -X POST http://localhost:3000/api/posts \
  -F "title=Test" \
  -F "transcription=Test" \
  -F "badge=wafer" \
  -F "extra_field=malicious" \
  -F "audio=@test.webm"
```
- ✅ **Attendu** : Champs supplémentaires ignorés
- ❌ **Échec** : Données non validées acceptées

##### 3. Test d'Intégrité des Packages
```bash
# Vérification des checksums
npm ci --audit
```
- ✅ **Attendu** : Checksums valides
- ❌ **Échec** : Packages corrompus

---

### A09: Security Logging and Monitoring Failures (Défaillances de Journalisation et de Surveillance de Sécurité)

#### Fonctionnalités Concernées
- **Logs d'accès** : Journalisation des requêtes
- **Logs d'erreurs** : Gestion des erreurs
- **Monitoring** : Surveillance des activités
- **Alerting** : Détection d'anomalies

#### Tests à Effectuer

##### 1. Test de Journalisation des Événements
```bash
# Test génération de logs pour événements critiques
curl -X POST http://localhost:3000/api/posts/[POST_ID]/vote
curl -X POST http://localhost:3000/api/posts -F "title=Test"
```
- ✅ **Attendu** : Logs générés pour actions importantes
- ❌ **Échec** : Événements non journalisés

##### 2. Test de Logs d'Erreurs
```bash
# Test logs d'erreurs sans exposition
curl -X POST http://localhost:3000/api/posts \
  -F "title=" \
  -F "audio=@invalid.txt"
```
- ✅ **Attendu** : Erreurs loggées sans exposition détails
- ❌ **Échec** : Logs d'erreurs manquants ou trop verbeux

##### 3. Test de Surveillance Rate Limiting
```bash
# Test détection d'abus
for i in {1..50}; do
  curl -X POST http://localhost:3000/api/posts/[POST_ID]/vote &
done
```
- ✅ **Attendu** : Tentatives d'abus détectées et loggées
- ❌ **Échec** : Abus non détectés

---

### A10: Server-Side Request Forgery (SSRF) (Falsification de Requête Côté Serveur)

#### Fonctionnalités Concernées
- **Upload S3** : Requêtes vers services externes
- **Webhooks** : Requêtes sortantes (si applicable)
- **Proxies** : Requêtes via proxies
- **Validation d'URL** : Traitement d'URLs

#### Tests à Effectuer

##### 1. Test SSRF via Configuration S3
```bash
# Test manipulation de l'endpoint S3
export S3_ENDPOINT="http://localhost:22"
curl -X POST http://localhost:3000/api/posts \
  -F "title=Test" \
  -F "transcription=Test" \
  -F "badge=wafer" \
  -F "audio=@test.webm"
```
- ✅ **Attendu** : Endpoint S3 fixe, pas de manipulation
- ❌ **Échec** : Possibilité de redirection SSRF

##### 2. Test SSRF via Headers
```bash
# Test headers malicieux
curl -X POST http://localhost:3000/api/posts \
  -H "Host: localhost:22" \
  -H "X-Forwarded-Host: internal.service" \
  -F "title=Test" \
  -F "transcription=Test" \
  -F "badge=wafer" \
  -F "audio=@test.webm"
```
- ✅ **Attendu** : Headers malicieux ignorés
- ❌ **Échec** : Requêtes vers services internes

##### 3. Test SSRF via Redirections
```bash
# Test redirections malicieuses
curl -X POST http://localhost:3000/api/posts \
  -L -F "title=Test" \
  -F "transcription=Test" \
  -F "badge=wafer" \
  -F "audio=@test.webm"
```
- ✅ **Attendu** : Pas de suivie de redirections automatiques
- ❌ **Échec** : Redirections vers services internes

---

## Plan d'Exécution des Tests

### Phase 1: Tests Automatisés (Script)
- Configuration de l'environnement de test
- Génération de fichiers de test (audio, corrupted, etc.)
- Exécution des tests A01 à A10
- Génération de rapport automatique

### Phase 2: Tests Manuels
- Vérification des headers de sécurité
- Test de navigation et UI
- Validation des logs et monitoring
- Test de performance sous charge

### Phase 3: Tests d'Infrastructure
- Configuration CleverCloud
- Sécurité des addons PostgreSQL/Cellar
- Limitations et autoscaling
- Certificats SSL/TLS

### Phase 4: Rapport et Recommandations
- Synthèse des résultats
- Priorisation des vulnérabilités
- Plan de remédiation
- Recommandations d'amélioration

---

## Critères de Réussite

### ✅ Sécurité Acceptable
- Aucune vulnérabilité critique détectée
- Rate limiting fonctionnel
- Validation des données efficace
- Headers de sécurité présents
- Logs appropriés sans exposition

### ❌ Sécurité Insuffisante
- Vulnérabilités critiques détectées
- Possibilité d'injection ou bypass
- Exposition d'informations sensibles
- Rate limiting contournable
- Logs manquants ou trop verbeux

---

## Outils et Prérequis

### Outils Nécessaires
- `curl` : Tests HTTP/API
- `openssl` : Tests SSL/TLS
- `npm` : Audit des dépendances
- `grep` : Recherche de patterns
- `jq` : Traitement JSON
- `node` : Environnement de test

### Fichiers de Test Requis
- `test.webm` : Fichier audio valide
- `short_audio.webm` : Audio < 30s
- `long_audio.webm` : Audio > 3min
- `corrupted.webm` : Fichier corrompu
- `fake_audio.txt` : Fichier non-audio

### Variables d'Environnement
- `NODE_ENV=test`
- `DATABASE_URL` : Base de test
- `S3_ENDPOINT` : Endpoint de test
- `PORT=3000` : Port de test

---

*Ce plan d'audit sera implémenté dans le script `audit_owasp.sh` pour une exécution automatisée et systématique.*
