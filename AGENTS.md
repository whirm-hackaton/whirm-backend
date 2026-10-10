# Repository Guidelines

## Project Structure & Module Organization

This backend uses Node.js 24, TypeScript, Hono, PostgreSQL, and Drizzle. `src/app.ts` creates the application without starting a server or connecting to PostgreSQL; `src/index.ts` starts HTTP serving.

- `src/routes/`: HTTP handlers and OpenAPI route declarations.
- `src/schemas/`: Zod schemas and HTTP types.
- `src/services/` and `src/middleware/`: reserved for business logic and middleware.
- `src/db/`: PostgreSQL pool and Drizzle table definitions.
- `src/lib/env.ts`: configuration loading and validation.
- Tests live beside source files, such as `src/routes/health.test.ts`.

Compilation produces `dist/`. Commit generated migrations in `drizzle/`; the current schema is empty.

## Build, Test, and Development Commands

Use Node.js 24 and pnpm 11.28.5. Run commands from the repository root.

- `pnpm install --frozen-lockfile`: install locked dependencies.
- `cp .env.example .env`: create local configuration.
- `docker compose up -d --wait db`: start local PostgreSQL, normally on port 5433.
- `pnpm dev`: run the API with automatic reload on port 3000.
- `pnpm build` / `pnpm start`: compile TypeScript / run compiled output.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`: check types, ESLint rules, and formatting.
- `pnpm format`: apply Prettier formatting.
- `pnpm test`: run Vitest once.
- `pnpm db:generate` / `pnpm db:migrate`: generate / apply migrations.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, single quotes, and no semicolons. Prettier controls formatting; ESLint uses type-aware TypeScript rules. Use `.js` extensions in relative imports for NodeNext compatibility. Follow existing lowercase filenames, camelCase functions, and PascalCase schema names such as `HealthResponseSchema`. Define API schemas in `src/schemas/` and register routes in `src/app.ts`.

## Testing Guidelines

Vitest runs in the Node environment. Name tests `*.test.ts` and use `describe`, `it`, and `expect`. Test HTTP behavior through `createApp().request(...)`, asserting response status and body. Existing tests require no database. No coverage threshold is configured; add focused tests for new behavior and regressions.

## Security & Configuration Tips

Keep secrets in the ignored `.env`; document new variables in `.env.example` and validate them in `src/lib/env.ts`. Process environment variables take precedence over `.env`. Avoid committing credentials or generated `dist/` output.
