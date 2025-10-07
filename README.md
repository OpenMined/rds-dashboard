# RDS Dashboard

## Getting Started

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- [Bun](https://bun.sh/)
- [just](https://github.com/casey/just)

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   just setup
   ```

3. Run the development server:
   ```bash
   just dev
   ```

   Or with a custom SyftBox config:
   ```bash
   just dev /path/to/syftbox/config.json
   ```

The app will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8001

Both frontend and backend have hot-reload enabled during development.

## Build

Run `just prod` to export the frontend into a static build and start the FastAPI backend server.
