# Guidelines for new commands
# - Start with a verb
# - Keep it short (max. 3 words in a command)
# - Group commands by context. Include group name in the command name.
# - Mark things private that are util functions with [private] or _var
# - Don't over-engineer, keep it simple.
# - Don't break existing commands
# - Run just --fmt --unstable after adding new commands

set dotenv-load := true

# ---------------------------------------------------------------------------------------------------------------------
# Private vars

_red := '\033[1;31m'
_cyan := '\033[1;36m'
_green := '\033[1;32m'
_yellow := '\033[1;33m'
_nc := '\033[0m'

# ---------------------------------------------------------------------------------------------------------------------
# Aliases

alias rj := run-jupyter
alias rs := prod

# ---------------------------------------------------------------------------------------------------------------------

@default:
    just --list

[group('utils')]
setup:
    uv sync
    source .venv/bin/activate
    bun install --cwd frontend

[group('utils')]
run-jupyter jupyter_args="":
    # uv sync

    uv run --frozen --with "jupyterlab" \
        jupyter lab {{ jupyter_args }}

[group('utils')]
clean:
    #!/bin/sh
    echo "{{ _cyan }}Cleaning up local files and directories...{{ _nc }}"

    # Function to remove directories by name pattern
    remove_dirs() {
        dir_name=$1
        dirs=$(find . -type d -name "$dir_name" 2>/dev/null)
        if [ -n "$dirs" ]; then
            echo "$dirs" | while read -r dir; do
                echo "  {{ _red }}✗{{ _nc }} Removing $dir"
                rm -rf "$dir"
            done
        fi
    }

    # Remove directories by name pattern
    remove_dirs ".ruff_cache"

    # Remove __pycache__ directories
    pycache_count=$(find . -type d -name "__pycache__" 2>/dev/null | wc -l)
    if [ "$pycache_count" -gt 0 ]; then
        echo "  {{ _red }}✗{{ _nc }} Removing $pycache_count __pycache__ directories"
        find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    fi

    echo "{{ _green }}✓ Clean complete!{{ _nc }}"

# ---------------------------------------------------------------------------------------------------------------------

[group('dev')]
dev config_path="" port="8001" frontend_port="3000":
    #!/bin/bash
    set -euo pipefail

    # if the config_path is not empty string, set syftbox client config path
    CONFIG_FLAG=""
    if [ "{{config_path}}" != "" ]; then
        echo -e "{{_green}}Using custom config path: {{config_path}}{{_nc}}"
        CONFIG_FLAG="SYFTBOX_CLIENT_CONFIG_PATH={{config_path}}"
    fi

    # Find available port starting from the requested port
    find_available_port() {
        local port=$1
        while lsof -i :$port >/dev/null 2>&1; do
            echo -e "{{_yellow}}Port $port is in use, trying next port...{{_nc}}" >&2
            port=$((port + 1))
        done
        echo $port
    }

    export API_PORT=$(find_available_port {{port}})
    export FRONTEND_PORT=$(find_available_port {{frontend_port}})
    echo -e "{{_cyan}}Starting backend on port ${API_PORT}{{_nc}}"
    echo -e "{{_cyan}}Starting frontend on port ${FRONTEND_PORT}{{_nc}}"

    # concurrently run the server and frontend
    bunx concurrently --names "server,frontend" --prefix-colors "blue,green" \
        "${CONFIG_FLAG} uv run uvicorn backend.main:app --reload --port ${API_PORT}" \
        "NEXT_PUBLIC_API_URL=http://localhost:${API_PORT} bun run --cwd frontend dev -- -p ${FRONTEND_PORT}"

[group('server')]
prod config_path="":
    #!/bin/bash
    set -euo pipefail

    # if the config_path is not empty string, set syftbox client config path
    if [ "{{config_path}}" != "" ]; then
        echo "${_green}Using custom config path: ${config_path}${_nc}"
        export SYFTBOX_CLIENT_CONFIG_PATH="${config_path}"
    fi

    # build the frontend
    bun run --cwd frontend build

    # Run in production mode (debug=false to enable static file serving)
    DEBUG=false uv run uvicorn backend.main:app
