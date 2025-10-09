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

### Running Multiple Instances

To run multiple dashboards simultaneously (e.g., for testing with different SyftBox clients):

```bash
# Terminal 1 - Instance 1
just dev "/path/to/client1.config.json"
# → Backend: :8001, Frontend: :3000

# Terminal 2 - Instance 2
just dev "/path/to/client2.config.json"
# → Backend: :8002, Frontend: :3001 (auto-incremented)
```

Each instance automatically gets its own ports. The frontend determines the backend port at runtime using the formula: `backend_port = 8001 + (frontend_port - 3000)`.

**Debug**: Check API configuration in browser console:
```javascript
window.apiConfig.log()  // Show current config
window.apiConfig.reset() // Reset if needed
```

## Build

Run `just prod` to export the frontend into a static build and start the FastAPI backend server.
