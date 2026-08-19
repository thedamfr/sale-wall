# Architecture Decision Records (ADRs)

Index des décisions architecturales du projet Saleté Sincère.

## 📋 ADRs Actifs

| #    | Titre | Statut | Date | Impacte |
|------|-------|--------|------|---------|
| [ADR-0001](./adr_0001_voice_posting_mvp.md) | Voice Posting MVP | ✅ **Implémenté** | 2025-07 | Audio, UI |
| [ADR-0002](./adr_0002_voice_posting_mvp_implemented.md) | MVP Implementation Details | ✅ **Implémenté** | 2025-07 | Backend, Storage |
| [ADR-0003](./adr_0003_deployment_production_clevercloud.md) | Production Deployment CleverCloud | ✅ **Actif** | 2025-07 | Infrastructure |
| [ADR-0004](./adr_0004_rate_limiting_security.md) | Rate Limiting & Security | ✅ **Actif** | 2025-07 | Sécurité |

## 📊 Statistiques

- **Total ADRs** : 4
- **Actifs** : 2 (infrastructures/sécurité)
- **Implémentés** : 2 (features)
- **Obsolètes** : 0

## 🔍 Recherche par domaine

### 🎙️ Audio & Frontend
- [ADR-0001](./adr_0001_voice_posting_mvp.md) - Voice Posting MVP
- [ADR-0002](./adr_0002_voice_posting_mvp_implemented.md) - Implementation Details

### 🏗️ Infrastructure & Déploiement  
- [ADR-0003](./adr_0003_deployment_production_clevercloud.md) - Production CleverCloud
- [ADR-0004](./adr_0004_rate_limiting_security.md) - Rate Limiting & Security

### 🔒 Sécurité
- [ADR-0004](./adr_0004_rate_limiting_security.md) - Rate Limiting & Security
- **Audit complet** : [`../../security/audit_final_report.md`](../../security/audit_final_report.md)

## ✍️ Créer un nouvel ADR

1. **Numéroter** : Prendre le prochain numéro (0005, 0006...)
2. **Template** : S'appuyer sur un ADR existant et sur [`AGENTS.md`](../../AGENTS.md)
3. **Front matter** : Ajouter métadonnées (voir exemples)
4. **Mettre à jour** : Cet index README.md

## 📚 Documentation connexe

- **Security** : [`../../security/`](../../security/) - Audits OWASP et guides
- **Scripts** : [`../../scripts/`](../../scripts/) - Migrations et outils
- **Instructions de développement** : [`../../AGENTS.md`](../../AGENTS.md) - Méthodologie et vérifications
- **Copilot Instructions** : [`../../.github/copilot-instructions.md`](../../.github/copilot-instructions.md)
