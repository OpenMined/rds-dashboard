# RDS Dashboard

Containerized dashboard for managing remote data science (RDS) workflows with integrated SyftBox client.

## Quick Start

**Pull the image:**
```bash
docker pull openmined/rds-dashboard:latest
```

**1. Install SyftBox and get your credentials**

```bash
# Install SyftBox (choose "no" when prompted to run client)
curl -fsSL https://syftbox.net/install.sh | sh

# Login and get your refresh token
syftbox login
cat ~/.syftbox/config.json | jq -r '.refresh_token'
```

**2. Run the dashboard**

```bash
docker run -d \
  --name rds-dashboard \
  -v ~/.syftbox:/home/syftboxuser/.syftbox \
  -e SYFTBOX_EMAIL=your@email.com \
  -e SYFTBOX_REFRESH_TOKEN=your_token \
  -p 8000:8000 \
  openmined/rds-dashboard:latest
```

**3. Access the dashboard**

Open http://localhost:8000

## Important Notes

⚠️ **Config Management**: The container temporarily renames your `~/.syftbox/config.json` to `config.json.host_original` while running. This preserves your crypto identity while using container-specific paths.

**To restore your host config after stopping the container:**
```bash
mv ~/.syftbox/config.json.host_original ~/.syftbox/config.json
```

This is only needed if you want to run SyftBox locally on your host machine between container runs.

## What's Inside

- ✅ **SyftBox Client**: Syncs data with the SyftBox network
- ✅ **FastAPI Backend**: REST API for managing RDS datasets and jobs
- ✅ **React Frontend**: Interactive dashboard UI
- ✅ **Multi-arch Support**: Works on AMD64 and ARM64 (Apple Silicon)

## Key Features

- **Single-port deployment** (8000) - Frontend and API on same port
- **Automatic SyftBox setup** - No manual configuration needed
- **Persistent identity** - Reuses your crypto keys across runs
- **Shared directories** - `logs/`, `rds/`, `private_datasets/` accessible from host
- **Multi-account support** - Run multiple instances with different SyftBox accounts

## Environment Variables

### Required
- `SYFTBOX_EMAIL` - Your SyftBox account email
- `SYFTBOX_REFRESH_TOKEN` - JWT authentication token (from `~/.syftbox/config.json`)

### Optional
- `SYFTBOX_SERVER` - SyftBox server URL (default: `https://syftbox.net`)
- `DEBUG` - Enable verbose logging (`true`/`false`, default: `false`)
- `API_PORT` - API port (default: `8000`)

## Advanced Usage

### Custom Port
```bash
docker run -d \
  -e API_PORT=9000 \
  -p 9000:9000 \
  openmined/rds-dashboard:latest
```

### Debug Mode
```bash
docker run -d \
  -e DEBUG=true \
  openmined/rds-dashboard:latest

# View logs
docker logs -f rds-dashboard
```

### Multiple Accounts
```bash
# Account 1 on port 8001
docker run -d --name rds-account1 \
  -v ~/.syftbox-account1:/home/syftboxuser/.syftbox \
  -e SYFTBOX_EMAIL=account1@example.com \
  -e SYFTBOX_REFRESH_TOKEN=token1 \
  -p 8001:8000 \
  openmined/rds-dashboard:latest

# Account 2 on port 8002
docker run -d --name rds-account2 \
  -v ~/.syftbox-account2:/home/syftboxuser/.syftbox \
  -e SYFTBOX_EMAIL=account2@example.com \
  -e SYFTBOX_REFRESH_TOKEN=token2 \
  -p 8002:8000 \
  openmined/rds-dashboard:latest
```

## Documentation

- 📖 **Full documentation**: [GitHub Repository](https://github.com/OpenMined/rds-dashboard)
- 🐛 **Report issues**: [GitHub Issues](https://github.com/OpenMined/rds-dashboard/issues)
- 💬 **Community**: [OpenMined Slack](https://slack.openmined.org)

## Version Tags

- `latest` - Latest stable release
- `v0.1.1`, `v0.1`, `v0` - Semantic versioning (use specific versions in production)
- Multi-arch: `linux/amd64`, `linux/arm64`

## Health Check

The container includes a built-in health check:
```bash
# Check container health
docker inspect rds-dashboard | jq '.[0].State.Health'

# Manual health check
curl http://localhost:8000/api/health
```

## Support

For questions or issues:
- GitHub: https://github.com/OpenMined/rds-dashboard/issues
- Slack: https://slack.openmined.org
