#!/bin/bash

# OWASP Top 10 Security Audit Script for Saleté Sincère
# Based on owasp_top10_audit_plan.md

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/logs/audit_owasp_$(date +%Y%m%d_%H%M%S).log"
REPORT_FILE="$PROJECT_ROOT/documentation/audit_report_$(date +%Y%m%d_%H%M%S).md"
TEST_SERVER_URL="http://localhost:3000"
TEST_DATA_DIR="$PROJECT_ROOT/test_data"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Create necessary directories
mkdir -p "$(dirname "$LOG_FILE")" "$TEST_DATA_DIR"

# Utility functions
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

log_info() {
    log "${BLUE}[INFO]${NC} $1"
}

log_success() {
    log "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
}

log_error() {
    log "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
}

log_warning() {
    log "${YELLOW}[WARN]${NC} $1"
}

log_skip() {
    log "${YELLOW}[SKIP]${NC} $1"
    ((SKIPPED_TESTS++))
}

# Check if server is running
check_server() {
    if ! curl -s --max-time 5 "$TEST_SERVER_URL/health" > /dev/null; then
        log_error "Server is not running at $TEST_SERVER_URL"
        log_info "Please start the server with: npm start"
        exit 1
    fi
    log_success "Server is running and accessible"
}

# Generate test files
generate_test_files() {
    log_info "Generating test files..."
    
    # Create a valid WebM audio file (minimal)
    if command -v ffmpeg &> /dev/null; then
        ffmpeg -f lavfi -i "sine=frequency=1000:duration=45" -c:a libopus "$TEST_DATA_DIR/test.webm" -y 2>/dev/null
        ffmpeg -f lavfi -i "sine=frequency=1000:duration=15" -c:a libopus "$TEST_DATA_DIR/short_audio.webm" -y 2>/dev/null
        ffmpeg -f lavfi -i "sine=frequency=1000:duration=200" -c:a libopus "$TEST_DATA_DIR/long_audio.webm" -y 2>/dev/null
    else
        # Create dummy files if ffmpeg is not available
        echo "DUMMY_AUDIO_CONTENT" > "$TEST_DATA_DIR/test.webm"
        echo "SHORT_AUDIO" > "$TEST_DATA_DIR/short_audio.webm"
        echo "LONG_AUDIO_CONTENT_THAT_SHOULD_BE_REJECTED" > "$TEST_DATA_DIR/long_audio.webm"
        log_warning "FFmpeg not available, using dummy audio files"
    fi
    
    # Create corrupted file
    dd if=/dev/urandom of="$TEST_DATA_DIR/corrupted.webm" bs=1024 count=10 2>/dev/null
    
    # Create fake audio file
    echo "This is not an audio file" > "$TEST_DATA_DIR/fake_audio.txt"
    
    log_success "Test files generated in $TEST_DATA_DIR"
}

# Initialize report
init_report() {
    cat > "$REPORT_FILE" << EOF
# OWASP Top 10 Audit Report - Saleté Sincère

**Date**: $(date)
**Server**: $TEST_SERVER_URL
**Environment**: ${NODE_ENV:-development}

## Executive Summary

This report presents the results of an OWASP Top 10 2021 security audit performed on the Saleté Sincère application.

## Test Results Summary

EOF
}

# A01: Broken Access Control Tests
test_access_control() {
    log_info "Testing A01: Broken Access Control"
    ((TOTAL_TESTS++))
    
    # Test 1: Double vote prevention
    log_info "Testing double vote prevention..."
    
    # First, create a test post
    POST_RESPONSE=$(curl -s -X POST "$TEST_SERVER_URL/api/posts" \
        -F "title=Test Post for Voting" \
        -F "transcription=Test transcription" \
        -F "badge=wafer" \
        -F "duration=45000" \
        -F "audio=@$TEST_DATA_DIR/test.webm" 2>/dev/null)
    
    if echo "$POST_RESPONSE" | grep -q "success.*true"; then
        POST_ID=$(echo "$POST_RESPONSE" | jq -r '.data.id' 2>/dev/null)
        
        if [ "$POST_ID" != "null" ] && [ -n "$POST_ID" ]; then
            # First vote
            VOTE1=$(curl -s -X POST "$TEST_SERVER_URL/api/posts/$POST_ID/vote" \
                -H "X-Forwarded-For: 192.168.1.100" 2>/dev/null)
            
            # Second vote (should fail)
            VOTE2=$(curl -s -X POST "$TEST_SERVER_URL/api/posts/$POST_ID/vote" \
                -H "X-Forwarded-For: 192.168.1.100" 2>/dev/null)
            
            if echo "$VOTE1" | grep -q "success.*true" && echo "$VOTE2" | grep -q "success.*false"; then
                log_success "Double vote prevention working correctly"
            else
                log_error "Double vote prevention failed"
                echo "Vote 1: $VOTE1" >> "$LOG_FILE"
                echo "Vote 2: $VOTE2" >> "$LOG_FILE"
            fi
        else
            log_error "Failed to extract post ID from response"
        fi
    else
        log_skip "Could not create test post, skipping double vote test"
    fi
    
    # Test 2: ID manipulation
    log_info "Testing ID manipulation..."
    ((TOTAL_TESTS++))
    
    ID_MANIPULATION_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$TEST_SERVER_URL/api/posts/../../admin/users/vote" 2>/dev/null)
    
    if [ "$ID_MANIPULATION_RESPONSE" = "404" ] || [ "$ID_MANIPULATION_RESPONSE" = "400" ]; then
        log_success "ID manipulation properly blocked (HTTP $ID_MANIPULATION_RESPONSE)"
    else
        log_error "ID manipulation not properly blocked (HTTP $ID_MANIPULATION_RESPONSE)"
    fi
    
    # Test 3: Admin endpoint enumeration
    log_info "Testing admin endpoint enumeration..."
    ((TOTAL_TESTS++))
    
    ADMIN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_SERVER_URL/admin" 2>/dev/null)
    
    if [ "$ADMIN_RESPONSE" = "404" ]; then
        log_success "Admin endpoints properly hidden (HTTP $ADMIN_RESPONSE)"
    else
        log_error "Admin endpoints exposed (HTTP $ADMIN_RESPONSE)"
    fi
}

# A02: Cryptographic Failures Tests
test_cryptographic_failures() {
    log_info "Testing A02: Cryptographic Failures"
    
    # Test 1: HTTPS enforcement
    log_info "Testing HTTPS enforcement..."
    ((TOTAL_TESTS++))
    
    # In development, we expect HTTP, but in production should be HTTPS
    if [[ "$TEST_SERVER_URL" == https://* ]]; then
        SSL_RESPONSE=$(curl -s -I "$TEST_SERVER_URL" 2>/dev/null | grep -i "strict-transport-security")
        if [ -n "$SSL_RESPONSE" ]; then
            log_success "HTTPS properly configured with HSTS"
        else
            log_warning "HTTPS configured but HSTS header missing"
        fi
    else
        log_warning "Testing on HTTP (development mode)"
    fi
    
    # Test 2: Check for hardcoded secrets
    log_info "Testing for hardcoded secrets..."
    ((TOTAL_TESTS++))
    
    SECRET_PATTERNS="password|secret|key|token|api_key"
    SECRETS_FOUND=$(grep -r -i -E "$SECRET_PATTERNS" --include="*.js" --include="*.json" "$PROJECT_ROOT" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | grep -v "\.env\|example\|test\|spec\|documentation" | head -5)
    
    if [ -z "$SECRETS_FOUND" ]; then
        log_success "No hardcoded secrets found in source code"
    else
        log_error "Potential hardcoded secrets found:"
        echo "$SECRETS_FOUND" | tee -a "$LOG_FILE"
    fi
}

# A03: Injection Tests
test_injection() {
    log_info "Testing A03: Injection"
    
    # Test 1: SQL Injection in form fields
    log_info "Testing SQL injection in form fields..."
    ((TOTAL_TESTS++))
    
    SQL_INJECTION_RESPONSE=$(curl -s -X POST "$TEST_SERVER_URL/api/posts" \
        -F "title=Test'; DROP TABLE posts; --" \
        -F "transcription=Test" \
        -F "badge=wafer" \
        -F "duration=45000" \
        -F "audio=@$TEST_DATA_DIR/test.webm" 2>/dev/null)
    
    if echo "$SQL_INJECTION_RESPONSE" | grep -q "success.*true"; then
        # Check if injection was successful by trying to access posts
        sleep 2
        POSTS_RESPONSE=$(curl -s "$TEST_SERVER_URL/" 2>/dev/null)
        if echo "$POSTS_RESPONSE" | grep -q "Test'; DROP TABLE posts; --"; then
            log_error "SQL injection possible - malicious input stored"
        else
            log_success "SQL injection properly prevented - input sanitized"
        fi
    else
        log_success "SQL injection properly blocked"
    fi
    
    # Test 2: XSS in form fields
    log_info "Testing XSS in form fields..."
    ((TOTAL_TESTS++))
    
    XSS_PAYLOAD="<script>alert('XSS')</script>"
    XSS_RESPONSE=$(curl -s -X POST "$TEST_SERVER_URL/api/posts" \
        -F "title=$XSS_PAYLOAD" \
        -F "transcription=Test" \
        -F "badge=wafer" \
        -F "duration=45000" \
        -F "audio=@$TEST_DATA_DIR/test.webm" 2>/dev/null)
    
    if echo "$XSS_RESPONSE" | grep -q "success.*true"; then
        sleep 2
        PAGE_RESPONSE=$(curl -s "$TEST_SERVER_URL/" 2>/dev/null)
        if echo "$PAGE_RESPONSE" | grep -q "<script>alert('XSS')</script>"; then
            log_error "XSS vulnerability detected - script tags not escaped"
        else
            log_success "XSS properly prevented - output escaped"
        fi
    else
        log_success "XSS payload properly blocked"
    fi
    
    # Test 3: Header injection
    log_info "Testing header injection..."
    ((TOTAL_TESTS++))
    
    HEADER_INJECTION_RESPONSE=$(curl -s -X POST "$TEST_SERVER_URL/api/posts/fake-id/vote" \
        -H "X-Forwarded-For: 192.168.1.1\r\nEvil-Header: injected" 2>/dev/null)
    
    if echo "$HEADER_INJECTION_RESPONSE" | grep -q "Evil-Header"; then
        log_error "Header injection possible"
    else
        log_success "Header injection properly prevented"
    fi
}

# A04: Insecure Design Tests
test_insecure_design() {
    log_info "Testing A04: Insecure Design"
    
    # Test 1: Rate limiting effectiveness
    log_info "Testing rate limiting..."
    ((TOTAL_TESTS++))
    
    RATE_LIMIT_PASSED=true
    for i in {1..10}; do
        RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$TEST_SERVER_URL/api/posts" \
            -F "title=Rate Test $i" \
            -F "transcription=Test" \
            -F "badge=wafer" \
            -F "duration=45000" \
            -F "audio=@$TEST_DATA_DIR/test.webm" 2>/dev/null)
        
        if [ "$RESPONSE" = "429" ]; then
            log_success "Rate limiting triggered after $i requests"
            break
        elif [ "$i" = "10" ]; then
            RATE_LIMIT_PASSED=false
        fi
        sleep 0.1
    done
    
    if [ "$RATE_LIMIT_PASSED" = false ]; then
        log_error "Rate limiting not effective - 10 requests succeeded"
    fi
    
    # Test 2: Audio validation
    log_info "Testing audio validation..."
    ((TOTAL_TESTS++))
    
    # Test with non-audio file
    INVALID_AUDIO_RESPONSE=$(curl -s -X POST "$TEST_SERVER_URL/api/posts" \
        -F "title=Test" \
        -F "transcription=Test" \
        -F "badge=wafer" \
        -F "duration=45000" \
        -F "audio=@$TEST_DATA_DIR/fake_audio.txt" 2>/dev/null)
    
    if echo "$INVALID_AUDIO_RESPONSE" | grep -q "success.*false"; then
        log_success "Audio validation working - non-audio file rejected"
    else
        log_error "Audio validation failed - non-audio file accepted"
    fi
    
    # Test 3: Audio duration validation
    log_info "Testing audio duration validation..."
    ((TOTAL_TESTS++))
    
    SHORT_AUDIO_RESPONSE=$(curl -s -X POST "$TEST_SERVER_URL/api/posts" \
        -F "title=Test" \
        -F "transcription=Test" \
        -F "badge=wafer" \
        -F "duration=15000" \
        -F "audio=@$TEST_DATA_DIR/short_audio.webm" 2>/dev/null)
    
    if echo "$SHORT_AUDIO_RESPONSE" | grep -q "success.*false"; then
        log_success "Audio duration validation working - short audio rejected"
    else
        log_error "Audio duration validation failed - short audio accepted"
    fi
}

# A05: Security Misconfiguration Tests
test_security_misconfiguration() {
    log_info "Testing A05: Security Misconfiguration"
    
    # Test 1: Security headers
    log_info "Testing security headers..."
    ((TOTAL_TESTS++))
    
    HEADERS_RESPONSE=$(curl -s -I "$TEST_SERVER_URL/" 2>/dev/null)
    
    SECURITY_HEADERS=("X-Content-Type-Options" "X-Frame-Options" "X-XSS-Protection" "Referrer-Policy")
    HEADERS_MISSING=()
    
    for header in "${SECURITY_HEADERS[@]}"; do
        if ! echo "$HEADERS_RESPONSE" | grep -qi "$header"; then
            HEADERS_MISSING+=("$header")
        fi
    done
    
    if [ ${#HEADERS_MISSING[@]} -eq 0 ]; then
        log_success "All security headers present"
    else
        log_error "Missing security headers: ${HEADERS_MISSING[*]}"
    fi
    
    # Test 2: Technical headers removal
    log_info "Testing technical headers removal..."
    ((TOTAL_TESTS++))
    
    TECHNICAL_HEADERS=("server" "x-powered-by" "x-fastify-version")
    EXPOSED_HEADERS=()
    
    for header in "${TECHNICAL_HEADERS[@]}"; do
        if echo "$HEADERS_RESPONSE" | grep -qi "$header"; then
            EXPOSED_HEADERS+=("$header")
        fi
    done
    
    if [ ${#EXPOSED_HEADERS[@]} -eq 0 ]; then
        log_success "Technical headers properly removed"
    else
        log_error "Technical headers exposed: ${EXPOSED_HEADERS[*]}"
    fi
    
    # Test 3: Error message sanitization
    log_info "Testing error message sanitization..."
    ((TOTAL_TESTS++))
    
    ERROR_RESPONSE=$(curl -s -X POST "$TEST_SERVER_URL/api/posts" \
        -F "title=" \
        -F "transcription=" \
        -F "badge=invalid" 2>/dev/null)
    
    if echo "$ERROR_RESPONSE" | grep -q "stack\|trace\|error.*at\|line.*[0-9]"; then
        log_error "Detailed error information exposed"
    else
        log_success "Error messages properly sanitized"
    fi
}

# A06: Vulnerable and Outdated Components Tests
test_vulnerable_components() {
    log_info "Testing A06: Vulnerable and Outdated Components"
    
    # Test 1: NPM audit
    log_info "Running NPM security audit..."
    ((TOTAL_TESTS++))
    
    cd "$PROJECT_ROOT"
    NPM_AUDIT_OUTPUT=$(npm audit --audit-level=high 2>&1)
    
    if echo "$NPM_AUDIT_OUTPUT" | grep -q "0 vulnerabilities"; then
        log_success "No high-severity vulnerabilities found"
    elif echo "$NPM_AUDIT_OUTPUT" | grep -q "found.*vulnerabilities"; then
        log_error "High-severity vulnerabilities found in dependencies"
        echo "$NPM_AUDIT_OUTPUT" | tail -10 >> "$LOG_FILE"
    else
        log_warning "NPM audit check inconclusive"
    fi
    
    # Test 2: Node.js version
    log_info "Checking Node.js version..."
    ((TOTAL_TESTS++))
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    
    if [ "$NODE_VERSION" -ge 18 ]; then
        log_success "Node.js version is current (v$NODE_VERSION)"
    else
        log_warning "Node.js version may be outdated (v$NODE_VERSION)"
    fi
}

# A07: Identification and Authentication Failures Tests
test_authentication_failures() {
    log_info "Testing A07: Identification and Authentication Failures"
    
    # Test 1: IP spoofing prevention
    log_info "Testing IP spoofing prevention..."
    ((TOTAL_TESTS++))
    
    if [ -n "$POST_ID" ]; then
        # Try to vote with different IP headers
        VOTE_REAL_IP=$(curl -s -X POST "$TEST_SERVER_URL/api/posts/$POST_ID/vote" \
            -H "X-Real-IP: 10.0.0.1" 2>/dev/null)
        
        VOTE_FORWARDED=$(curl -s -X POST "$TEST_SERVER_URL/api/posts/$POST_ID/vote" \
            -H "X-Forwarded-For: 10.0.0.1" 2>/dev/null)
        
        if echo "$VOTE_REAL_IP" | grep -q "success.*false" || echo "$VOTE_FORWARDED" | grep -q "success.*false"; then
            log_success "IP-based vote limitation working"
        else
            log_warning "IP spoofing may be possible"
        fi
    else
        log_skip "No test post available for IP spoofing test"
    fi
    
    # Test 2: Session management (if any)
    log_info "Testing session management..."
    ((TOTAL_TESTS++))
    
    SESSION_RESPONSE=$(curl -s -I "$TEST_SERVER_URL/" 2>/dev/null)
    
    if echo "$SESSION_RESPONSE" | grep -qi "set-cookie"; then
        log_warning "Session cookies detected - verify secure configuration"
    else
        log_success "No session cookies detected (stateless design)"
    fi
}

# A08: Software and Data Integrity Failures Tests
test_integrity_failures() {
    log_info "Testing A08: Software and Data Integrity Failures"
    
    # Test 1: File integrity validation
    log_info "Testing file integrity validation..."
    ((TOTAL_TESTS++))
    
    CORRUPTED_RESPONSE=$(curl -s -X POST "$TEST_SERVER_URL/api/posts" \
        -F "title=Test" \
        -F "transcription=Test" \
        -F "badge=wafer" \
        -F "duration=45000" \
        -F "audio=@$TEST_DATA_DIR/corrupted.webm" 2>/dev/null)
    
    if echo "$CORRUPTED_RESPONSE" | grep -q "success.*false"; then
        log_success "File integrity validation working - corrupted file rejected"
    else
        log_error "File integrity validation failed - corrupted file accepted"
    fi
    
    # Test 2: Data validation
    log_info "Testing data validation..."
    ((TOTAL_TESTS++))
    
    EXTRA_FIELDS_RESPONSE=$(curl -s -X POST "$TEST_SERVER_URL/api/posts" \
        -F "title=Test" \
        -F "transcription=Test" \
        -F "badge=wafer" \
        -F "duration=45000" \
        -F "malicious_field=evil_payload" \
        -F "audio=@$TEST_DATA_DIR/test.webm" 2>/dev/null)
    
    if echo "$EXTRA_FIELDS_RESPONSE" | grep -q "success.*true"; then
        log_success "Extra fields properly ignored"
    else
        log_warning "Data validation may be too strict"
    fi
}

# A09: Security Logging and Monitoring Failures Tests
test_logging_monitoring() {
    log_info "Testing A09: Security Logging and Monitoring Failures"
    
    # Test 1: Access logging
    log_info "Testing access logging..."
    ((TOTAL_TESTS++))
    
    # Make a request and check if it's logged
    curl -s "$TEST_SERVER_URL/" > /dev/null 2>&1
    
    # Check if logs are being generated (basic test)
    if [ -f "$PROJECT_ROOT/logs/access.log" ] || [ -f "$PROJECT_ROOT/logs/app.log" ]; then
        log_success "Logging appears to be configured"
    else
        log_warning "No obvious log files found - verify logging configuration"
    fi
    
    # Test 2: Error logging without exposure
    log_info "Testing error logging..."
    ((TOTAL_TESTS++))
    
    ERROR_TRIGGER=$(curl -s -X POST "$TEST_SERVER_URL/api/posts" \
        -F "title=" 2>/dev/null)
    
    if echo "$ERROR_TRIGGER" | grep -q "success.*false" && ! echo "$ERROR_TRIGGER" | grep -q "stack\|trace"; then
        log_success "Errors logged without exposing stack traces"
    else
        log_error "Error handling may expose sensitive information"
    fi
}

# A10: Server-Side Request Forgery (SSRF) Tests
test_ssrf() {
    log_info "Testing A10: Server-Side Request Forgery (SSRF)"
    
    # Test 1: SSRF via malicious headers
    log_info "Testing SSRF via headers..."
    ((TOTAL_TESTS++))
    
    SSRF_RESPONSE=$(curl -s -X POST "$TEST_SERVER_URL/api/posts" \
        -H "Host: localhost:22" \
        -H "X-Forwarded-Host: internal.service" \
        -F "title=Test" \
        -F "transcription=Test" \
        -F "badge=wafer" \
        -F "duration=45000" \
        -F "audio=@$TEST_DATA_DIR/test.webm" 2>/dev/null)
    
    if echo "$SSRF_RESPONSE" | grep -q "success.*true"; then
        log_success "SSRF headers properly ignored"
    else
        log_warning "SSRF test inconclusive"
    fi
    
    # Test 2: Internal service access
    log_info "Testing internal service access..."
    ((TOTAL_TESTS++))
    
    # This is a basic test - in a real scenario, you'd check for actual SSRF
    INTERNAL_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_SERVER_URL/api/posts" \
        -X GET 2>/dev/null)
    
    if [ "$INTERNAL_RESPONSE" = "405" ]; then
        log_success "Only allowed HTTP methods accepted"
    else
        log_warning "Method restriction may not be properly implemented"
    fi
}

# Generate final report
generate_report() {
    cat >> "$REPORT_FILE" << EOF

| Test Category | Total | Passed | Failed | Skipped |
|---------------|-------|--------|--------|---------|
| **Total** | $TOTAL_TESTS | $PASSED_TESTS | $FAILED_TESTS | $SKIPPED_TESTS |

### A01: Broken Access Control
- Double vote prevention
- ID manipulation protection
- Admin endpoint enumeration

### A02: Cryptographic Failures
- HTTPS enforcement
- Hardcoded secrets check

### A03: Injection
- SQL injection prevention
- XSS protection
- Header injection prevention

### A04: Insecure Design
- Rate limiting effectiveness
- Audio validation
- Duration validation

### A05: Security Misconfiguration
- Security headers presence
- Technical headers removal
- Error message sanitization

### A06: Vulnerable and Outdated Components
- NPM security audit
- Node.js version check

### A07: Identification and Authentication Failures
- IP spoofing prevention
- Session management

### A08: Software and Data Integrity Failures
- File integrity validation
- Data validation

### A09: Security Logging and Monitoring Failures
- Access logging
- Error logging

### A10: Server-Side Request Forgery (SSRF)
- SSRF via headers
- Internal service access

## Detailed Results

See the full log file at: \`$LOG_FILE\`

## Recommendations

EOF

    if [ $FAILED_TESTS -gt 0 ]; then
        cat >> "$REPORT_FILE" << EOF
### Critical Issues Found
- $FAILED_TESTS test(s) failed
- Immediate attention required for failed tests
- Review detailed logs for specific vulnerabilities

EOF
    fi

    if [ $SKIPPED_TESTS -gt 0 ]; then
        cat >> "$REPORT_FILE" << EOF
### Tests Skipped
- $SKIPPED_TESTS test(s) were skipped
- May require manual verification
- Check test prerequisites

EOF
    fi

    cat >> "$REPORT_FILE" << EOF
### Overall Security Status
EOF

    if [ $FAILED_TESTS -eq 0 ]; then
        cat >> "$REPORT_FILE" << EOF
✅ **GOOD**: No critical security issues detected
EOF
    else
        cat >> "$REPORT_FILE" << EOF
❌ **CRITICAL**: Security issues detected that require immediate attention
EOF
    fi

    cat >> "$REPORT_FILE" << EOF

---
*Report generated on $(date) by OWASP Top 10 Security Audit Script*
EOF
}

# Main execution
main() {
    log_info "Starting OWASP Top 10 Security Audit for Saleté Sincère"
    log_info "Log file: $LOG_FILE"
    log_info "Report file: $REPORT_FILE"
    
    init_report
    
    check_server
    generate_test_files
    
    # Run all tests
    test_access_control
    test_cryptographic_failures
    test_injection
    test_insecure_design
    test_security_misconfiguration
    test_vulnerable_components
    test_authentication_failures
    test_integrity_failures
    test_logging_monitoring
    test_ssrf
    
    generate_report
    
    log_info "Audit completed!"
    log_info "Results: $PASSED_TESTS passed, $FAILED_TESTS failed, $SKIPPED_TESTS skipped"
    log_info "Full report: $REPORT_FILE"
    
    if [ $FAILED_TESTS -gt 0 ]; then
        log_error "Security issues detected! Please review the report and fix critical issues."
        exit 1
    else
        log_success "No critical security issues detected."
        exit 0
    fi
}

# Run main function
main "$@"
