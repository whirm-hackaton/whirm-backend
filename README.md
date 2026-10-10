# whirm-backend

Socle back-end Node.js 24, TypeScript, Hono et PostgreSQL/Drizzle, inspiré de Kreios API.

## Lancement local

Prérequis : Node.js 24, pnpm 11.28.5 et Docker Compose. Exécuter les commandes depuis `whirm-backend/`.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait db
pnpm dev
```

API : http://localhost:3000/health. Documentation OpenAPI : `/doc`. Interface Scalar : `/ui`.
Le fichier `.env` configure le serveur et la connexion PostgreSQL locale sur le port 5433.
Les variables déjà définies dans le processus ont priorité sur `.env`.

## Organisation

- `src/routes/` : handlers HTTP et déclarations OpenAPI.
- `src/services/` : future logique métier.
- `src/schemas/` : schémas Zod et types HTTP.
- `src/middleware/` : futurs middlewares.
- `src/lib/env.ts` : chargement et validation de la configuration.
- `src/db/` : pool PostgreSQL et schéma Drizzle.
- `src/app.ts` : fabrique d'application, sans serveur ni connexion à la base.
- `src/index.ts` : démarrage HTTP.

La route `/health` retourne `{ "status": "ok" }` sans vérifier PostgreSQL.
Les tables métier et les routes auth/wallet seront ajoutées ensuite.

## Commandes

| Commande                            | Usage                                            |
| ----------------------------------- | ------------------------------------------------ |
| `pnpm dev`                          | Serveur avec rechargement                        |
| `pnpm build`                        | Compilation dans `dist/`, sans tests             |
| `pnpm start`                        | Lancement du code compilé                        |
| `pnpm typecheck`                    | Typage du code et des tests                      |
| `pnpm lint`                         | Vérification ESLint                              |
| `pnpm format` / `pnpm format:check` | Formatage / vérification Prettier                |
| `pnpm test`                         | Tests Vitest sans base de données                |
| `pnpm db:generate`                  | Génération des migrations après ajout des tables |
| `pnpm db:migrate`                   | Application des migrations existantes            |
| `pnpm db:studio`                    | Exploration de la base                           |

Le schéma est volontairement vide : aucune migration initiale n'est nécessaire.
Les migrations générées seront conservées dans `drizzle/` et versionnées.

Pour vérifier la connexion locale après le lancement de PostgreSQL :

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1"'
```

Pour arrêter PostgreSQL tout en conservant ses données : `docker compose down`.
