#!/bin/bash
set -e

# Enable debug mode if requested
# `set -x` to print each command before executing it
[ "${DEBUG:-false}" = "true" ] && set -x

# Configuration paths
# Use $HOME to support any APP_USER setting (not hardcoded to syftboxuser)
SYFTBOX_HOME="${HOME}"
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
if [ -f "$CONFIG_FILE" ]; then
    # Read existing data_dir from config
    EXISTING_DATA_DIR=$(jq -r '.data_dir' "$CONFIG_FILE" 2>/dev/null || echo "")

    # Detect if this is a mounted host .syftbox directory
    # Indicators: hash directory exists AND data_dir points to host path (not container path)
    HASH_DIR=$(ls -1 "$SYFTBOX_CONFIG_DIR" 2>/dev/null | grep -E '^[a-f0-9]{8}$' | head -1)

    # Check if data_dir points to a different path than container expects
    if [ -n "$EXISTING_DATA_DIR" ] && [ "$EXISTING_DATA_DIR" != "$SYFTBOX_DATA_DIR" ]; then
        echo "⚠️  Config file exists with different data_dir path"
        echo "  Current: $EXISTING_DATA_DIR"
        echo "  Expected: $SYFTBOX_DATA_DIR"
        echo ""

        # If hash directory exists, this is a mounted host .syftbox directory
        if [ -n "$HASH_DIR" ]; then
            echo "✓ Detected mounted host .syftbox directory (found identity: $HASH_DIR)"
            echo "  Preserving host config by renaming temporarily..."
            echo ""

            # Rename host config to keep it safe
            HOST_CONFIG_BACKUP="${CONFIG_FILE}.host_original"
            mv "$CONFIG_FILE" "$HOST_CONFIG_BACKUP"

            echo "  ✓ Host config renamed: config.json → config.json.host_original"
            echo "  ✓ Container will use its own config.json (generated below)"
            echo "  ✓ Crypto identity preserved: $HASH_DIR"
            echo "  ✓ Shared directories: logs/, rds/, private_datasets/"
            echo ""
            echo "  📌 Important: To restore your host config after stopping container:"
            echo "     mv ~/.syftbox/config.json.host_original ~/.syftbox/config.json"
            echo ""

            # Generate fresh config for container (will happen below)
            echo "Generating container-specific config.json..."
        else
            echo "Updating data_dir to container path..."

            # Update only the data_dir field, preserve everything else
            jq --arg datadir "$SYFTBOX_DATA_DIR" '.data_dir = $datadir' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp"

            if [ $? -eq 0 ]; then
                mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
                chmod 600 "$CONFIG_FILE"
                echo "✓ Config updated: data_dir = $SYFTBOX_DATA_DIR"
            else
                rm -f "${CONFIG_FILE}.tmp"
                error_exit "Failed to update config.json"
            fi

            echo "=== Setup Complete (config path corrected) ==="
            exit 0
        fi
    elif [ "${FORCE_OVERWRITE:-false}" != "true" ]; then
        echo "⚠️  Config file already exists at $CONFIG_FILE"
        echo "Skipping config generation (set FORCE_OVERWRITE=true to override)"
        echo "=== Setup Complete (using existing config) ==="
        exit 0
    fi
fi

echo "Generating SyftBox config.json..."
echo "  Email: $SYFTBOX_EMAIL"
echo "  Server: $SYFTBOX_SERVER"
echo "  Data dir: $SYFTBOX_DATA_DIR"

# Create config directory and logs directory
mkdir -p "$SYFTBOX_CONFIG_DIR"
mkdir -p "${SYFTBOX_CONFIG_DIR}/logs"

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
# SyftBox Ignore Patterns
# ========================
# This file controls which datasites and paths are excluded during sync.
# Patterns follow gitignore-style syntax with SyftBox-specific extensions.
#
# Pattern Syntax:
#   user@example.com          - Ignore specific user's datasite
#   *@blocked.org             - Ignore entire domain
#   spam-*@example.com        - Wildcard matching (prefix)
#   **/temp_*                 - Ignore paths matching pattern
#   directory/subdirectory    - Ignore specific path
#
# Examples:
#   # Block specific spam accounts
#   # spammer@example.com
#   # suspicious-bot@example.org
#
#   # Block entire organization
#   # *@spam-domain.com
#
#   # Ignore test/dev accounts
#   # test-*@example.com
#   # dev-*@example.com
#
#   # Ignore specific directories
#   # **/temp
#   # **/cache
#   # **/test_data
#
# Usage:
#   1. Uncomment patterns you need (remove leading #)
#   2. Add your own patterns below
#   3. Restart SyftBox client to apply changes
#
# To add patterns at runtime:
#   docker exec <container> bash -c 'echo "user@example.com" >> ~/SyftBox/datasites/syftignore'
#
# To mount custom syftignore:
#   docker run -v /path/to/syftignore:$HOME/SyftBox/datasites/syftignore ...
#
# Your custom patterns (add below this line):
# -----------------------------------------------

EOF

echo "✓ syftignore file created at ${DATASITES_DIR}/syftignore"
echo ""
echo "=== Setup Complete ==="
