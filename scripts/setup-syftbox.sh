#!/bin/bash
set -e

# Enable debug mode if requested
# `set -x` to print each command before executing it
[ "${DEBUG:-false}" = "true" ] && set -x

# Configuration paths
SYFTBOX_USER="${SYFTBOX_USER:-syftboxuser}"
SYFTBOX_HOME="/home/${SYFTBOX_USER}"
SYFTBOX_CONFIG_DIR="${SYFTBOX_HOME}/.syftbox"
SYFTBOX_DATA_DIR="${SYFTBOX_HOME}/SyftBox"
CONFIG_FILE="${SYFTBOX_CONFIG_DIR}/config.json"

# Error handling function
error_exit() {
    echo "❌ ERROR: $1" >&2
    [ -n "${2:-}" ] && echo "   $2" >&2
    exit 1
}

echo "=== SyftBox Setup ==="

# Validate required environment variables
[ -z "$SYFTBOX_EMAIL" ] && error_exit \
    "SYFTBOX_EMAIL environment variable is required" \
    "Usage: docker run -e SYFTBOX_EMAIL=your@email.com -e SYFTBOX_REFRESH_TOKEN=your_token ..."

[ -z "$SYFTBOX_REFRESH_TOKEN" ] && error_exit \
    "SYFTBOX_REFRESH_TOKEN environment variable is required" \
    "To get token: cat ~/.syftbox/config.json | jq -r '.refresh_token'"

# Set default server if not provided
SYFTBOX_SERVER="${SYFTBOX_SERVER:-https://syftbox.net}"

# Validate email format (basic check)
echo "$SYFTBOX_EMAIL" | grep -qE '^[^@]+@[^@]+\.[^@]+$' || \
    error_exit "SYFTBOX_EMAIL has invalid format: $SYFTBOX_EMAIL" \
        "Expected format: user@example.com"

# Validate server URL format
echo "$SYFTBOX_SERVER" | grep -qE '^https?://' || \
    error_exit "SYFTBOX_SERVER must be a valid HTTP(S) URL: $SYFTBOX_SERVER" \
        "Expected format: https://syftbox.net"

# Validate token is not suspiciously short (basic sanity check)
[ ${#SYFTBOX_REFRESH_TOKEN} -ge 10 ] || \
    error_exit "SYFTBOX_REFRESH_TOKEN appears too short (length: ${#SYFTBOX_REFRESH_TOKEN})" \
        "Expected a JWT token (typically 100+ characters)"

# Check if config already exists
if [ -f "$CONFIG_FILE" ] && [ "${FORCE_OVERWRITE:-false}" != "true" ]; then
    echo "⚠️  Config file already exists at $CONFIG_FILE"
    echo "Skipping config generation (set FORCE_OVERWRITE=true to override)"
    echo "=== Setup Complete (using existing config) ==="
    exit 0
fi

echo "Generating SyftBox config.json..."
echo "  Email: $SYFTBOX_EMAIL"
echo "  Server: $SYFTBOX_SERVER"
echo "  Data dir: $SYFTBOX_DATA_DIR"

# Create config directory
mkdir -p "$SYFTBOX_CONFIG_DIR"

# Generate config.json using jq with proper escaping (prevents JSON injection)
# Use umask to ensure file is created with secure permissions 600
#  (readable/writable only by the owner, no access for group or others) from the start
(umask 077 && jq -n \
  --arg email "$SYFTBOX_EMAIL" \
  --arg server "$SYFTBOX_SERVER" \
  --arg datadir "$SYFTBOX_DATA_DIR" \
  --arg token "$SYFTBOX_REFRESH_TOKEN" \
  '{
    email: $email,
    server_url: $server,
    data_dir: $datadir,
    refresh_token: $token
  }' > "$CONFIG_FILE"
)

# Verify config was created
[ -f "$CONFIG_FILE" ] || error_exit "Failed to create config.json at $CONFIG_FILE"

echo "✓ SyftBox config.json created successfully"
echo ""
cat "$CONFIG_FILE" | jq 'del(.refresh_token) | . + {refresh_token: "***REDACTED***"}'
echo ""

# Create datasites directory structure and syftignore file
echo "Creating datasites directory and syftignore file..."
DATASITES_DIR="${SYFTBOX_DATA_DIR}/datasites"
mkdir -p "$DATASITES_DIR"

cat > "${DATASITES_DIR}/syftignore" <<'EOF'
# Ignore spamming users
flower-test-group*@openmined.org
do-*-oc@openmined.org
*organic-coop@openmined.org
**/syft_agent
aggregator@openmined.org
dhingra.atul92@gmail.com
koen@openmined.org
zach@empire.email
kj@kj.dev
amita.j.shukla@gmail.com
nut.chukamphaeng@gmail.com
jajif89762@ofacer.com
tauquir@openmined.org
EOF

echo "✓ syftignore file created at ${DATASITES_DIR}/syftignore"
echo ""
echo "=== Setup Complete ==="
