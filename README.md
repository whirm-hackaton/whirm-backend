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
Les routes d’authentification sont disponibles sous `/auth`, les métadonnées wallet sous `/wallets`.

## Commandes

| Commande                            | Usage                                            |
| ----------------------------------- | ------------------------------------------------ |
| `pnpm dev`                          | Serveur avec rechargement                        |
| `pnpm build`                        | Compilation dans `dist/`, sans tests             |
| `pnpm start`                        | Lancement du code compilé                        |
| `pnpm typecheck`                    | Typage du code et des tests                      |
| `pnpm lint`                         | Vérification ESLint                              |
| `pnpm format` / `pnpm format:check` | Formatage / vérification Prettier                |
| `pnpm test`                         | Tests Vitest, dont intégration PostgreSQL        |
| `pnpm db:generate`                  | Génération des migrations après ajout des tables |
| `pnpm db:migrate`                   | Application des migrations existantes            |
| `pnpm db:studio`                    | Exploration de la base                           |

Le schéma contient `users`, `sessions`, `wallets` et `wallet_verifications`. Les migrations générées sont conservées dans `drizzle/` et versionnées.

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

## Métadonnées wallet

Appliquer les migrations avec `pnpm db:migrate`. Toutes les routes nécessitent le cookie de session et renvoient `Cache-Control: no-store`.

- `POST /wallets` : `{ "address": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "chainId": 84532 }`. Retourne `{ "wallet": { "id": "…", "userId": "…", "address": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "chainId": 84532, "status": "candidate", "createdAt": "…", "verifiedAt": null } }`, avec `201` à la création puis `200` pour les répétitions.
- `GET /wallets` : `{ "wallets": [...] }`, uniquement les wallets du client connecté, par date de création puis identifiant ; liste vide si aucun wallet.
- `GET /wallets/verified` : `{ "wallet": ... }` pour le seul wallet vérifié du client, ou `404` s’il n’en a pas.
- `GET /wallets/{id}` : `{ "wallet": ... }`, ou `404` pour un wallet absent ou appartenant à autrui.

Les adresses EVM sont normalisées en minuscules ; seule Base Sepolia (`84532`) est acceptée. Les corps sont stricts : `userId`, `status`, clés privées et autres champs supplémentaires sont refusés. Session absente, expirée ou révoquée : `401` ; corps ou identifiant invalide : `400` ; origine POST interdite : `403` ; adresse déjà associée à un autre client : `409`, sans divulgation de son identité.

Un client peut avoir plusieurs wallets candidats ou non vérifiés, mais au plus un vérifié. Une adresse sur une chaîne appartient à un seul client. La DB garantit ces contraintes, y compris lors de demandes concurrentes. La création cryptographique est côté client : une adresse candidate ne prouve aucun contrôle. Aucune de ces routes ne promeut un wallet en `verified` ; challenges et preuves réelles restent HS-37. `wallet_verifications` prépare uniquement le stockage des empreintes de challenges.

Exemple local avec les comptes fictifs existants :

```bash
curl -c /tmp/whirm-alice.cookies -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.test","password":"Hackaton2026!"}' http://localhost:3000/auth/login
curl -b /tmp/whirm-alice.cookies -H 'Content-Type: application/json' \
  -d '{"address":"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","chainId":84532}' http://localhost:3000/wallets
curl -b /tmp/whirm-alice.cookies http://localhost:3000/wallets
curl -b /tmp/whirm-alice.cookies http://localhost:3000/wallets/verified
# 404 : aucune preuve vérifiée dans ce périmètre.
curl -c /tmp/whirm-bob.cookies -H 'Content-Type: application/json' \
  -d '{"email":"bob@example.test","password":"Hackaton2026!"}' http://localhost:3000/auth/login
curl -b /tmp/whirm-bob.cookies -H 'Content-Type: application/json' \
  -d '{"address":"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","chainId":84532}' http://localhost:3000/wallets
# 409 : cette adresse candidate appartient déjà à Alice.
curl -b /tmp/whirm-bob.cookies http://localhost:3000/wallets
# {"wallets":[]}
```

Les tests wallet vérifient les routes, l’isolation Alice/Bob, les contraintes et les créations concurrentes dans un schéma PostgreSQL temporaire. Les mises à jour directes en `verified` dans les tests servent exclusivement à vérifier les contraintes et les lectures ; elles ne représentent pas une preuve cryptographique.
