#!/bin/bash
set -e

# Enable debug mode if requested (shows all executed commands)
[ "${DEBUG:-false}" = "true" ] && set -x

echo "=== RDS Dashboard Container Starting ==="
echo "Timestamp: $(date)"
echo "User: $(whoami)"
echo "Working directory: $(pwd)"
echo ""

# Validate critical ENV vars before exporting
if [ -z "$SYFTBOX_EMAIL" ] || [ -z "$SYFTBOX_REFRESH_TOKEN" ]; then
    echo "❌ ERROR: Missing required environment variables" >&2
    echo "Required: SYFTBOX_EMAIL, SYFTBOX_REFRESH_TOKEN" >&2
    echo "Usage: docker run -e SYFTBOX_EMAIL=your@email.com -e SYFTBOX_REFRESH_TOKEN=your_token ..." >&2
    exit 1
fi

# Export environment variables for child processes
export SYFTBOX_EMAIL
export SYFTBOX_REFRESH_TOKEN
export SYFTBOX_SERVER="${SYFTBOX_SERVER:-https://syftbox.net}"
export DEBUG="${DEBUG:-false}"
export API_PORT="${API_PORT:-8000}"
export HOME="${HOME}"
export APP_USER="$(whoami)"

# Create logs directory for supervisord (must exist before supervisord starts)
# Use $HOME to support any APP_USER setting (not hardcoded to syftboxuser)
SYFTBOX_CONFIG_DIR="${HOME}/.syftbox"
mkdir -p "${SYFTBOX_CONFIG_DIR}/logs"

# Start supervisord with the provided command or default
if [ "$#" -eq 0 ]; then
    echo "Starting supervisord..."
    exec supervisord -c /app/scripts/supervisord.conf -n
else
    echo "Running custom command: $*"
    exec "$@"
fi
