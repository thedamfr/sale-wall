#!/bin/bash

# Preparation script for OWASP Top 10 Security Audit
# This script sets up the environment for running the security audit

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites for OWASP audit..."
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check if curl is available
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed"
        exit 1
    fi
    
    # Check if jq is available
    if ! command -v jq &> /dev/null; then
        log_warning "jq is not installed - some tests may be limited"
        log_info "Install jq with: brew install jq (macOS) or apt-get install jq (Ubuntu)"
    fi
    
    # Check if ffmpeg is available
    if ! command -v ffmpeg &> /dev/null; then
        log_warning "ffmpeg is not installed - using dummy audio files"
        log_info "Install ffmpeg with: brew install ffmpeg (macOS) or apt-get install ffmpeg (Ubuntu)"
    fi
    
    log_info "Prerequisites check completed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$PROJECT_ROOT"
    
    if [ -f "package.json" ]; then
        npm install
        log_info "Dependencies installed"
    else
        log_error "package.json not found"
        exit 1
    fi
}

# Set up test environment
setup_test_environment() {
    log_info "Setting up test environment..."
    
    # Create necessary directories
    mkdir -p "$PROJECT_ROOT/logs"
    mkdir -p "$PROJECT_ROOT/test_data"
    mkdir -p "$PROJECT_ROOT/uploads"
    
    # Set test environment variables
    export NODE_ENV=test
    export PORT=3000
    
    # Create .env.test if it doesn't exist
    if [ ! -f "$PROJECT_ROOT/.env.test" ]; then
        cat > "$PROJECT_ROOT/.env.test" << EOF
NODE_ENV=test
PORT=3000
DATABASE_URL=postgresql://salete:salete@localhost:5432/salete_test
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=salete
S3_SECRET_KEY=salete123
S3_BUCKET=salete-media-test
EOF
        log_info "Created .env.test file"
    fi
    
    log_info "Test environment setup completed"
}

# Check database connectivity
check_database() {
    log_info "Checking database connectivity..."
    
    if [ -n "${DATABASE_URL:-}" ]; then
        log_info "Database URL configured: ${DATABASE_URL}"
    else
        log_warning "DATABASE_URL not set - using default"
    fi
    
    # Try to connect to database (basic check)
    if command -v psql &> /dev/null; then
        if psql "${DATABASE_URL:-postgresql://salete:salete@localhost:5432/salete}" -c "SELECT 1;" &> /dev/null; then
            log_info "Database connection successful"
        else
            log_warning "Database connection failed - some tests may be skipped"
        fi
    else
        log_warning "psql not available - cannot verify database connection"
    fi
}

# Start the application
start_application() {
    log_info "Starting application for testing..."
    
    cd "$PROJECT_ROOT"
    
    # Check if server is already running
    if curl -s --max-time 3 "http://localhost:3000/health" > /dev/null 2>&1; then
        log_info "Application is already running"
        return 0
    fi
    
    # Start the server in background
    log_info "Starting server in background..."
    nohup npm start > logs/server.log 2>&1 &
    SERVER_PID=$!
    
    # Wait for server to start
    log_info "Waiting for server to start..."
    for i in {1..30}; do
        if curl -s --max-time 3 "http://localhost:3000/health" > /dev/null 2>&1; then
            log_info "Server started successfully (PID: $SERVER_PID)"
            echo "$SERVER_PID" > "$PROJECT_ROOT/server.pid"
            return 0
        fi
        sleep 1
    done
    
    log_error "Server failed to start within 30 seconds"
    return 1
}

# Stop the application
stop_application() {
    log_info "Stopping application..."
    
    if [ -f "$PROJECT_ROOT/server.pid" ]; then
        SERVER_PID=$(cat "$PROJECT_ROOT/server.pid")
        if kill -0 "$SERVER_PID" 2>/dev/null; then
            kill "$SERVER_PID"
            log_info "Server stopped (PID: $SERVER_PID)"
        fi
        rm -f "$PROJECT_ROOT/server.pid"
    else
        # Try to find and kill the process
        if pgrep -f "node.*server.js" > /dev/null; then
            pkill -f "node.*server.js"
            log_info "Server process terminated"
        else
            log_info "No server process found"
        fi
    fi
}

# Run the audit
run_audit() {
    log_info "Running OWASP Top 10 security audit..."
    
    if [ -f "$SCRIPT_DIR/audit_owasp.sh" ]; then
        "$SCRIPT_DIR/audit_owasp.sh"
    else
        log_error "Audit script not found: $SCRIPT_DIR/audit_owasp.sh"
        exit 1
    fi
}

# Clean up test data
cleanup() {
    log_info "Cleaning up test data..."
    
    # Remove test files
    if [ -d "$PROJECT_ROOT/test_data" ]; then
        rm -rf "$PROJECT_ROOT/test_data"
        log_info "Test data cleaned up"
    fi
    
    # Remove temporary uploads
    if [ -d "$PROJECT_ROOT/uploads" ]; then
        find "$PROJECT_ROOT/uploads" -name "audio_*.webm" -mtime +1 -delete 2>/dev/null || true
        log_info "Temporary uploads cleaned up"
    fi
}

# Show help
show_help() {
    cat << EOF
OWASP Top 10 Security Audit Preparation Script

Usage: $0 [COMMAND]

Commands:
  check         Check prerequisites
  install       Install dependencies
  setup         Set up test environment
  start         Start application for testing
  stop          Stop application
  audit         Run the security audit
  cleanup       Clean up test data
  full          Run complete audit (setup + start + audit + stop)
  help          Show this help message

Examples:
  $0 full                 # Run complete audit process
  $0 start && $0 audit    # Start server and run audit
  $0 cleanup              # Clean up after testing

EOF
}

# Main execution
main() {
    case "${1:-help}" in
        check)
            check_prerequisites
            ;;
        install)
            install_dependencies
            ;;
        setup)
            setup_test_environment
            ;;
        start)
            start_application
            ;;
        stop)
            stop_application
            ;;
        audit)
            run_audit
            ;;
        cleanup)
            cleanup
            ;;
        full)
            log_info "Running complete OWASP audit process..."
            check_prerequisites
            install_dependencies
            setup_test_environment
            check_database
            start_application
            sleep 3  # Give server time to fully start
            run_audit
            stop_application
            cleanup
            ;;
        help|*)
            show_help
            ;;
    esac
}

# Set up signal handlers
trap 'stop_application; cleanup; exit 130' INT TERM

# Run main function
main "$@"
