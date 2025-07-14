#!/bin/bash

# Test de sécurité Phase 5 - Validation avant vacances
# Usage: ./test_security.sh [URL_BASE]

URL_BASE=${1:-"http://localhost:3000"}
TOTAL_TESTS=0
PASSED_TESTS=0

echo "🔒 Tests de sécurité pour Saleté Sincère"
echo "========================================"
echo "URL testée: $URL_BASE"
echo ""

# Fonction utilitaire pour les tests
test_assertion() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"
    local contains_mode="$4"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [[ "$contains_mode" == "contains" ]]; then
        if [[ "$actual" == *"$expected"* ]]; then
            echo "✅ $test_name"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo "❌ $test_name - Expected '$expected', got '$actual'"
        fi
    else
        if [[ "$actual" == "$expected" ]]; then
            echo "✅ $test_name"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo "❌ $test_name - Expected '$expected', got '$actual'"
        fi
    fi
}

# Test 1: Headers de sécurité
echo "🛡️  Test 1: Headers de sécurité"
HEADERS=$(curl -s -I "$URL_BASE/")

# Vérifier que x-powered-by est absent
if echo "$HEADERS" | grep -i "x-powered-by" > /dev/null; then
    echo "❌ Header x-powered-by présent (doit être supprimé)"
else
    echo "✅ Header x-powered-by supprimé"
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Vérifier que server est absent
if echo "$HEADERS" | grep -i "server:" > /dev/null; then
    echo "❌ Header server présent (doit être supprimé)"
else
    echo "✅ Header server supprimé"
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Vérifier headers de sécurité
test_assertion "Header X-Content-Type-Options" "x-content-type-options: nosniff" "$HEADERS" "contains"
test_assertion "Header X-Frame-Options" "x-frame-options: DENY" "$HEADERS" "contains"
test_assertion "Header X-XSS-Protection" "x-xss-protection: 1; mode=block" "$HEADERS" "contains"
test_assertion "Header Referrer-Policy" "referrer-policy: strict-origin-when-cross-origin" "$HEADERS" "contains"

echo ""

# Test 2: Rate limiting
echo "🚦 Test 2: Rate limiting"

# Test rate limiting pages (100/min)
RATE_LIMIT_HEADERS=$(curl -s -I "$URL_BASE/")
RATE_LIMIT=$(echo "$HEADERS" | grep -i "x-ratelimit-limit" | cut -d' ' -f2 | tr -d '\r')
test_assertion "Rate limit pages configuré" "100" "$RATE_LIMIT"

echo ""

# Test 3: Messages d'erreur sanitisés
echo "🧹 Test 3: Messages d'erreur sanitisés"

# Test 404
RESPONSE_404=$(curl -s "$URL_BASE/api/inexistant")
test_assertion "Message 404 sanitisé" '{"success":false,"message":"Page non trouvée"}' "$RESPONSE_404"

# Test double vote (si UUID valide disponible)
# Ce test nécessite un UUID valide, on le fait en optionnel
echo "   (Test double vote nécessite UUID valide - à faire manuellement)"

echo ""

# Test 4: Validation audio
echo "🎵 Test 4: Validation audio"

# Test upload sans données
UPLOAD_RESPONSE=$(curl -s -X POST "$URL_BASE/api/posts" -F "title=")
test_assertion "Upload sans données" "Informations manquantes" "$UPLOAD_RESPONSE" "contains"

echo ""

# Test 5: Configuration CleverCloud (si on a clever-tools)
echo "☁️  Test 5: Configuration CleverCloud"
if command -v clever &> /dev/null; then
    # Vérifier que l'autoscaler est limité à 1
    CLEVER_STATUS=$(clever status 2>/dev/null | grep "Scalers:")
    if [[ "$CLEVER_STATUS" == *"Scalers: 1"* ]]; then
        echo "✅ Autoscaler limité à 1 instance"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo "❌ Autoscaler non limité à 1 instance"
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    echo "   (clever-tools non disponible - test ignoré)"
fi

echo ""

# Résumé
echo "📊 Résumé des tests"
echo "=================="
echo "Tests réussis: $PASSED_TESTS/$TOTAL_TESTS"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo "🎉 Tous les tests passent ! Application prête pour les vacances."
    exit 0
else
    echo "⚠️  Certains tests ont échoué. Vérifiez la configuration."
    exit 1
fi
