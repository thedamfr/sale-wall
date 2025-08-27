---
title: Copilot Instructions - Saleté Sincère
description: Instructions TDD spécifiques pour GitHub Copilot sur le projet audio Saleté Sincère
owner: @thedamfr
status: active
review_after: 2026-01-01
canonical_url: https://github.com/thedamfr/sale-wall/blob/main/.github/copilot-instructions.md
tags: [copilot, tdd, audio, fastify, security]
---

# Copilot Instructions - Saleté Sincère

> **TDD-first audio platform** : Produire du code maintenable et sécurisé **en écrivant d'abord les tests**, avec une approche minimaliste pour l'enregistrement et diffusion audio.

## Architecture & Stack

**Backend**: Fastify + PostgreSQL + MinIO/S3  
**Frontend**: Pug templates + Vanilla JS + TailwindCSS  
**Audio**: WebM format, 30s-3min, real-time duration tracking  
**Deployment**: CleverCloud avec migrations automatiques  
**Tests**: Node.js + `npm test` (à implémenter)

## Documentation Projet

### ADRs existants
- `documentation/adr_*.md` - Décisions architecturales passées
- Consulter TOUJOURS les ADRs avant de proposer des changements

### Sécurité
- `security/` et `security/reports/` - Audits OWASP Top 10 réalisés
- `security/audit_guide.md` - Guide d'audit sécurité
- Référencer les audits existants avant nouvelles features

### Todolist & Documentation
- `todolist.md` - Tâches en cours et à venir
- `readme.md` - Documentation utilisateur et technique
- **Obligation** : Mettre à jour README.md quand feature terminée

## Règles d'or TDD

1. **Documentation d'abord** : ADR minimal + risques OWASP avant toute ligne de code
2. **Tests d'abord** : RED → GREEN → REFACTOR (cycles ≤ 10 min)
3. **Implémentation minimale** : juste assez pour passer au vert
4. **Sécurité intégrée** : contrôles OWASP + validation d'entrée systématique
5. **Commits atomiques** : 1 GREEN = 1 commit (Conventional Commits)

## Conventions Projet

### Code Style
- **Langue** : Français pour UI/commentaires, anglais pour code
- **Nommage** : camelCase JS, snake_case SQL, kebab-case CSS
- **Audio** : Durée 30s-3min, validation obligatoire côté serveur
- **CORS** : Restrictif à `saletesincere.fr` uniquement

### Structure
```
├── server.js              # Point d'entrée Fastify
├── server/
│   ├── middleware/        # Rate limiting, sécurité
│   ├── validators/        # Validation audio, données
│   └── views/            # Templates Pug
├── public/js/            # VoiceRecorder, logique client
├── sql/                  # Migrations numérotées
├── scripts/              # Migration DB, config S3
└── test/                 # Tests unitaires et intégration
```

### Sécurité (OWASP Top 10)
- **A01 Broken Access Control** : Rate limiting sur tous les endpoints
- **A03 Injection** : Validation stricte des entrées multipart
- **A05 Security Misconfiguration** : Headers sécurisés, CORS restrictif
- **A07 Identification Failures** : Pas d'auth pour l'instant (public)

## Template ADR Minimal

```markdown
# ADR: [Titre court]

**Contexte**: [problème + contraintes perf/sécu/a11y]
**Décision**: [choix techniques clés]
**Conséquences**: 
- ✅ [bénéfices]
- ❌ [coûts/dette]

**Critères d'acceptation** (Given/When/Then):
- Given: [état initial] When: [action] Then: [résultat vérifiable]

**Interfaces publiques**:
- [signatures API ou schémas]

**Risques OWASP ciblés**:
- A01, A03, A05 [expliciter pourquoi]
```

## Procédé TDD Standard

### Pré-requis (STOP si manquant)
- [ ] **Consulter ADRs existants** : `documentation/adr_*.md`
- [ ] **Consulter audits sécurité** : `security/reports/audit_*.md`
- [ ] **Lire README.md** : Comprendre l'architecture et commandes
- [ ] **Lire package.json** : Scripts disponibles (dev=nodemon auto-reload)
- [ ] **Vérifier todolist.md** : Tâches en cours/priorisées
- [ ] ADR minimal validé pour nouvelle feature
- [ ] Risques OWASP identifiés
- [ ] Stack de test définie

### Cycle TDD
1. **Liste des tests** (critères → comportements)
2. **Tests RED** (AAA, 1 comportement/test, pas d'I/O réel)
3. **GREEN minimal** (même naïf/en dur)
4. **REFACTOR** (noms, duplication, structure - tout vert)
5. **Sécurité** (1-2 tests OWASP pertinents)
6. **Documentation** (README.md si feature terminée)
7. **Pause state** (TODO, fichiers, prochain test)

### Exemple Audio TDD

**RED 1**: Validation durée audio
```js
// test/audioValidator.test.js
test('should reject audio shorter than 30s', () => {
  const result = validateAudio(buffer, 'audio/webm', 25000)
  expect(result.isValid).toBe(false)
  expect(result.error).toContain('durée minimale')
})
```

**GREEN 1**: Implémentation minimale
```js
// server/validators/audioValidator.js
export function validateAudio(buffer, mimetype, duration) {
  if (duration < 30000) {
    return { isValid: false, error: 'Durée minimale 30s' }
  }
  return { isValid: true }
}
```

## Anti-patterns à refuser

- ❌ Code puis tests "si j'ai le temps"
- ❌ Tests qui copient l'implémentation
- ❌ Sur-mocking masquant défauts d'intégration
- ❌ Features sans critères d'acceptation écrits

## Spécificités Audio

### Validation Audio (Obligatoire)
- Format: WebM uniquement
- Durée: 30s minimum, 3min maximum
- Taille: 10MB maximum
- Validation côté client ET serveur

### Stockage S3/MinIO
- Bucket: `salete-media`
- Prefix: `/audio/` (seul dossier public)
- CORS: Limité aux domaines production
- URLs publiques pour performance CDN

### Base de Données
- Migrations: SQL numérotées dans `/sql/`
- Colonnes audio: `audio_filename`, `audio_url`, `duration_seconds`
- Pas de `audio_path` (legacy nullable)

## Pause State Template

```
PAUSE STATE
- Tests: [X verts, Y rouges]
- Fichiers modifiés: [liste]
- TODO (≤30 min): [étapes ordonnées]
- Prochain test: [comportement à tester]
- Commit suggéré: [type(scope): description]
```

## Commandes Utiles

```bash
# Tests (à implémenter)
npm test

# Développement local
npm run dev
docker-compose up -d

# Migrations production
node scripts/migrate.js

# Configuration S3/CORS
./scripts/setup-cellar-cors.sh
```

---

**Rappel**: TOUJOURS **ADR + sécu → tests → code minimal → refactor → pause state**  
Si contexte manquant: **STOP** et rédiger l'ADR + risques OWASP avant toute ligne de code.

**Documentation obligatoire**:
- Consulter `documentation/adr_*.md` (décisions passées)
- Consulter `security/reports/audit_*.md` (audits OWASP)
- Lire `readme.md` et `package.json` (comprendre l'existant)
- Vérifier `todolist.md` (tâches prioritaires)
- Référencer documentation existante dans nouvel ADR
