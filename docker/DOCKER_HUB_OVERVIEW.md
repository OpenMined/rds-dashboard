# RDS Dashboard

Containerized dashboard for managing remote data science (RDS) workflows with integrated SyftBox client.

## Quick Start
First install SyftBox. When prompted to run the client, choose `no`
```bash
curl -fsSL https://syftbox.net/install.sh | sh
```

In a terminal, login and get your refresh token (please don't share it with anyone)
```bash
syftbox login
cat ~/.syftbox/config.json | jq -r '.refresh_token'
```

Pull and run the `rds-dashboard` container
```bash
# Pull the image
docker pull openmined/rds-dashboard:latest

# Run the container
docker run -d \
  --name rds-dashboard \
  -v ~/.syftbox:/home/syftboxuser/.syftbox \
  -e SYFTBOX_EMAIL=your@email.com \
  -e SYFTBOX_REFRESH_TOKEN=your_token \
  -p 8000:8000 \
  openmined/rds-dashboard:latest
```

Access the dashboard at `http://localhost:8000`

## What's Inside

- **SyftBox Client**: Syncs data with the SyftBox network
- **FastAPI Backend**: REST API for managing RDS datasets and jobs
- **React Frontend**: Interactive dashboard UI
- **Multi-arch Support**: Works on AMD64 and ARM64 (Apple Silicon)

## Key Features

✅ Single-port deployment (8000)
✅ Automatic SyftBox setup
✅ Persistent identity and data
✅ Multi-account support

## Documentation

📖 **Full documentation**: [GitHub Repository](https://github.com/OpenMined/rds-dashboard)
🐛 **Issues**: [Report bugs](https://github.com/OpenMined/rds-dashboard/issues)
💬 **Community**: [Join Slack](https://openmined.org/get-involved/)

## Tags

- `latest` - Latest stable release
- `v0.1.0` - Specific version (semantic versioning)
- `v0.1` - Minor version series
- `v0` - Major version series
