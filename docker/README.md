# Docker Deployment Guide - RDS Dashboard

## Overview

This directory contains production-ready Docker deployment for the RDS Dashboard with integrated SyftBox client. The setup uses a **multi-stage build** for optimized image size and security.

### Architecture

```
┌─────────────────────────────────────────┐
│  Docker Container (Port 8000)           │
│  ┌───────────────────────────────────┐  │
│  │  Supervisord (Process Manager)    │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ 1. setup-syftbox.sh         │  │  │
│  │  │    - Validates ENV vars     │  │  │
│  │  │    - Generates config.json  │  │  │
│  │  └─────────────────────────────┘  │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ 2. SyftBox Client           │  │  │
│  │  │    - Syncs with network     │  │  │
│  │  │    - Manages data in        │  │  │
│  │  │      /SyftBox directory     │  │  │
│  │  └─────────────────────────────┘  │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ 3. FastAPI Backend          │  │  │
│  │  │    - REST API (/api/v1/*)   │  │  │
│  │  │    - Serves static frontend │  │  │
│  │  │      (React from /out)      │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Why Single Port?

In production mode:
1. **Frontend** is built as static files → `frontend/out/`
2. **Backend** serves these static files (no separate Node.js server needed)
3. Frontend JavaScript makes API calls to **same origin**
4. **Only port 8000 exposed** - simplifies networking and firewalls

---

## Quick Start

### Prerequisites

- Docker 20.10+ (with BuildKit support)
- `SYFTBOX_EMAIL` and `SYFTBOX_REFRESH_TOKEN` from your SyftBox account

### Get Your Refresh Token

```bash
# On your local machine with SyftBox installed:
cat ~/.syftbox/config.json | jq -r '.refresh_token'
```

### Run Container

```bash
docker run -d \
  --name rds-dashboard \
  -e SYFTBOX_EMAIL=your@email.com \
  -e SYFTBOX_REFRESH_TOKEN=<your_token_here> \
  -p 8000:8000 \
  openmined/rds-dashboard:latest

# Access dashboard
open http://localhost:8000
```

---

## Building the Image

### Standard Build (AMD64)

```bash
docker build \
  -f docker/Dockerfile.rds-dashboard-do \
  -t rds-dashboard:latest \
  .
```


### Build with Args

```bash
# Override SyftBox version
docker build \
  -f docker/Dockerfile.rds-dashboard-do \
  --build-arg SYFTBOX_VERSION=0.9.0 \
  -t rds-dashboard:custom \
  .

# Override multiple arguments
docker build \
  -f docker/Dockerfile.rds-dashboard-do \
  --build-arg SYFTBOX_VERSION=0.9.0 \
  --build-arg PYTHON_VERSION=3.11 \
  -t rds-dashboard:custom \
  .
```

**Available build arguments:**
- `SYFTBOX_VERSION` - SyftBox client version (default: `0.8.7`)
- `PYTHON_VERSION` - Python base image version (default: `3.12.8`)
- `APP_VERSION` - RDS Dashboard version (default: `0.1.0`)
- `APP_USER` - Container user name (default: `syftboxuser`)
- `APP_UID` - Container user ID (default: `1000`)

### Multi-Architecture Build

```bash
# Build for both AMD64 and ARM64 (Apple Silicon, ARM servers)
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f docker/Dockerfile.rds-dashboard-do \
  -t rds-dashboard:latest \
  .
```

### Build Arguments

You can customize the build with these arguments:

```bash
docker build \
  -f docker/Dockerfile.rds-dashboard-do \
  --build-arg PYTHON_VERSION=3.12.8 \
  --build-arg SYFTBOX_VERSION=0.8.7 \
  -t rds-dashboard:custom \
  .
```

| Argument | Default | Description |
|----------|---------|-------------|
| `PYTHON_VERSION` | `3.12.8` | Python base image version |
| `SYFTBOX_VERSION` | `0.8.7` | SyftBox client release version |
| `APP_VERSION` | `0.1.0` | RDS Dashboard version (OCI label) |
| `APP_USER` | `syftboxuser` | Container user (non-root) |
| `APP_UID` | `1000` | Container user ID |

**Note:** syft-rds is installed from PyPI via `pyproject.toml` (currently `syft-rds==0.5.0`). To use a different version, update `pyproject.toml` before building.

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `SYFTBOX_EMAIL` | Your SyftBox account email | `user@example.com` |
| `SYFTBOX_REFRESH_TOKEN` | JWT authentication token (no interactive login needed) | `eyJhbGc...` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `SYFTBOX_SERVER` | `https://syftbox.net` | SyftBox server URL |
| `DEBUG` | `false` | Enable verbose logging (`true`/`false`) |
| `FORCE_OVERWRITE` | `false` | Regenerate config on restart (`true`/`false`) |

---

## Usage Examples

### Production Deployment

```bash
docker run -d \
  --name rds-dashboard \
  --restart unless-stopped \
  -e SYFTBOX_EMAIL=production@company.com \
  -e SYFTBOX_REFRESH_TOKEN=<prod_token> \
  -p 8000:8000 \
  -v syftbox-data:/home/syftboxuser/SyftBox \
  -v syftbox-config:/home/syftboxuser/.syftbox \
  rds-dashboard:latest
```

**Key points:**
- `--restart unless-stopped`: Auto-restart on failure
- `-v` volumes: Persist data across container restarts
- Port `8000`: Single port for both frontend and API

### Debug Mode

```bash
docker run -d \
  --name rds-dashboard-debug \
  -e DEBUG=true \
  -e SYFTBOX_EMAIL=debug@example.com \
  -e SYFTBOX_REFRESH_TOKEN=<token> \
  -p 8000:8000 \
  rds-dashboard:latest

# View verbose logs
docker logs -f rds-dashboard-debug
```

**What DEBUG=true enables:**
- Shell script execution traces (`set -x`)
- Detailed startup logging
- FastAPI debug mode (verbose error messages)
- All processes show command-by-command execution

### Using Environment File

Create `.env` file:
```bash
# .env
SYFTBOX_EMAIL=user@example.com
SYFTBOX_REFRESH_TOKEN=eyJhbGc...
SYFTBOX_SERVER=https://syftbox.net
DEBUG=false
```

Run with env file:
```bash
docker run -d \
  --name rds-dashboard \
  --env-file .env \
  -p 8000:8000 \
  rds-dashboard:latest
```

### Multi-Account Deployment

Run multiple instances for different SyftBox accounts:

```bash
# Account 1 on port 8001
docker run -d \
  --name rds-account1 \
  --env-file .env.account1 \
  -p 8001:8000 \
  -v account1-data:/home/syftboxuser/SyftBox \
  rds-dashboard:latest

# Account 2 on port 8002
docker run -d \
  --name rds-account2 \
  --env-file .env.account2 \
  -p 8002:8000 \
  -v account2-data:/home/syftboxuser/SyftBox \
  rds-dashboard:latest

# Account 3 on port 8003
docker run -d \
  --name rds-account3 \
  --env-file .env.account3 \
  -p 8003:8000 \
  -v account3-data:/home/syftboxuser/SyftBox \
  rds-dashboard:latest
```

**Access:**
- Account 1: http://localhost:8001
- Account 2: http://localhost:8002
- Account 3: http://localhost:8003

---

## Common Commands

### View Logs

```bash
# Follow logs
docker logs -f rds-dashboard

# Last 100 lines
docker logs --tail 100 rds-dashboard

# Logs since 1 hour ago
docker logs --since 1h rds-dashboard
```

### Restart Container

```bash
docker restart rds-dashboard
```

### Stop and Remove

```bash
docker stop rds-dashboard
docker rm rds-dashboard
```

### Shell Access (Debugging)

```bash
# Interactive shell
docker exec -it rds-dashboard bash

# Run specific command
docker exec rds-dashboard ls -la /home/syftboxuser/.syftbox
```

### Inspect Container

```bash
# View container details
docker inspect rds-dashboard

# Check resource usage
docker stats rds-dashboard
```

---

## Data Persistence

### Important Directories

| Directory | Purpose | Should Persist? |
|-----------|---------|-----------------|
| `/home/syftboxuser/SyftBox` | Synced data from SyftBox network | ✅ Yes (use volume) |
| `/home/syftboxuser/.syftbox` | Config and credentials | ✅ Yes (use volume) |

### Using Volumes

**Named volumes (recommended):**
```bash
docker run -d \
  -v syftbox-data:/home/syftboxuser/SyftBox \
  -v syftbox-config:/home/syftboxuser/.syftbox \
  ...
```

**Bind mounts (for development):**
```bash
docker run -d \
  -v /path/on/host/data:/home/syftboxuser/SyftBox \
  -v /path/on/host/config:/home/syftboxuser/.syftbox \
  ...
```

### Backup Data

```bash
# Backup volumes
docker run --rm \
  -v syftbox-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/syftbox-backup.tar.gz -C /data .

# Restore volumes
docker run --rm \
  -v syftbox-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/syftbox-backup.tar.gz -C /data
```

---

## Troubleshooting

### Container Exits Immediately

**Symptom:** Container starts and immediately stops

**Cause:** Missing environment variables

**Solution:**
```bash
# Check logs
docker logs rds-dashboard

# Look for error messages like:
# ❌ ERROR: Missing required environment variables
# Required: SYFTBOX_EMAIL, SYFTBOX_REFRESH_TOKEN

# Fix: Provide required ENV vars
docker run -e SYFTBOX_EMAIL=... -e SYFTBOX_REFRESH_TOKEN=... ...
```

### Config Already Exists Error

**Symptom:** Setup skips config generation

**Solution 1:** Let it use existing config (normal behavior on restart)

**Solution 2:** Force regeneration
```bash
docker run -e FORCE_OVERWRITE=true ...
```

### Port Already in Use

**Symptom:** `Error starting userland proxy: listen tcp4 0.0.0.0:8000: bind: address already in use`

**Solution:**
```bash
# Find what's using port 8000
lsof -i :8000

# Option 1: Stop the other service
# Option 2: Use different port
docker run -p 8001:8000 ...  # Maps host 8001 to container 8000
```

### SyftBox Client Won't Connect

**Symptom:** Logs show connection errors

**Debug steps:**
```bash
# 1. Enable debug mode
docker run -e DEBUG=true ...

# 2. Check config.json was created correctly
docker exec rds-dashboard cat /home/syftboxuser/.syftbox/config.json

# 3. Verify token is valid
# - Token should be 100+ characters
# - Check token wasn't truncated

# 4. Check server URL
docker exec rds-dashboard env | grep SYFTBOX_SERVER
```

### Permission Denied Errors

**Symptom:** Permission errors in logs, especially when uploading datasets

**Cause:** File ownership mismatch between host-mounted directories and container user (UID 1000)

**Common scenarios:**
1. Uploading datasets fails with "Permission denied writing to .syftbox directory"
2. Container starts but datasets can't be created
3. Logs show: `PermissionError: [Errno 13] Permission denied: '.../.syftbox/private_datasets/...'`

**Solution (choose one):**

**Option 1: Use named volumes (RECOMMENDED for production)**
```bash
# Let Docker manage directory ownership automatically
docker run -d \
  -v syftbox-data:/home/syftboxuser/SyftBox \
  -v syftbox-config:/home/syftboxuser/.syftbox \
  ...
```
✅ Pros: Docker handles permissions automatically, no manual intervention
⚠️ Cons: Data stored in Docker-managed volumes (not directly accessible on host)

**Option 2: Fix host directory ownership (for bind mounts)**
```bash
# Change ownership to match container UID (1000)
sudo chown -R 1000:1000 ~/.syftbox
sudo chown -R 1000:1000 ~/SyftBox

# Then run with bind mount
docker run -d \
  -v ~/SyftBox:/home/syftboxuser/SyftBox \
  -v ~/.syftbox:/home/syftboxuser/.syftbox \
  ...
```
✅ Pros: Can access files directly on host
⚠️ Cons: Requires sudo, changes host file ownership

**Option 3: Build with matching UID (advanced)**
```bash
# Build container with your host user ID
docker build \
  -f docker/Dockerfile.rds-dashboard-do \
  --build-arg APP_UID=$(id -u) \
  -t rds-dashboard:custom \
  .

# Run with your UID
docker run -d -v ~/.syftbox:/home/syftboxuser/.syftbox ...
```
✅ Pros: Container user matches your host user
⚠️ Cons: Non-standard setup, image not portable across users

**Verify the fix:**
```bash
# 1. Check container user ID
docker exec rds-dashboard id
# Should show: uid=1000(syftboxuser) gid=1000(syftboxuser)

# 2. Check directory ownership
docker exec rds-dashboard ls -la /home/syftboxuser/.syftbox
# Should be owned by syftboxuser:syftboxuser

# 3. Test write access
docker exec rds-dashboard touch /home/syftboxuser/.syftbox/test_write
# Should succeed without error

# 4. Check private_datasets directory exists and is writable
docker exec rds-dashboard ls -la /home/syftboxuser/.syftbox/private_datasets
# Should exist and be owned by syftboxuser
```

### Health Check Failing

**Symptom:** Container marked as unhealthy

**Check:**
```bash
# View health status
docker inspect rds-dashboard | jq '.[0].State.Health'

# Test health endpoint manually
docker exec rds-dashboard curl -f http://localhost:8000/api/health
```

---

## Advanced Configuration

### Custom Supervisord Config

To modify service startup behavior:

1. Copy `scripts/supervisord.conf` to your host
2. Modify as needed
3. Mount it:
```bash
docker run -v /path/to/supervisord.conf:/app/scripts/supervisord.conf ...
```

### Resource Limits

Limit container resources:

```bash
docker run -d \
  --name rds-dashboard \
  --memory=2g \
  --cpus=2 \
  -e SYFTBOX_EMAIL=... \
  -e SYFTBOX_REFRESH_TOKEN=... \
  -p 8000:8000 \
  rds-dashboard:latest
```

### Health Check Configuration

The container includes a built-in health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1
```

Check health status:
```bash
docker ps  # Shows health status in STATUS column
docker inspect rds-dashboard | jq '.[0].State.Health'
```
<!--
---

## Docker Compose

Example `docker-compose.yml`:

```yaml
version: '3.8'

services:
  rds-dashboard:
    image: rds-dashboard:latest
    container_name: rds-dashboard
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - SYFTBOX_EMAIL=${SYFTBOX_EMAIL}
      - SYFTBOX_REFRESH_TOKEN=${SYFTBOX_REFRESH_TOKEN}
      - SYFTBOX_SERVER=https://syftbox.net
      - DEBUG=false
    volumes:
      - syftbox-data:/home/syftboxuser/SyftBox
      - syftbox-config:/home/syftboxuser/.syftbox
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  syftbox-data:
  syftbox-config:
```

Usage:
```bash
# Create .env file with credentials
echo "SYFTBOX_EMAIL=your@email.com" > .env
echo "SYFTBOX_REFRESH_TOKEN=your_token" >> .env

# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## Kubernetes Deployment

Example Kubernetes manifests:

### ConfigMap (for non-sensitive config)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: rds-dashboard-config
data:
  SYFTBOX_SERVER: "https://syftbox.net"
  DEBUG: "false"
```

### Secret (for credentials)

```bash
# Create secret from literals
kubectl create secret generic rds-dashboard-secret \
  --from-literal=SYFTBOX_EMAIL='your@email.com' \
  --from-literal=SYFTBOX_REFRESH_TOKEN='your_token'
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rds-dashboard
spec:
  replicas: 1
  selector:
    matchLabels:
      app: rds-dashboard
  template:
    metadata:
      labels:
        app: rds-dashboard
    spec:
      containers:
      - name: rds-dashboard
        image: rds-dashboard:latest
        ports:
        - containerPort: 8000
        env:
        - name: SYFTBOX_EMAIL
          valueFrom:
            secretKeyRef:
              name: rds-dashboard-secret
              key: SYFTBOX_EMAIL
        - name: SYFTBOX_REFRESH_TOKEN
          valueFrom:
            secretKeyRef:
              name: rds-dashboard-secret
              key: SYFTBOX_REFRESH_TOKEN
        envFrom:
        - configMapRef:
            name: rds-dashboard-config
        volumeMounts:
        - name: syftbox-data
          mountPath: /home/syftboxuser/SyftBox
        - name: syftbox-config
          mountPath: /home/syftboxuser/.syftbox
        livenessProbe:
          httpGet:
            path: /api/health
            port: 8000
          initialDelaySeconds: 40
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
      volumes:
      - name: syftbox-data
        persistentVolumeClaim:
          claimName: syftbox-data-pvc
      - name: syftbox-config
        persistentVolumeClaim:
          claimName: syftbox-config-pvc
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: rds-dashboard
spec:
  selector:
    app: rds-dashboard
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
  type: LoadBalancer
```

---

## Security Considerations

### Non-Root User

The container runs as `syftboxuser` (UID 1000), not root. This is a security best practice.

### Sensitive Data

- **Refresh token** is stored in `/home/syftboxuser/.syftbox/config.json` with `600` permissions (readable only by owner)
- **Environment variables** are visible in container inspect - use secrets management in production
- **Volumes** should have proper backup and encryption in production

### Network Security

In production:
- Use HTTPS reverse proxy (nginx, traefik)
- Enable authentication/authorization
- Restrict network access with firewalls
- Consider using private Docker registries

---

## Performance Tips

1. **Use volumes for data** - Much faster than bind mounts
2. **Allocate sufficient memory** - Recommend 2GB for production
3. **Multi-stage build** - Already optimized (image ~500-600MB vs ~1.5GB)
4. **Health checks** - Already configured for orchestrators

--- -->

## Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| Build | `docker build ...` | Multi-arch buildx |
| Debug | `DEBUG=true` | `DEBUG=false` |
| Restart | Manual | `--restart unless-stopped` |
| Volumes | Bind mounts | Named volumes |
| Secrets | `.env` file | Secrets manager (Kubernetes, AWS) |
| Logs | `docker logs` | Centralized logging (ELK, Splunk) |
| Monitoring | Manual | Prometheus, Grafana |

---

## Build Optimizations

The Dockerfile uses several optimizations:

1. **Multi-stage build**
   - Stage 1: Frontend builder (bun)
   - Stage 2: Python builder (uv)
   - Stage 3: Production runtime (minimal)

2. **Layer caching**
   - Dependencies copied before source code
   - Rebuilds are fast when only code changes

3. **Image size**
   - Build tools removed from production
   - ~60-70% smaller than single-stage build

4. **Security**
   - Pinned base image versions
   - Non-root user
   - Minimal attack surface

---

## References

- **Dockerfile**: `docker/Dockerfile.rds-dashboard-do`
- **Scripts**: `scripts/`
  - `entrypoint.sh` - Container initialization
  - `setup-syftbox.sh` - Config generation
  - `supervisord.conf` - Process management
- **SyftBox**: https://github.com/OpenMined/syftbox

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/OpenMined/rds-dashboard/issues
- Join our Slack: https://openmined.org/get-involved/

