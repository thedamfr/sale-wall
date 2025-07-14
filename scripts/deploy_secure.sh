#!/bin/bash

# Script de déploiement sécurisé pour Saleté Sincère
# Phase 5: Déploiement final avant vacances

set -e

echo "🚀 Déploiement sécurisé - Saleté Sincère"
echo "======================================="

# 1. Vérifier que tous les tests passent
echo "📋 Étape 1: Vérification des tests de sécurité"
if ! ./scripts/test_security.sh; then
    echo "❌ Tests de sécurité échoués. Arrêt du déploiement."
    exit 1
fi

echo ""
echo "📋 Étape 2: Vérification de l'état du repository"

# 2. Vérifier que le code est committé
if ! git diff --quiet; then
    echo "⚠️  Modifications non commitées détectées:"
    git status --porcelain
    echo ""
    read -p "Continuer le déploiement ? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Déploiement annulé."
        exit 1
    fi
fi

echo ""
echo "📋 Étape 3: Vérification de la configuration CleverCloud"

# 3. Vérifier la configuration CleverCloud
if ! clever status | grep -q "Scalers: 1"; then
    echo "❌ Autoscaler pas configuré à 1 instance"
    echo "Exécutez: clever scale --min-instances 1 --max-instances 1"
    exit 1
fi

echo "✅ Configuration CleverCloud OK"

echo ""
echo "📋 Étape 4: Commit final des améliorations"

# 4. Commit final si nécessaire
if ! git diff --quiet; then
    git add -A
    git commit -m "✅ Phase 5: Tests de sécurité et déploiement final

- Script de test sécurité complet
- Script de déploiement automatisé
- Validation complète avant vacances
- Toutes les phases de sécurité terminées"
fi

echo ""
echo "📋 Étape 5: Déploiement vers CleverCloud"

# 5. Push vers CleverCloud
if git remote | grep -q "clever"; then
    echo "🚀 Déploiement vers CleverCloud..."
    git push clever main
    echo "✅ Déploiement terminé"
else
    echo "⚠️  Remote 'clever' non configuré"
    echo "Le déploiement se fera automatiquement via GitHub sync"
fi

echo ""
echo "📋 Étape 6: Vérification finale"

# 6. Attendre quelques secondes et vérifier le statut
sleep 10
if command -v clever &> /dev/null; then
    echo "📊 Statut final de l'application:"
    clever status
    echo ""
    clever logs --since 1m
else
    echo "⚠️  clever-tools non disponible pour vérification"
fi

echo ""
echo "🎉 DÉPLOIEMENT TERMINÉ !"
echo "========================"
echo ""
echo "✅ Application sécurisée et déployée"
echo "✅ Autoscaler limité à 1 instance"
echo "✅ Rate limiting activé"
echo "✅ Headers de sécurité en place"
echo "✅ Messages d'erreur sanitisés"
echo "✅ Validation audio 30s minimum"
echo ""
echo "🏖️  Bonnes vacances ! L'application est protégée."
echo ""
echo "📋 Pour surveillance:"
echo "- Logs: clever logs --follow"
echo "- Statut: clever status"
echo "- Métriques: Console CleverCloud"
