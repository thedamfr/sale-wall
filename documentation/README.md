---
title: Documentation Technique
description: Navigation vers toute la documentation technique du projet Saleté Sincère
owner: @thedamfr
status: active
review_after: 2026-01-01
canonical_url: https://github.com/thedamfr/sale-wall/blob/main/documentation/README.md
tags: [documentation, navigation, adr, security, tdd]
---

# Architecture Decision Records (ADRs)

Documentation technique et décisions architecturales du projet Saleté Sincère.

## 📋 ADRs Essentiels

| Décision | Statut | Impact |
|----------|--------|---------|
| [Voice Posting MVP](./adr/adr_0001_voice_posting_mvp.md) | ✅ Implémenté | Fonctionnalité cœur |
| [Production CleverCloud](./adr/adr_0003_deployment_production_clevercloud.md) | ✅ Actif | Infrastructure |
| [Rate Limiting & Security](./adr/adr_0004_rate_limiting_security.md) | ✅ Actif | Sécurité |

**� Tous les ADRs** : [`./adr/index.md`](./adr/index.md)

## 📚 Documentation Technique

### � Sécurité & Audits
- **Guide d'audit** : [`./audit_guide.md`](./audit_guide.md) - Comment lancer les audits OWASP
- **Plan d'audit OWASP** : [`./owasp_top10_audit_plan.md`](./owasp_top10_audit_plan.md) - Méthodologie complète
- **Rapports d'audit** : [`../security/reports/`](../security/reports/) - Historique des audits
- **Rapport final** : [`./audit_final_report.md`](./audit_final_report.md) - Synthèse sécurité

### �️ Scripts & Outils
- **Scripts migration** : [`../scripts/migrate.js`](../scripts/migrate.js) - Base de données
- **Scripts sécurité** : [`../scripts/audit_*.sh`](../scripts/) - Audits automatisés
- **Setup S3/CORS** : [`../scripts/setup-cellar-cors.sh`](../scripts/setup-cellar-cors.sh) - Configuration stockage

### 🧪 Méthodologie TDD
- **Framework générique** : [`../CLAUDE.md`](../CLAUDE.md) - Playbook TDD-first 
- **Instructions Copilot** : [`../.github/copilot-instructions.md`](../.github/copilot-instructions.md) - Spécifique projet
- **Template ADR** : [`../CLAUDE.md`](../CLAUDE.md#template-adr-minimal) - Structure standardisée

### 🏗️ Architecture & Code  
- **Structure projet** : [`../readme.md`](../readme.md) - Vue d'ensemble technique
- **Configuration Docker** : [`../docker-compose.yml`](../docker-compose.yml) - Environnement local
- **Migration SQL** : [`../sql/`](../sql/) - Évolution base de données

## 🎯 Quick Start Documentation

**Pour les nouveaux contributeurs** :
1. Lire [`../readme.md`](../readme.md) - Overview du projet
2. Consulter [`../CLAUDE.md`](../CLAUDE.md) - Méthodologie TDD
3. Parcourir [`./adr/index.md`](./adr/index.md) - Décisions architecturales
4. Vérifier [`../todolist.md`](../todolist.md) - Tâches en cours

**Pour le développement** :
1. **Setup local** : [`../readme.md#développement-local`](../readme.md#%EF%B8%8F-développement-local)
2. **Sécurité** : [`./audit_guide.md`](./audit_guide.md) - Lancer les audits
3. **Déploiement** : [`./adr/adr_0003_deployment_production_clevercloud.md`](./adr/adr_0003_deployment_production_clevercloud.md)
