---
title: Index des ADRs
description: Index complet de toutes les Architecture Decision Records du projet
owner: @thedamfr
status: active
review_after: 2026-01-01
canonical_url: https://github.com/thedamfr/sale-wall/blob/main/documentation/adr/index.md
tags: [adr, index, architecture, decisions]
---

# Index des ADRs - Saleté Sincère

**Index complet des Architecture Decision Records du projet.**

## 📋 Tous les ADRs

| #    | Titre | Statut | Date | Domaine | Impact |
|------|-------|--------|------|---------|--------|
| [ADR-0001](./adr_0001_voice_posting_mvp.md) | Voice Posting MVP | ✅ **Implémenté** | 2025-07 | Audio, UI | Cœur |
| [ADR-0002](./adr_0002_voice_posting_mvp_implemented.md) | MVP Implementation Details | ✅ **Implémenté** | 2025-07 | Backend, Storage | Cœur |
| [ADR-0003](./adr_0003_deployment_production_clevercloud.md) | Production Deployment CleverCloud | ✅ **Actif** | 2025-07 | Infrastructure | Critique |
| [ADR-0004](./adr_0004_rate_limiting_security.md) | Rate Limiting & Security | ✅ **Actif** | 2025-07 | Sécurité | Critique |
| [ADR-0005](./adr_0005_newsletter_brevo_integration.md) | Newsletter Brevo Integration | 🔄 **En cours** | 2025-09 | Newsletter, API | Feature |
| [ADR-0006](./adr_0005_newsletter_doi_automation_approach.md) | Newsletter DOI Automation | ✅ **Accepté** | 2025-09 | Newsletter, DOI | Feature |

## 📊 Statistiques

- **Total ADRs** : 6
- **Actifs** : 2 (infrastructure/sécurité)
- **Implémentés/Acceptés** : 4 (features audio + newsletter)
- **En cours** : 1 (newsletter intégration)
- **Draft** : 0
- **Obsolètes** : 0

## 🔍 Recherche par domaine

### 🎙️ Audio & Frontend
- [ADR-0001](./adr_0001_voice_posting_mvp.md) - Voice Posting MVP
- [ADR-0002](./adr_0002_voice_posting_mvp_implemented.md) - Implementation Details

### 🏗️ Infrastructure & Déploiement  
- [ADR-0003](./adr_0003_deployment_production_clevercloud.md) - Production CleverCloud

### 🔒 Sécurité
- [ADR-0004](./adr_0004_rate_limiting_security.md) - Rate Limiting & Security

### 📧 Newsletter & API Integration  
- [ADR-0005](./adr_0005_newsletter_brevo_integration.md) - Newsletter Brevo Integration (en cours)
- [ADR-0006](./adr_0005_newsletter_doi_automation_approach.md) - Newsletter DOI Automation (accepté)

## ✍️ Créer un nouvel ADR

1. **Numéroter** : Prendre le prochain numéro (0005, 0006...)
2. **Template** : Utiliser [`../../CLAUDE.md`](../../CLAUDE.md) section ADR minimal
3. **Front matter** : Ajouter métadonnées (statut, date, domaine)
4. **Mettre à jour** : Cet index après création

**📚 Retour à la doc** : [`../README.md`](../README.md)
