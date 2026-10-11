# whirm-backend

API built with Node.js 24, TypeScript, Hono, and PostgreSQL with Drizzle.

## Local setup

Prerequisites: Node.js 24, pnpm 11.28.5, and Docker Compose.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait db
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Configuration is defined in `.env`: the API runs on port 3000 and PostgreSQL on port 5433.

- Health check: http://localhost:3000/health
- API documentation: http://localhost:3000/ui (OpenAPI: `/doc`)
- Demo accounts: `alice@example.test` and `bob@example.test`, password `Hackaton2026!`.

## Docker setup

Run these commands from `whirm-backend`. Node.js 24 and pnpm 11.28.5 are still required on the host for manual migrations and seeding.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait db
pnpm db:migrate
pnpm db:seed
docker compose up -d --build api
```

Keep your existing `.env` if already configured. Migrations and seeding are manual; the API container does not run them. For later schema updates, apply migrations before starting the updated API.

The API image uses Node.js 24 and contains only production dependencies and compiled code. Compose runs it in production mode on `${PORT:-3000}` and connects it to `db:5432`; the host commands continue using `POSTGRES_HOST=localhost` and `POSTGRES_PORT=5433` from `.env`.

`/health` and the API documentation are accessible over local HTTP. Authentication in production requires HTTPS because session cookies are secure; provide HTTPS when using authentication with this Docker setup.

```bash
docker compose logs -f api
docker compose down
```

Stopping the stack preserves the PostgreSQL volume.

## Useful commands

- `pnpm build` then `pnpm start`: compile and run the API.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`: check the code.
- `pnpm test`: run the tests (PostgreSQL must be running).
- `pnpm db:generate` then `pnpm db:migrate`: generate and apply migrations.
- `docker compose down`: stop the stack while preserving PostgreSQL data.

## Usage

Authentication routes are under `/auth`, and wallet routes are under `/wallet`. Wallet routes require a session; only Base Sepolia (`84532`) is supported. Cryptographic wallet verification is not yet implemented.

Each user can store at most one wallet, including candidates. Repeating `PUT /wallet` with the same address and chain returns the existing wallet (`200`); a different address or an address owned by another user returns `409`. Existing wallets are never replaced automatically. `GET /wallet` returns `{ wallet }`, or `404` when none is stored.

Migration `0002_one_wallet_per_user` fails if a user already has multiple wallets; it does not delete or choose between existing records.

The frontend must use `credentials: 'include'` and have its origin listed in `CORS_ORIGINS`. The frontend and API must belong to the same site; HTTPS is required in production.
