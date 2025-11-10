# Docker Development Guide - RDS Dashboard

**Audience:** Developers and maintainers
**Companion Document:** [README.md](./README.md) (User-facing documentation)

This document explains the internal architecture, script execution flow, and development practices for the RDS Dashboard Docker setup.

---

## Table of Contents

- [Container Startup Flow](#container-startup-flow)
- [Script Execution Order](#script-execution-order)
- [Process Management](#process-management)
- [Timeline & Examples](#timeline--examples)
- [Shutdown & Restart Behavior](#shutdown--restart-behavior)
- [Debugging & Troubleshooting](#debugging--troubleshooting)
- [Development Workflow](#development-workflow)

---

## Container Startup Flow

### High-Level Architecture

```
Docker Run Command
      ↓
┌─────────────────────────────────────────────────────────────┐
│  ENTRYPOINT: scripts/entrypoint.sh                          │
│  - Validates environment variables                          │
│  - Exports variables for child processes                    │
│  - Creates log directories                                  │
│  - Replaces itself with supervisord (exec)                  │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│  CMD: supervisord -c scripts/supervisord.conf -n            │
│  - Reads configuration                                      │
│  - Launches programs by priority (low → high)               │
│  - Monitors processes                                       │
│  - Handles restarts and shutdowns                           │
└─────────────────────────────────────────────────────────────┘
      ↓
      ├─→ [Priority 1]  setup-syftbox.sh
      │                 - Creates config.json
      │                 - Creates syftignore template
      │                 - Runs once, then exits
      │
      ├─→ [Priority 10] syftbox client
      │                 - Reads config.json
      │                 - Syncs datasites
      │                 - Runs continuously
      │
      └─→ [Priority 20] rds-backend (uvicorn)
                        - Starts FastAPI server
                        - Serves API + static frontend
                        - Runs continuously
```

---

## Script Execution Order

### 1. entrypoint.sh (Container Initialization)

**File:** `scripts/entrypoint.sh`
**Execution:** Every container start
**PID:** Initially shell, then replaced by supervisord
**Duration:** ~0.5 seconds

#### Responsibilities

```bash
#!/bin/bash
set -e  # Exit on any error

# 1. Enable debug mode if requested
[ "${DEBUG:-false}" = "true" ] && set -x

# 2. Print startup information
echo "=== RDS Dashboard Container Starting ==="
echo "Timestamp: $(date)"
echo "User: $(whoami)"
echo "Working directory: $(pwd)"

# 3. VALIDATE critical environment variables
if [ -z "$SYFTBOX_EMAIL" ] || [ -z "$SYFTBOX_REFRESH_TOKEN" ]; then
    echo "❌ ERROR: Missing required environment variables" >&2
    echo "Required: SYFTBOX_EMAIL, SYFTBOX_REFRESH_TOKEN" >&2
    exit 1  # Container stops immediately
fi

# 4. EXPORT environment variables (available to all child processes)
export SYFTBOX_EMAIL
export SYFTBOX_REFRESH_TOKEN
export SYFTBOX_SERVER="${SYFTBOX_SERVER:-https://syftbox.net}"
export DEBUG="${DEBUG:-false}"
export API_PORT="${API_PORT:-8000}"

# 5. Create required directories
SYFTBOX_CONFIG_DIR="/home/syftboxuser/.syftbox"
mkdir -p "${SYFTBOX_CONFIG_DIR}/logs"

# 6. Execute CMD (supervisord becomes PID 1)
if [ "$#" -eq 0 ]; then
    echo "Starting supervisord..."
    exec supervisord -c /app/scripts/supervisord.conf -n
else
    # Allow custom commands for debugging
    echo "Running custom command: $*"
    exec "$@"
fi
```

#### Key Points

- ✅ **Validation First:** Fails fast if environment is misconfigured
- ✅ **Export Pattern:** Makes env vars available to supervisord and all children
- ✅ **exec Command:** Replaces shell with supervisord (supervisord becomes PID 1)
- ✅ **PID 1 Importance:** Receives signals from Docker (SIGTERM for graceful shutdown)
- ✅ **Custom Command Support:** Can override CMD for debugging (`docker run ... bash`)

#### Why `exec`?

Without `exec`:
```
PID 1: bash (entrypoint.sh)
  └─ PID 2: supervisord
      └─ PID 3+: child processes
```

With `exec`:
```
PID 1: supervisord (replaced bash)
  └─ PID 2+: child processes
```

**Benefits:**
- Supervisord receives SIGTERM directly from Docker
- Proper signal handling for graceful shutdown
- No zombie processes

---

### 2. supervisord.conf (Process Manager)

**File:** `scripts/supervisord.conf`
**Execution:** Continuous (until container stops)
**PID:** 1 (becomes PID 1 via exec)

#### Configuration

```ini
[supervisord]
nodaemon=true          # Stay in foreground (required for Docker)
user=syftboxuser       # Run as non-root user
logfile=/tmp/supervisord.log
pidfile=/tmp/supervisord.pid
loglevel=info
stopasgroup=true       # Send stop signal to entire process group
killasgroup=true       # Kill entire process group if needed
```

#### Why These Settings?

| Setting | Value | Reason |
|---------|-------|--------|
| `nodaemon=true` | Always | Docker requires foreground process to keep container alive |
| `user=syftboxuser` | Non-root | Security: Don't run as root |
| `stopasgroup=true` | Recommended | Ensures all child processes receive SIGTERM |
| `killasgroup=true` | Recommended | Ensures all child processes receive SIGKILL if graceful shutdown fails |

#### Program Definitions

Supervisord launches three programs in priority order (low number starts first):

```ini
[program:syftbox-setup]      # Priority 1: Runs first
[program:syftbox-client]     # Priority 10: Waits for setup
[program:rds-backend]        # Priority 20: Starts last
```

---

### 3. setup-syftbox.sh (SyftBox Configuration)

**Priority:** 1 (runs FIRST)
**Execution:** Once per container start
**Auto-restart:** No
**Duration:** 1-2 seconds
**Exit:** Terminates after completion

#### Supervisord Configuration

```ini
[program:syftbox-setup]
command=/app/scripts/setup-syftbox.sh
priority=1                  # Lowest number = first to start
autorestart=false           # Run once, don't restart
startsecs=0                 # Don't require minimum uptime
stdout_logfile=/home/syftboxuser/.syftbox/logs/setup.log
stderr_logfile=/home/syftboxuser/.syftbox/logs/setup.error.log
```

#### What It Does

```bash
#!/bin/bash
set -e

# 1. Configuration paths
SYFTBOX_HOME="/home/syftboxuser"
SYFTBOX_CONFIG_DIR="${SYFTBOX_HOME}/.syftbox"
SYFTBOX_DATA_DIR="${SYFTBOX_HOME}/SyftBox"
CONFIG_FILE="${SYFTBOX_CONFIG_DIR}/config.json"

# 2. Validate environment variables
# - Email format: user@domain.tld
# - Server URL: https://...
# - Token length: >=10 characters

# 3. Check if config already exists
if [ -f "$CONFIG_FILE" ] && [ "${FORCE_OVERWRITE:-false}" != "true" ]; then
    echo "⚠️  Config file already exists at $CONFIG_FILE"
    echo "Skipping config generation"
    exit 0  # Success: use existing config
fi

# 4. Generate config.json
mkdir -p "$SYFTBOX_CONFIG_DIR"
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
# umask 077 ensures file permissions: 600 (owner read/write only)

# 5. Create syftignore template
DATASITES_DIR="${SYFTBOX_DATA_DIR}/datasites"
mkdir -p "$DATASITES_DIR"
cat > "${DATASITES_DIR}/syftignore" <<'EOF'
# SyftBox Ignore Patterns
# (template with examples and usage instructions)
EOF

echo "✓ SyftBox config.json created successfully"
echo "✓ syftignore file created"
echo "=== Setup Complete ==="
```

#### Files Created

| File | Permissions | Purpose |
|------|-------------|---------|
| `~/.syftbox/config.json` | 600 | SyftBox client configuration with refresh token |
| `~/SyftBox/datasites/syftignore` | 644 | Datasite filtering patterns (template) |
| `~/.syftbox/logs/` | 755 | Log directory for all services |

#### Behavior on Container Restart

**First start:**
- Creates `config.json` and `syftignore`
- Exits with code 0

**Subsequent restarts:**
- Detects existing `config.json`
- Skips creation (unless `FORCE_OVERWRITE=true`)
- Exits with code 0

**Why this matters:**
- Preserves user customizations in volumes
- Prevents overwriting manually edited configs
- Fast startup on restart (no regeneration needed)

---

### 4. syftbox Client (Data Synchronization)

**Priority:** 10 (starts SECOND, after setup)
**Execution:** Continuous
**Auto-restart:** Yes (up to 3 retries)
**Duration:** Runs until container stops

#### Supervisord Configuration

```ini
[program:syftbox-client]
command=bash -c 'syftbox --config="$HOME/.syftbox/config.json"'
environment=HOME="/home/syftboxuser"
priority=10                  # Starts after setup (priority 1)
autorestart=true             # Restart on crash
startsecs=5                  # Must stay running 5 seconds to be "started"
startretries=3               # Retry up to 3 times on immediate failure
stdout_logfile=/dev/stdout   # Logs visible in `docker logs`
stderr_logfile=/dev/stderr
depends_on=syftbox-setup     # Wait for setup to complete
```

#### What It Does

1. **Reads Configuration**
   - Loads `~/.syftbox/config.json`
   - Validates email and refresh token
   - Connects to SyftBox server

2. **Authenticates**
   - Uses refresh token to get access token
   - Maintains session with server

3. **Syncs Datasites**
   - Downloads datasites from network
   - Stores in `~/SyftBox/datasites/<email>/`
   - Respects `syftignore` patterns

4. **Monitors Changes**
   - Watches for local file changes
   - Uploads changes to network
   - Downloads remote changes

#### Dependency Chain

```
setup-syftbox.sh (priority 1)
  └─ Creates config.json
      └─ syftbox client (priority 10) starts
          └─ Reads config.json
```

Without `depends_on`:
- syftbox client might start before config.json exists
- Would crash immediately
- Supervisord would retry (3 times) then give up

With `depends_on`:
- Supervisord waits for setup to exit (success or failure)
- Only then starts syftbox client
- Guaranteed config.json exists

#### Restart Behavior

**If syftbox crashes:**
```
T=0     Crash detected (exit code != 0)
T=0     Supervisord immediately restarts it
T=5     Check: still running? → Mark as "started"
        (If crashes before 5s: retry count increments)
```

**After 3 failed retries:**
```
Supervisord: "Giving up on syftbox-client"
Container: Keeps running (backend still works)
Health check: May fail (depends on implementation)
```

#### Log Locations

- **stdout:** `/dev/stdout` → `docker logs <container>`
- **stderr:** `/dev/stderr` → `docker logs <container>`
- **Why not file?** Real-time visibility in Docker logs for monitoring

---

### 5. rds-backend (FastAPI Server)

**Priority:** 20 (starts LAST)
**Execution:** Continuous
**Auto-restart:** Yes (up to 3 retries)
**Duration:** Runs until container stops

#### Supervisord Configuration

```ini
[program:rds-backend]
command=/app/.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port %(ENV_API_PORT)s
directory=/app
priority=20                  # Starts last (highest priority number)
autorestart=true             # Restart on crash
startsecs=5                  # Must stay running 5 seconds
startretries=3               # Retry up to 3 times
stdout_logfile=/home/syftboxuser/.syftbox/logs/rds-backend.log
stdout_logfile_maxbytes=50MB
stdout_logfile_backups=5
stderr_logfile=/home/syftboxuser/.syftbox/logs/rds-backend.error.log
stderr_logfile_maxbytes=50MB
stderr_logfile_backups=5
environment=DEBUG="%(ENV_DEBUG)s",API_PORT="%(ENV_API_PORT)s"
```

#### What It Does

1. **Starts Uvicorn ASGI Server**
   - Binds to `0.0.0.0:${API_PORT}` (default 8000)
   - Serves FastAPI application
   - Hot reload disabled in production

2. **API Endpoints**
   - `/api/health` - Health check
   - `/api/v1/jobs/*` - Job management
   - `/api/v1/datasets/*` - Dataset operations
   - `/api/v1/account` - Account info
   - `/api/v1/trusted-datasites` - Datasite management

3. **Static File Serving**
   - Serves pre-built Next.js frontend from `/app/frontend/out/`
   - Routes:
     - `/` → `index.html`
     - `/jobs` → `jobs.html`
     - `/datasets` → `datasets.html`
     - `/_next/static/*` → JavaScript bundles

4. **RDS Client Integration**
   - Uses `syft-rds` library
   - Reads SyftBox data from `~/SyftBox/datasites/`
   - Interacts with jobs, datasets, user code

#### Environment Variables

| Variable | Default | Used For |
|----------|---------|----------|
| `DEBUG` | `false` | FastAPI debug mode (verbose errors) |
| `API_PORT` | `8000` | Port to listen on |

Passed via supervisord's `environment` directive:
```ini
environment=DEBUG="%(ENV_DEBUG)s",API_PORT="%(ENV_API_PORT)s"
```

#### Log Management

**Rotation Settings:**
- Max size per file: 50MB
- Number of backups: 5
- Total max space: 50MB × 6 = 300MB (current + 5 backups)

**Log Files:**
- `rds-backend.log` - Normal output (access logs, info messages)
- `rds-backend.error.log` - Errors and warnings

**When logs rotate:**
```
rds-backend.log          → rds-backend.log.1
rds-backend.log.1        → rds-backend.log.2
rds-backend.log.2        → rds-backend.log.3
rds-backend.log.3        → rds-backend.log.4
rds-backend.log.4        → rds-backend.log.5
rds-backend.log.5        → deleted
(new log starts fresh)
```

#### Why It Starts Last (Priority 20)

- **Backend depends on SyftBox data**
  - Can function without it, but limited
  - Better UX if SyftBox is syncing when users access

- **Startup time**
  - FastAPI import takes ~1-2 seconds
  - SyftBox setup is faster
  - Starting in parallel would show "unhealthy" during init

- **Resource allocation**
  - SyftBox should get CPU/network first
  - Backend can wait a few extra seconds

---

## Process Management

### Priority System

Supervisord uses priority to determine startup order:

```ini
Priority 1:  setup-syftbox.sh    ← Runs first
Priority 10: syftbox-client      ← Runs second
Priority 20: rds-backend         ← Runs last
```

**Rules:**
- Lower number = starts earlier
- Higher number = starts later
- Shutdown happens in REVERSE order (20 → 10 → 1)

### Dependencies

```ini
[program:syftbox-client]
depends_on=syftbox-setup
```

**What this means:**
- Supervisord won't start `syftbox-client` until `syftbox-setup` has exited
- If `syftbox-setup` exits with error (non-zero), `syftbox-client` still starts
- This is only about WHEN to start, not IF

**Why not full dependency management?**
- Supervisord has limited dependency features
- Priority system handles most ordering needs
- More complex dependencies would require external tools (systemd, kubernetes)

### Auto-Restart Behavior

#### One-time Programs (setup)

```ini
autorestart=false
startsecs=0
```

- Runs once
- Exits after completion
- Never restarted by supervisord
- `startsecs=0` means "don't require minimum uptime to be considered started"

#### Long-running Programs (syftbox, backend)

```ini
autorestart=true
startsecs=5
startretries=3
```

**Restart Logic:**
```
Program exits (crash, killed, etc.)
  ↓
Wait 0 seconds (no delay configured)
  ↓
Restart the program
  ↓
Wait 5 seconds
  ↓
Still running? → Success, reset retry counter
Exited before 5s? → Failed start, increment retry counter
  ↓
Retry count < 3? → Restart again
Retry count >= 3? → Give up, mark as FATAL
```

**Example Timeline:**

```
T=0     Backend crashes (bug in code)
T=0     Supervisord: "Backend exited, restarting"
T=0.1   Backend starts again
T=5.1   Supervisord: "Backend has been up for 5s, marking as started"
        → Retry counter reset to 0

T=100   Backend crashes again
T=100   Supervisord: "Backend exited, restarting" (retry 1)
T=100.1 Backend starts, immediately crashes (bad config)
T=100.1 Supervisord: "Backend exited before 5s" (retry 2)
T=100.2 Backend starts, immediately crashes
T=100.2 Supervisord: "Backend exited before 5s" (retry 3)
T=100.3 Backend starts, immediately crashes
T=100.3 Supervisord: "Gave up restarting, marking as FATAL"
        → Backend won't restart until manual intervention
```

### Process States

Supervisord tracks each program's state:

| State | Meaning | Next Action |
|-------|---------|-------------|
| `STOPPED` | Not running, not supposed to be | None |
| `STARTING` | Starting up, within `startsecs` window | Wait for `startsecs` to elapse |
| `RUNNING` | Running normally, past `startsecs` | Monitor for exit |
| `BACKOFF` | Crashed before `startsecs`, retrying | Attempt restart |
| `STOPPING` | Shutting down (SIGTERM sent) | Wait for exit or timeout |
| `EXITED` | Exited normally (zero exit code) | Depends on `autorestart` |
| `FATAL` | Crash loop, gave up after `startretries` | Manual intervention needed |

Check states with:
```bash
docker exec <container> supervisorctl status
```

---

## Timeline & Examples

### Startup Timeline (Normal)

```
T=0.0s    docker run command executed
          Docker creates container, sets up networking

T=0.1s    ENTRYPOINT: entrypoint.sh starts (PID 1)
          ├─ Validates SYFTBOX_EMAIL: ✓
          ├─ Validates SYFTBOX_REFRESH_TOKEN: ✓
          ├─ Exports environment variables
          └─ Creates /home/syftboxuser/.syftbox/logs/

T=0.5s    entrypoint.sh: exec supervisord
          └─ Supervisord replaces bash (becomes PID 1)

T=0.6s    Supervisord reads config
          ├─ Finds 3 program definitions
          ├─ Sorts by priority: 1, 10, 20
          └─ Prepares to launch programs

T=0.7s    [Priority 1] setup-syftbox.sh starts
          ├─ Validates email format: user@example.com ✓
          ├─ Validates server URL: https://syftbox.net ✓
          ├─ Checks for existing config.json: Not found
          ├─ Creates config.json (600 permissions)
          ├─ Creates syftignore template
          └─ Exits with code 0

T=2.0s    [Priority 10] syftbox client starts (setup finished)
          ├─ Reads config.json
          ├─ Connects to syftbox.net
          ├─ Authenticates with refresh token
          ├─ Downloads datasite list
          └─ Begins syncing (stays running)

T=2.1s    [Priority 20] rds-backend starts
          ├─ Loads FastAPI app
          ├─ Imports Python modules
          ├─ Initializes RDS client
          ├─ Binds to 0.0.0.0:8000
          ├─ Starts Uvicorn worker
          └─ Server ready (stays running)

T=7.1s    Backend reaches startsecs=5
          └─ Supervisord marks backend as "RUNNING"

T=7.0s    SyftBox reaches startsecs=5
          └─ Supervisord marks syftbox as "RUNNING"

T=40s     Health check starts (start-period elapsed)
          └─ curl http://localhost:8000/api/health

T=40.1s   Health check response: {"status": "healthy"}
          └─ Docker marks container as "healthy"

T=70s     Health check runs again (interval=30s)
T=100s    Health check runs again
...       Health check every 30 seconds
```

### Startup Timeline (Missing Env Var)

```
T=0.0s    docker run command (missing SYFTBOX_EMAIL)

T=0.1s    ENTRYPOINT: entrypoint.sh starts
          ├─ Validates SYFTBOX_EMAIL: ✗ (empty)
          ├─ Prints error message
          └─ exit 1

T=0.2s    Container exits (status code 1)
          └─ Docker: "Container exited with error"

User sees:
  ❌ ERROR: Missing required environment variables
  Required: SYFTBOX_EMAIL, SYFTBOX_REFRESH_TOKEN
  Usage: docker run -e SYFTBOX_EMAIL=... -e SYFTBOX_REFRESH_TOKEN=... ...
```

### Process Tree When Running

```bash
$ docker exec <container> ps aux

USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
syftbox      1  0.0  0.1  25120 15684 ?        Ss   10:00   0:00 /usr/bin/python3 /usr/bin/supervisord -c /app/scripts/supervisord.conf -n
syftbox     42  0.5  1.2 450320 95544 ?        Sl   10:00   0:15 syftbox --config=/home/syftboxuser/.syftbox/config.json
syftbox     56  0.8  2.1 890432 165432 ?       Sl   10:00   0:25 /app/.venv/bin/python /app/.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

**Explanation:**
- PID 1: supervisord (parent process)
- PID 42: syftbox client (child of supervisord)
- PID 56: uvicorn/backend (child of supervisord)

---

## Shutdown & Restart Behavior

### Graceful Shutdown (docker stop)

```
T=0s      User runs: docker stop <container>
          Docker sends SIGTERM to PID 1 (supervisord)

T=0.1s    Supervisord receives SIGTERM
          ├─ Begins shutdown sequence
          ├─ Stops accepting new programs
          └─ Sends SIGTERM to all child processes (due to stopasgroup=true)

T=0.2s    Child processes receive SIGTERM
          ├─ syftbox client: Begins graceful shutdown
          │   ├─ Closes network connections
          │   ├─ Flushes pending writes
          │   └─ Exits cleanly
          │
          └─ rds-backend (uvicorn): Begins graceful shutdown
              ├─ Stops accepting new HTTP requests
              ├─ Finishes processing active requests
              └─ Exits cleanly

T=2s      All child processes exited
          └─ Supervisord exits (code 0)

T=2.1s    Container stops
          └─ Docker: "Container stopped gracefully"
```

**If processes don't exit in time:**

```
T=10s     Docker timeout expires (default 10 seconds)
          ├─ Docker sends SIGKILL to PID 1
          └─ Container forcefully terminated

T=10.1s   Container stopped (exit code may be non-zero)
```

**Configure timeout:**
```bash
docker stop -t 30 <container>  # Wait 30s before SIGKILL
```

### Container Restart (docker restart)

**Full sequence:**

```
1. SHUTDOWN (as above)
   └─ Graceful stop with SIGTERM → SIGKILL fallback

2. STARTUP (as in startup timeline)
   ├─ entrypoint.sh validates env vars
   ├─ supervisord starts
   ├─ setup-syftbox.sh runs
   │   └─ Sees existing config.json, skips creation
   ├─ syftbox client starts (uses existing config)
   └─ rds-backend starts
```

**Key difference from first start:**
- `setup-syftbox.sh` skips config generation (already exists)
- Faster startup (~1s saved)
- Preserves user customizations in volumes

### Process Crash (e.g., backend bug)

```
T=0s      Backend crashes (unhandled exception)
          ├─ Process exits with code 1
          └─ Supervisord detects exit

T=0.1s    Supervisord: "rds-backend exited unexpectedly"
          ├─ autorestart=true → restart immediately
          └─ Backend starts again

T=5.1s    Backend still running
          └─ Supervisord: "Backend started successfully"

Container stays running
Other processes (syftbox) unaffected
```

**Crash loop:**

```
T=0s      Backend crashes immediately on start (bad config)
T=0.1s    Supervisord restarts backend (retry 1/3)
T=0.2s    Backend crashes again (before startsecs=5)
T=0.3s    Supervisord restarts backend (retry 2/3)
T=0.4s    Backend crashes again
T=0.5s    Supervisord restarts backend (retry 3/3)
T=0.6s    Backend crashes again
T=0.7s    Supervisord: "Gave up, marking as FATAL"
          └─ Backend won't restart automatically

Container stays running
SyftBox client still works
Health check will fail (backend down)
```

**Fix a FATAL process:**

```bash
# Check status
docker exec <container> supervisorctl status
# Output: rds-backend    FATAL    Exited too quickly (process log may have details)

# View logs
docker exec <container> tail /home/syftboxuser/.syftbox/logs/rds-backend.error.log

# Restart manually after fixing issue
docker exec <container> supervisorctl restart rds-backend
```

---

## Debugging & Troubleshooting

### Check Process Status

```bash
# All processes
docker exec <container> supervisorctl status

# Example output:
# rds-backend              RUNNING   pid 56, uptime 0:10:23
# syftbox-client           RUNNING   pid 42, uptime 0:10:25
# syftbox-setup            EXITED    Nov 06 10:00 AM
```

**States explained:**
- `RUNNING` - Process is healthy
- `STARTING` - Process just started, within startsecs window
- `BACKOFF` - Process crashed, retrying
- `FATAL` - Process crashed too many times, gave up
- `EXITED` - Process exited (normal for setup script)
- `STOPPED` - Process not supposed to be running

### View Logs

**Supervisord main log:**
```bash
docker exec <container> tail -f /tmp/supervisord.log
```

**Setup script logs:**
```bash
docker exec <container> cat /home/syftboxuser/.syftbox/logs/setup.log
docker exec <container> cat /home/syftboxuser/.syftbox/logs/setup.error.log
```

**SyftBox client logs:**
```bash
docker logs -f <container>  # stdout/stderr redirected to docker logs
```

**Backend logs:**
```bash
docker exec <container> tail -f /home/syftboxuser/.syftbox/logs/rds-backend.log
docker exec <container> tail -f /home/syftboxuser/.syftbox/logs/rds-backend.error.log
```

**Follow all backend logs:**
```bash
docker exec <container> tail -f /home/syftboxuser/.syftbox/logs/rds-backend*.log
```

### Restart Individual Process

```bash
# Restart backend only (doesn't affect syftbox)
docker exec <container> supervisorctl restart rds-backend

# Restart syftbox only
docker exec <container> supervisorctl restart syftbox-client

# Restart all processes
docker exec <container> supervisorctl restart all

# Stop a process
docker exec <container> supervisorctl stop rds-backend

# Start a stopped process
docker exec <container> supervisorctl start rds-backend
```

### View Process Output in Real-Time

```bash
# Tail backend stdout (what supervisord captures)
docker exec <container> supervisorctl tail -f rds-backend

# Tail backend stderr
docker exec <container> supervisorctl tail -f rds-backend stderr
```

### Debug Container Startup

**Enable debug mode:**
```bash
docker run -e DEBUG=true -e SYFTBOX_EMAIL=... -e SYFTBOX_REFRESH_TOKEN=... rds-dashboard:latest
```

**What DEBUG=true does:**
- `set -x` in bash scripts (shows every command executed)
- Verbose output in entrypoint.sh and setup-syftbox.sh
- FastAPI debug mode (detailed error traces)

**Example debug output:**
```
+ echo '=== RDS Dashboard Container Starting ==='
=== RDS Dashboard Container Starting ===
+ date
Thu Nov  6 10:00:00 UTC 2025
+ whoami
syftboxuser
+ '[' -z user@example.com ']'
+ '[' -z eyJhbGc... ']'
+ export SYFTBOX_EMAIL=user@example.com
+ export SYFTBOX_REFRESH_TOKEN=eyJhbGc...
...
```

### Interactive Shell Access

```bash
# Get a shell in running container
docker exec -it <container> bash

# Inside container:
whoami                    # Check current user
pwd                       # Current directory
env | grep SYFTBOX        # Check environment variables
ls -la ~/.syftbox/        # Check config directory
cat ~/.syftbox/config.json | jq  # View config (redact token!)
supervisorctl status      # Check process status
```

### Test Configuration Without Starting Services

```bash
# Override CMD to just run bash
docker run --rm -it \
  -e SYFTBOX_EMAIL=test@example.com \
  -e SYFTBOX_REFRESH_TOKEN=fake_token \
  rds-dashboard:latest \
  bash

# Inside container:
/app/scripts/setup-syftbox.sh  # Run setup manually
cat ~/.syftbox/config.json      # Verify config created
exit
```

### Check Environment Variables

```bash
# From host
docker exec <container> env | grep -E 'SYFTBOX|DEBUG|API_PORT'

# Expected output:
# SYFTBOX_EMAIL=user@example.com
# SYFTBOX_REFRESH_TOKEN=eyJhbGc...
# SYFTBOX_SERVER=https://syftbox.net
# DEBUG=false
# API_PORT=8000
```

### Health Check Status

```bash
# View health check details
docker inspect <container> | jq '.[0].State.Health'

# Example output:
# {
#   "Status": "healthy",
#   "FailingStreak": 0,
#   "Log": [
#     {
#       "Start": "2025-11-06T10:01:00Z",
#       "End": "2025-11-06T10:01:00.5Z",
#       "ExitCode": 0,
#       "Output": ""
#     }
#   ]
# }
```

### Common Issues & Solutions

#### Issue: Container exits immediately

**Diagnosis:**
```bash
docker logs <container>
```

**Common causes:**
- Missing env vars (SYFTBOX_EMAIL, SYFTBOX_REFRESH_TOKEN)
- Invalid email format
- Token too short

**Solution:**
Check error message in logs, provide correct env vars

---

#### Issue: Backend shows as FATAL

**Diagnosis:**
```bash
docker exec <container> supervisorctl status
# rds-backend    FATAL    Exited too quickly

docker exec <container> tail /home/syftboxuser/.syftbox/logs/rds-backend.error.log
```

**Common causes:**
- Python import error (missing dependency)
- Port already in use (if not using default 8000)
- Permission issue writing to logs

**Solution:**
- Check error logs for specific error
- Ensure API_PORT is available
- Restart after fixing: `supervisorctl restart rds-backend`

---

#### Issue: SyftBox won't connect

**Diagnosis:**
```bash
docker logs <container> | grep -i syftbox
docker exec <container> cat ~/.syftbox/config.json
```

**Common causes:**
- Invalid refresh token
- Network connectivity to syftbox.net
- Firewall blocking outbound HTTPS

**Solution:**
- Verify token is correct (from your ~/.syftbox/config.json)
- Test network: `docker exec <container> curl https://syftbox.net`
- Check firewall rules

---

#### Issue: Health check failing

**Diagnosis:**
```bash
docker inspect <container> | jq '.[0].State.Health'
docker exec <container> curl -v http://localhost:8000/api/health
```

**Common causes:**
- Backend not running (check supervisorctl status)
- Backend listening on wrong port
- API endpoint renamed/removed

**Solution:**
- Verify backend is RUNNING
- Check API_PORT matches health check
- Test endpoint manually with curl

---

## Development Workflow

### Local Testing (Without Docker)

```bash
# Terminal 1: Start SyftBox
syftbox --config ~/.syftbox/config.json

# Terminal 2: Start backend
cd /path/to/rds-dashboard
just dev  # Uses justfile to start both frontend and backend
```

### Building Docker Image Locally

```bash
# Ensure frontend is built first
cd frontend
bun run build
cd ..

# Build Docker image
docker build -f docker/Dockerfile.rds-dashboard-do -t rds-dashboard:dev .

# Run locally
docker run --rm -it \
  -e SYFTBOX_EMAIL=your@email.com \
  -e SYFTBOX_REFRESH_TOKEN=your_token \
  -p 8000:8000 \
  rds-dashboard:dev
```

### Testing Script Changes

**Modify scripts without rebuilding:**

```bash
# Run container with volume mounts for scripts
docker run --rm -it \
  -v $(pwd)/scripts:/app/scripts \
  -e SYFTBOX_EMAIL=... \
  -e SYFTBOX_REFRESH_TOKEN=... \
  rds-dashboard:dev

# Changes to scripts are immediately available
# Restart processes to pick up changes:
docker exec <container> supervisorctl restart all
```

### Multi-Architecture Build

```bash
# Set up buildx (one-time)
docker buildx create --use

# Build for multiple architectures
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f docker/Dockerfile.rds-dashboard-do \
  -t rds-dashboard:latest \
  --push \
  .
```

### Pre-Release Checklist

Before publishing to Docker Hub:

- [ ] Review [docs/plans/FIXES.md](../docs/plans/FIXES.md) for outstanding issues
- [ ] Test multi-arch build (amd64 + arm64)
- [ ] Verify frontend is built (`frontend/out/index.html` exists)
- [ ] Run full integration test (start container, test all endpoints)
- [ ] Check image size (`docker images` - should be 500-700MB)
- [ ] Verify health check works (`docker inspect` health status)
- [ ] Test with custom API_PORT
- [ ] Test container restart (volumes persist)
- [ ] Update version labels in Dockerfile
- [ ] Update docker/README.md with new features/breaking changes

---

## File Reference

### Scripts

| File | Purpose | Execution |
|------|---------|-----------|
| `scripts/entrypoint.sh` | Container initialization, env validation | Every start |
| `scripts/supervisord.conf` | Process management configuration | Continuous |
| `scripts/setup-syftbox.sh` | SyftBox config generation | Once per start |

### Logs

| File | Purpose | Rotation |
|------|---------|----------|
| `/tmp/supervisord.log` | Supervisord main log | None (temp) |
| `~/.syftbox/logs/setup.log` | Setup script stdout | 10MB, 3 backups |
| `~/.syftbox/logs/setup.error.log` | Setup script stderr | 10MB, 3 backups |
| `~/.syftbox/logs/rds-backend.log` | Backend stdout | 50MB, 5 backups |
| `~/.syftbox/logs/rds-backend.error.log` | Backend stderr | 50MB, 5 backups |

### Configuration

| File | Purpose | Permissions |
|------|---------|-------------|
| `~/.syftbox/config.json` | SyftBox client config (includes refresh token) | 600 |
| `~/SyftBox/datasites/syftignore` | Datasite filtering patterns | 644 |

---

## Additional Resources

- [User Documentation](./README.md) - User-facing deployment guide
- [Pre-Release Fixes](../docs/plans/FIXES.md) - Known issues to fix before release
- [SyftBox Documentation](https://syftbox.openmined.org) - SyftBox client docs
- [Supervisord Documentation](http://supervisord.org) - Process manager reference

---

## Contributing

When modifying Docker setup:

1. **Test locally first** - Build and run image locally
2. **Update this document** - Keep DEVELOPMENT.md in sync with code
3. **Update README.md** - If user-facing behavior changes
4. **Test multi-arch** - Ensure both amd64 and arm64 work
5. **Check logs** - Verify log output is helpful for debugging

---

**Document Version:** 1.0
**Last Updated:** 2025-01-06
**Maintainers:** OpenMined RDS Team
