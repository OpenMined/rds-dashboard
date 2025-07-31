#!/bin/bash


# install virtual environment and Python API dependencies
rm -rf .venv
uv venv -p 3.12
uv sync


# Start the RDS Server in Background
uv run syft-rds server &
RDS_PID=$!

# Ensure RDS server is killed on script exit
trap 'kill $RDS_PID' EXIT

# Set default port if not provided
SYFTBOX_ASSIGNED_PORT=${SYFTBOX_ASSIGNED_PORT:-8080}

export API_PORT=${SYFTBOX_ASSIGNED_PORT}
export NEXT_PUBLIC_API_URL=http://localhost:${SYFTBOX_ASSIGNED_PORT}

# build the frontend app
uvx --directory frontend pybun install
uvx --directory frontend pybun run build

# run the app
uv run uvicorn backend.main:app --reload --host 0.0.0.0 --port "$SYFTBOX_ASSIGNED_PORT"
