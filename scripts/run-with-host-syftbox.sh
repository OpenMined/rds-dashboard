#!/bin/bash
# Helper script to run RDS Dashboard with existing SyftBox configuration
# This mounts all files/directories from ~/.syftbox EXCEPT config.json
# The container will generate its own config.json with container-appropriate paths

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== RDS Dashboard - Run with Host SyftBox ===${NC}"
echo ""

# Configuration
SYFTBOX_HOST_DIR="${HOME}/.syftbox"
SYFTBOX_DATA_HOST_DIR="${HOME}/SyftBox"
DOCKER_IMAGE="${DOCKER_IMAGE:-openmined/rds-dashboard:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-rds-dashboard}"

# Check if .syftbox directory exists
if [ ! -d "$SYFTBOX_HOST_DIR" ]; then
    echo -e "${RED}✗ SyftBox directory not found: $SYFTBOX_HOST_DIR${NC}"
    echo ""
    echo "Please ensure SyftBox is installed and configured first."
    echo "To run without existing SyftBox:"
    echo "  docker run -d -e SYFTBOX_EMAIL=... -e SYFTBOX_REFRESH_TOKEN=... -p 8000:8000 $DOCKER_IMAGE"
    exit 1
fi

# Get credentials from environment or prompt
if [ -z "$SYFTBOX_EMAIL" ]; then
    # Try to read from host config
    if [ -f "$SYFTBOX_HOST_DIR/config.json" ]; then
        SYFTBOX_EMAIL=$(jq -r '.email' "$SYFTBOX_HOST_DIR/config.json" 2>/dev/null || echo "")
    fi

    if [ -z "$SYFTBOX_EMAIL" ]; then
        echo -e "${YELLOW}SYFTBOX_EMAIL not set${NC}"
        read -p "Enter your SyftBox email: " SYFTBOX_EMAIL
    else
        echo "Using email from host config: $SYFTBOX_EMAIL"
    fi
fi

if [ -z "$SYFTBOX_REFRESH_TOKEN" ]; then
    # Try to read from host config
    if [ -f "$SYFTBOX_HOST_DIR/config.json" ]; then
        SYFTBOX_REFRESH_TOKEN=$(jq -r '.refresh_token' "$SYFTBOX_HOST_DIR/config.json" 2>/dev/null || echo "")
    fi

    if [ -z "$SYFTBOX_REFRESH_TOKEN" ]; then
        echo -e "${YELLOW}SYFTBOX_REFRESH_TOKEN not set${NC}"
        echo "Get your refresh token from: cat ~/.syftbox/config.json | jq -r '.refresh_token'"
        read -p "Enter your refresh token: " SYFTBOX_REFRESH_TOKEN
    else
        echo "Using refresh token from host config"
    fi
fi

# Validate required variables
if [ -z "$SYFTBOX_EMAIL" ] || [ -z "$SYFTBOX_REFRESH_TOKEN" ]; then
    echo -e "${RED}✗ Missing required credentials${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Building Docker mount arguments...${NC}"
echo "Scanning: $SYFTBOX_HOST_DIR"
echo ""

# Build mount arguments for all items except config.json
MOUNT_ARGS=""
MOUNTED_ITEMS=0
SKIPPED_ITEMS=0

for item in "$SYFTBOX_HOST_DIR"/*; do
    if [ ! -e "$item" ]; then
        continue  # Skip if glob didn't match anything
    fi

    basename=$(basename "$item")

    # Skip config.json - container will generate its own
    if [ "$basename" = "config.json" ]; then
        echo "  ⊗ Skipping: $basename (container will generate its own)"
        SKIPPED_ITEMS=$((SKIPPED_ITEMS + 1))
        continue
    fi

    # Determine if read-only mount is appropriate
    MOUNT_OPTS=""
    if [ "$basename" = "private_key" ] || [ "$basename" = "public_key.pem" ]; then
        MOUNT_OPTS=":ro"
        echo "  ✓ Mounting: $basename (read-only)"
    else
        echo "  ✓ Mounting: $basename"
    fi

    MOUNT_ARGS="$MOUNT_ARGS -v $item:/home/syftboxuser/.syftbox/$basename$MOUNT_OPTS"
    MOUNTED_ITEMS=$((MOUNTED_ITEMS + 1))
done

# Also mount SyftBox data directory if it exists
if [ -d "$SYFTBOX_DATA_HOST_DIR" ]; then
    MOUNT_ARGS="$MOUNT_ARGS -v $SYFTBOX_DATA_HOST_DIR:/home/syftboxuser/SyftBox"
    echo "  ✓ Mounting: SyftBox data directory"
    MOUNTED_ITEMS=$((MOUNTED_ITEMS + 1))
fi

echo ""
echo -e "${GREEN}Summary:${NC}"
echo "  Mounted: $MOUNTED_ITEMS items"
echo "  Skipped: $SKIPPED_ITEMS items"
echo ""

# Check if container already exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${YELLOW}⚠ Container '$CONTAINER_NAME' already exists${NC}"
    read -p "Remove and recreate? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Removing existing container..."
        docker rm -f "$CONTAINER_NAME"
    else
        echo "Exiting. Use a different CONTAINER_NAME or remove the existing container."
        exit 1
    fi
fi

# Run the container
echo -e "${GREEN}Starting RDS Dashboard...${NC}"
echo "Container name: $CONTAINER_NAME"
echo "Image: $DOCKER_IMAGE"
echo "Port: 8000"
echo ""

docker run -d \
  --name "$CONTAINER_NAME" \
  $MOUNT_ARGS \
  -e SYFTBOX_EMAIL="$SYFTBOX_EMAIL" \
  -e SYFTBOX_REFRESH_TOKEN="$SYFTBOX_REFRESH_TOKEN" \
  -e SYFTBOX_SERVER="${SYFTBOX_SERVER:-https://syftbox.net}" \
  -e DEBUG="${DEBUG:-false}" \
  -p 8000:8000 \
  "$DOCKER_IMAGE"

# Wait a moment for container to start
sleep 2

# Check if container is running
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${GREEN}✓ Container started successfully!${NC}"
    echo ""
    echo "Access the dashboard at: http://localhost:8000"
    echo ""
    echo "Useful commands:"
    echo "  View logs:     docker logs -f $CONTAINER_NAME"
    echo "  Stop:          docker stop $CONTAINER_NAME"
    echo "  Restart:       docker restart $CONTAINER_NAME"
    echo "  Remove:        docker rm -f $CONTAINER_NAME"
    echo "  Shell access:  docker exec -it $CONTAINER_NAME bash"
else
    echo -e "${RED}✗ Container failed to start${NC}"
    echo ""
    echo "Check logs with: docker logs $CONTAINER_NAME"
    exit 1
fi
