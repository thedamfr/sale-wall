#!/bin/bash

# Audit OWASP simplifié et fonctionnel
# Usage: ./audit_simple.sh

URL_BASE="http://localhost:3000"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo "🔒 Audit Sécurité Saleté Sincère - Version Simple"
echo "================================================"

# Fonction utilitaire
test_result() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [[ "$actual" == *"$expected"* ]]; then
        echo "✅ $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo "❌ $test_name - Expected '$expected', got '$actual'"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Test 1: Serveur accessible
echo "1. Test de base - Serveur"
HEALTH_RESPONSE=$(curl -s "$URL_BASE/health" 2>/dev/null || echo "ERROR")
test_result "Serveur accessible" '"ok":true' "$HEALTH_RESPONSE"

# Test 2: Headers de sécurité
echo -e "\n2. Test des headers de sécurité"
HEADERS=$(curl -s -I "$URL_BASE/" 2>/dev/null || echo "ERROR")

test_result "Header X-Content-Type-Options" "x-content-type-options: nosniff" "$HEADERS"
test_result "Header X-Frame-Options" "x-frame-options: DENY" "$HEADERS"
test_result "Header X-XSS-Protection" "x-xss-protection: 1; mode=block" "$HEADERS"
test_result "Header Referrer-Policy" "referrer-policy: strict-origin-when-cross-origin" "$HEADERS"

# Test 3: Headers techniques supprimés
echo -e "\n3. Test suppression headers techniques"
if echo "$HEADERS" | grep -i "x-powered-by" > /dev/null; then
    echo "❌ Header x-powered-by présent (doit être supprimé)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
else
    echo "✅ Header x-powered-by supprimé"
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

if echo "$HEADERS" | grep -i "server:" > /dev/null; then
    echo "❌ Header server présent (doit être supprimé)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
else
    echo "✅ Header server supprimé"
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 4: Rate limiting
echo -e "\n4. Test rate limiting"
RATE_LIMIT_HEADER=$(echo "$HEADERS" | grep -i "x-ratelimit-limit" | cut -d' ' -f2 | tr -d '\r')
test_result "Rate limit configuré" "100" "$RATE_LIMIT_HEADER"

# Test 5: Gestion d'erreurs
echo -e "\n5. Test gestion d'erreurs"
ERROR_RESPONSE=$(curl -s "$URL_BASE/api/posts/invalid-uuid/vote" 2>/dev/null || echo "ERROR")
if echo "$ERROR_RESPONSE" | grep -q "stack\|trace"; then
    echo "❌ Stack trace exposée dans les erreurs"
    FAILED_TESTS=$((FAILED_TESTS + 1))
else
    echo "✅ Erreurs sanitisées (pas de stack trace)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 6: Endpoints admin
echo -e "\n6. Test endpoints admin"
ADMIN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$URL_BASE/admin" 2>/dev/null)
test_result "Endpoints admin bloqués" "404" "$ADMIN_RESPONSE"

# Test 7: Injection basique
echo -e "\n7. Test injection basique"
# Tester avec des caractères encodés pour éviter les problèmes curl
SQL_RESPONSE=$(curl -s -X POST "$URL_BASE/api/posts/malicious%27%3B%20DROP%20TABLE%20posts%3B%20--/vote" 2>/dev/null)
if echo "$SQL_RESPONSE" | grep -q '"success":false'; then
    echo "✅ Injection SQL bloquée"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo "❌ Possible injection SQL"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Résumé
echo -e "\n📊 Résumé des tests"
echo "=================="
echo "Tests réussis: $PASSED_TESTS/$TOTAL_TESTS"
echo "Tests échoués: $FAILED_TESTS/$TOTAL_TESTS"

if [ $FAILED_TESTS -eq 0 ]; then
    echo "🎉 Tous les tests passent ! Application sécurisée."
    exit 0
else
    echo "⚠️  $FAILED_TESTS test(s) ont échoué. Vérifiez la configuration."
    exit 1
fi
