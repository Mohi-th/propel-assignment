# Deployment

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- Git

## Steps

1. Clone the repository:
   ```bash
   git clone <YOUR_REPO_URL>
   cd <YOUR_REPO_DIR>
   ```

2. Start the system:
   ```bash
   docker compose up -d
   ```
   Wait for the containers to build and start. The backend container (`backend`) will wait for Postgres to be ready, push the Drizzle schema, and seed the database if it is empty. This takes roughly 10-15 seconds on the first run.

3. Verify it is running:
   - **Frontend UI:** Open `http://localhost:5173` in a browser.
   - **Backend API Health:** Open `http://localhost:3001/api/health`.

## Environment Variables

A `.env.example` file is included in the repository. The `docker-compose.yml` uses these defaults:
- `POSTGRES_USER`: Database username (default: `postgres`)
- `POSTGRES_PASSWORD`: Database password (default: `postgres`)
- `POSTGRES_DB`: Database name (default: `power_grid`)
- `PORT`: Backend port (default: `3001`)

The database URL for the backend is automatically constructed inside `docker-compose.yml`. Note that the project also supports a Neon PostgreSQL `DATABASE_URL` via the `.env` file if you prefer to run against a hosted database.

## Troubleshooting

### Port Conflicts
- **Symptom:** `Error starting userland proxy: listen tcp4 0.0.0.0:3001: bind: address already in use` or similar for port `5432` or `5173`.
- **Fix:** Stop whatever is using the port locally (e.g. a local Postgres instance on 5432) or change the host port mapping in `docker-compose.yml`.

### Database Seed Racing / Restarting
- **Symptom:** The backend logs show errors about connecting to the database on the very first boot.
- **Fix:** The backend container will automatically crash and restart until the `db` container is fully healthy (using Docker's `depends_on: condition: service_healthy`). Just wait a few seconds and the backend will reconnect, push the schema, and start successfully.

### Clearing Data (Hard Reset)
- **Symptom:** You want to reset the synthetic network to a clean state.
- **Fix:** Run `docker compose down -v` to destroy the database volume, then run `docker compose up -d` again. The seed script will regenerate the substations, transformers, and poles.
