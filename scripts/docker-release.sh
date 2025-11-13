#!/bin/bash
# Manual Docker Hub Release Script for RDS Dashboard
# Usage: ./scripts/docker-release.sh [VERSION]
# Example: ./scripts/docker-release.sh 0.1.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOCKER_IMAGE="openmined/rds-dashboard"
DOCKERFILE="docker/Dockerfile.rds-dashboard-do"
PLATFORMS="linux/amd64,linux/arm64"

# Get version from argument or pyproject.toml
if [ -n "$1" ]; then
    VERSION="$1"
else
    VERSION=$(grep '^version = ' pyproject.toml | sed 's/version = "\(.*\)"/\1/')
fi

echo -e "${GREEN}=== RDS Dashboard - Docker Hub Release ===${NC}"
echo "Version: ${VERSION}"
echo "Image: ${DOCKER_IMAGE}"
echo "Platforms: ${PLATFORMS}"
echo ""

# Parse version (e.g., 0.1.0 -> v0.1.0, v0.1, v0)
VERSION_FULL="v${VERSION}"
VERSION_MINOR="v$(echo ${VERSION} | cut -d. -f1,2)"
VERSION_MAJOR="v$(echo ${VERSION} | cut -d. -f1)"

echo -e "${YELLOW}Tags to be created:${NC}"
echo "  - ${DOCKER_IMAGE}:${VERSION_FULL}"
echo "  - ${DOCKER_IMAGE}:${VERSION_MINOR}"
echo "  - ${DOCKER_IMAGE}:${VERSION_MAJOR}"
echo "  - ${DOCKER_IMAGE}:latest"
echo ""

# Step 1: Pre-flight checks
echo -e "${GREEN}[1/8] Running pre-flight checks...${NC}"

# Check if frontend is built
if [ ! -f "frontend/out/index.html" ]; then
    echo -e "${RED}✗ Frontend build missing${NC}"
    echo "Please run: bun run --cwd frontend build"
    exit 1
fi
echo "✓ Frontend build exists"

# Check if buildx is available
if ! docker buildx version > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker buildx not available${NC}"
    echo "Please install Docker with buildx support"
    exit 1
fi
echo "✓ Docker buildx available"

# Check if logged in to Docker Hub
if [ -f ~/.docker/config.json ]; then
    echo "✓ Logged in to Docker Hub"
else
    echo -e "${YELLOW}⚠ Not logged in to Docker Hub${NC}"
    echo "Please run: docker login"
    exit 1
fi

# Check if builder exists, create if not
if ! docker buildx inspect multiarch-builder > /dev/null 2>&1; then
    echo "Creating multiarch builder..."
    docker buildx create --name multiarch-builder --use
    docker buildx inspect --bootstrap
else
    echo "✓ Using existing multiarch builder"
    docker buildx use multiarch-builder
fi

echo ""

# Step 2: Clean up old test images and containers (optional)
echo -e "${GREEN}[2/9] Cleanup${NC}"
if docker images | grep -q "${DOCKER_IMAGE}.*test"; then
    echo "Found existing test image"
    read -p "Remove old test image and containers? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Remove test containers
        docker ps -a --filter "ancestor=${DOCKER_IMAGE}:test" --format "{{.ID}}" | xargs -r docker rm -f 2>/dev/null || true
        # Remove test image
        docker rmi ${DOCKER_IMAGE}:test 2>/dev/null || true
        echo "✓ Cleanup complete"
    else
        echo "Skipping cleanup"
    fi
else
    echo "No existing test image found, skipping cleanup"
fi
echo ""

# Step 3: Build for local testing (single arch)
echo -e "${GREEN}[3/9] Building single-arch image for local testing...${NC}"
docker buildx build \
  --platform linux/amd64 \
  --file ${DOCKERFILE} \
  --tag ${DOCKER_IMAGE}:test \
  --load \
  .

echo -e "${GREEN}✓ Test image built: ${DOCKER_IMAGE}:test${NC}"
echo ""

# Step 4: Prompt for local testing
echo -e "${GREEN}[4/9] Local testing${NC}"
echo -e "${YELLOW}Before pushing to Docker Hub, please test the image locally:${NC}"
echo ""
echo "Option A: Test with existing SyftBox identity:"
echo "  docker run --rm -it \\"
echo "    -v ~/.syftbox:/home/syftboxuser/.syftbox \\"
echo "    -v ~/SyftBox:/home/syftboxuser/SyftBox \\"
echo "    -e SYFTBOX_EMAIL=your@email.com \\"
echo "    -e SYFTBOX_REFRESH_TOKEN=your_token \\"
echo "    -p 8000:8000 \\"
echo "    ${DOCKER_IMAGE}:test"
echo ""
echo "Option B: Test with fresh setup:"
echo "  docker run --rm -it \\"
echo "    -e SYFTBOX_EMAIL=your@email.com \\"
echo "    -e SYFTBOX_REFRESH_TOKEN=your_token \\"
echo "    -p 8000:8000 \\"
echo "    ${DOCKER_IMAGE}:test"
echo ""
echo "Then verify:"
echo "  - Health check: curl http://localhost:8000/api/health"
echo "  - Frontend: open http://localhost:8000"
echo ""
read -p "Have you tested the image? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Exiting. Please test the image before continuing.${NC}"
    exit 1
fi
echo ""

# Step 5: Show build plan
echo -e "${GREEN}[5/9] Build and Push Plan${NC}"
echo "This will:"
echo "  1. Build multi-arch images (amd64 + arm64)"
echo "  2. Push to Docker Hub with tags:"
echo "     - ${DOCKER_IMAGE}:${VERSION_FULL}"
echo "     - ${DOCKER_IMAGE}:${VERSION_MINOR}"
echo "     - ${DOCKER_IMAGE}:${VERSION_MAJOR}"
echo "     - ${DOCKER_IMAGE}:latest"
echo ""
read -p "Continue with push to Docker Hub? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Exiting. No images pushed.${NC}"
    exit 1
fi
echo ""

# Step 6: Build and push multi-arch images to Docker Hub
echo -e "${GREEN}[6/9] Building and pushing multi-arch images to Docker Hub...${NC}"
echo "Platforms: ${PLATFORMS}"
echo "Tags:"
echo "  - ${DOCKER_IMAGE}:${VERSION_FULL}"
echo "  - ${DOCKER_IMAGE}:${VERSION_MINOR}"
echo "  - ${DOCKER_IMAGE}:${VERSION_MAJOR}"
echo "  - ${DOCKER_IMAGE}:latest"
echo ""
echo "Note: Multi-arch builds must push directly (cannot load locally)"
echo ""

docker buildx build \
  --platform ${PLATFORMS} \
  --file ${DOCKERFILE} \
  --tag ${DOCKER_IMAGE}:${VERSION_FULL} \
  --tag ${DOCKER_IMAGE}:${VERSION_MINOR} \
  --tag ${DOCKER_IMAGE}:${VERSION_MAJOR} \
  --tag ${DOCKER_IMAGE}:latest \
  --push \
  .

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Multi-arch images built and pushed successfully${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}✗ Failed to build and push images${NC}"
    echo "Common issues:"
    echo "  - Not logged in: docker logout && docker login"
    echo "  - No push permissions: Check Docker Hub repository permissions"
    echo "  - Repository doesn't exist or is private without proper plan"
    exit 1
fi

# Step 7: Verify images on Docker Hub
echo -e "${GREEN}[7/9] Verifying images on Docker Hub...${NC}"
echo "Waiting 5 seconds for Docker Hub to process..."
sleep 5

for tag in ${VERSION_FULL} ${VERSION_MINOR} ${VERSION_MAJOR} latest; do
    if docker manifest inspect ${DOCKER_IMAGE}:${tag} > /dev/null 2>&1; then
        echo "✓ ${DOCKER_IMAGE}:${tag}"
    else
        echo -e "${RED}✗ ${DOCKER_IMAGE}:${tag} not found${NC}"
    fi
done
echo ""

# Step 8: Test pulling from Docker Hub
echo -e "${GREEN}[8/9] Testing pull from Docker Hub...${NC}"
echo "Pulling latest tag..."
docker pull ${DOCKER_IMAGE}:latest --quiet
echo -e "${GREEN}✓ Successfully pulled from Docker Hub${NC}"
echo ""

# Summary and next steps
echo -e "${GREEN}Release Complete!${NC}"
echo ""
echo -e "${GREEN}✓ Images published:${NC}"
echo "  - ${DOCKER_IMAGE}:${VERSION_FULL}"
echo "  - ${DOCKER_IMAGE}:${VERSION_MINOR}"
echo "  - ${DOCKER_IMAGE}:${VERSION_MAJOR}"
echo "  - ${DOCKER_IMAGE}:latest"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Test the published image:"
echo "   docker run --rm -it -e SYFTBOX_EMAIL=... -e SYFTBOX_REFRESH_TOKEN=... -p 8000:8000 ${DOCKER_IMAGE}:${VERSION_FULL}"
echo ""
echo "2. Update Docker Hub repository page:"
echo "   https://hub.docker.com/r/${DOCKER_IMAGE}"
echo "   - Add description from docker/README.md"
echo "   - Link to GitHub repository"
echo ""
echo "3. Create Git tag (if not already created):"
echo "   git tag -a ${VERSION_FULL} -m \"Release ${VERSION_FULL}\""
echo "   git push origin ${VERSION_FULL}"
echo ""
echo "4. Update documentation with the new version"
echo ""
echo -e "${GREEN}Done!${NC}"
