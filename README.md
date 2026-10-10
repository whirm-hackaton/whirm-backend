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
Les routes d’authentification sont disponibles sous `/auth`. Les routes wallet seront ajoutées ensuite.

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

Le schéma contient les tables `users` et `sessions`. Les migrations générées sont conservées dans `drizzle/` et versionnées.

Pour vérifier la connexion locale après le lancement de PostgreSQL :

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1"'
```

Pour arrêter PostgreSQL tout en conservant ses données : `docker compose down`.

## Authentification de démonstration

Après le démarrage de PostgreSQL :

```bash
pnpm db:migrate
pnpm db:seed
```

Le seeder crée Alice (`alice@example.test`) et Bob (`bob@example.test`) avec le mot de passe fictif `Hackaton2026!`. Il peut être relancé : les comptes existants restent inchangés. Il refuse de s’exécuter lorsque `NODE_ENV=production`.

- `POST /auth/login` : corps JSON `{ "email": "alice@example.test", "password": "Hackaton2026!" }`, réponse `{ "user": { "id": "…", "email": "alice@example.test", "displayName": "Alice" } }`.
- `GET /auth/me` : même représentation de l’utilisateur, ou `401` sans session valide.
- `POST /auth/logout` : révoque la session courante, efface le cookie et retourne `204`, même sans session.

Le frontend doit envoyer `credentials: 'include'` avec ses requêtes `fetch`. Son origine doit figurer dans `CORS_ORIGINS` ; les POST avec une origine différente sont refusés. Le frontend et l’API doivent appartenir au même site (localhost sur deux ports, ou des sous-domaines du même domaine).

Le cookie `session` est HttpOnly, SameSite=Lax et valable 24 heures, sans prolongation automatique. En production, il est Secure et nécessite HTTPS. Chaque connexion crée une session indépendante. Le serveur conserve seulement une empreinte SHA-256 du jeton aléatoire de 32 octets. Les mots de passe sont dérivés avec scrypt (`N=131072`, `r=8`, `p=1`), un sel aléatoire de 16 octets et une empreinte de 64 octets.

Ces comptes sont destinés à la démonstration. L’inscription, la récupération des mots de passe et la limitation des tentatives ne font pas partie de cette version.

Les tests nécessitent PostgreSQL, configuré dans `.env`. Le parcours d’authentification, la migration et le seeder sont vérifiés sur une base réelle à chaque exécution :

```bash
docker compose up -d --wait db
pnpm test
```

Ce test crée un schéma temporaire isolé et le supprime à la fin ; l’utilisateur PostgreSQL doit disposer des permissions correspondantes.
