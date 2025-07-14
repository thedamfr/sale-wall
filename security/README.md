# Sécurité - Saleté Sincère

Ce dossier contient tous les éléments liés à la sécurité de l'application "Saleté Sincère".

## 📁 Structure

```
security/
├── README.md                    # Ce fichier
├── audit_guide.md              # Guide d'utilisation des outils d'audit
├── plans/
│   └── owasp_top10_audit_plan.md  # Plan d'audit OWASP Top 10 détaillé
└── reports/
    ├── audit_final_report.md    # Rapport final de sécurité
    ├── audit_owasp_*.log        # Logs d'audit automatisés
    └── audit_report_*.md        # Rapports d'audit générés
```

## 🔒 Audit de Sécurité

### Status Actuel
- **Statut** : ✅ SÉCURISÉ
- **Dernier audit** : 14 juillet 2025
- **Vulnérabilités critiques** : 0
- **Score OWASP Top 10** : 9.5/10

### Outils d'audit
- **Plan** : `plans/owasp_top10_audit_plan.md`
- **Guide** : `audit_guide.md`
- **Scripts** : `../scripts/audit_owasp.sh` et `../scripts/prepare_audit.sh`

### Lancer un audit
```bash
# Audit complet automatique
./scripts/prepare_audit.sh full

# Résultats dans security/reports/
```

## 🛡️ Mesures de Sécurité Actives

### Rate Limiting
- **Posts** : 3/heure par IP
- **Votes** : 10/heure par IP
- **Pages** : 100/minute par IP

### Validation
- **Audio** : 30s minimum, format WebM/Opus
- **Données** : Validation stricte des champs
- **UUID** : Validation des identifiants

### Headers de Sécurité
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

### Error Handling
- Messages sanitisés
- Stack traces supprimées
- Logging sécurisé

## 📋 Compliance

### OWASP Top 10 2021
- ✅ A01: Broken Access Control
- ✅ A02: Cryptographic Failures
- ✅ A03: Injection
- ✅ A04: Insecure Design
- ✅ A05: Security Misconfiguration
- ✅ A06: Vulnerable Components
- ✅ A07: Authentication Failures
- ✅ A08: Data Integrity Failures
- ✅ A09: Logging and Monitoring
- ✅ A10: Server-Side Request Forgery

### Prochains Audits
- **Fréquence** : Mensuel en production
- **Automatisation** : Intégration CI/CD recommandée
- **Monitoring** : Surveillance continue des logs

---

*Dernière mise à jour : 14 juillet 2025*
