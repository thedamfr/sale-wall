# Rapports d'Audit de Sécurité

Ce dossier contient les rapports d'audit de sécurité générés automatiquement.

## 📄 Fichiers

### Rapport Final
- **audit_final_report.md** : Rapport de sécurité final validé
- **Statut** : ✅ Application sécurisée
- **Date** : 14 juillet 2025

### Rapports Automatiques
- **audit_owasp_*.log** : Logs détaillés des audits automatisés
- **audit_report_*.md** : Rapports générés par les scripts
- **Fréquence** : Générés à chaque exécution de `./scripts/audit_owasp.sh`

## 🔄 Génération

Les rapports automatiques sont générés par :
```bash
./scripts/prepare_audit.sh full
```

## 📋 Rétention

- **Rapport final** : Conservé dans Git
- **Rapports automatiques** : Ignorés par Git (voir `.gitignore`)
- **Nettoyage** : Suppression manuelle recommandée après 30 jours

---

*Les rapports automatiques sont générés dans ce dossier à chaque audit*
