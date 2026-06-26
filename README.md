# Document Generation Platform

Enterprise Document Generation Platform — admins design document templates visually, users fill dynamic data, the platform renders pixel-perfect PDFs. See [docs/PRD/](docs/PRD/README.md) for the full architecture, and [docs/PRD/11-roadmap-and-phased-plan.md](docs/PRD/11-roadmap-and-phased-plan.md) for the phase plan this codebase follows.

**Status:** Phase 1 — Foundation (auth, RBAC, organizations, users) is implemented.

## Monorepo Layout

```
client/   React 19 + Vite + TypeScript SPA
server/   Express API (+ future BullMQ workers)
shared/   Zod schemas, constants, and types shared by client and server
docs/     PRD and architecture decision records
```

## Prerequisites

- Node.js 20+ (`.nvmrc` pins this)
- npm 10+ (workspaces-aware)
- A MongoDB Atlas connection string (free tier is enough for dev)
- An Upstash Redis connection string (free tier is enough for dev)

This project intentionally runs against cloud-hosted MongoDB Atlas + Upstash Redis in dev rather than local Docker containers — see the setup steps below.

## 1. Get a MongoDB Atlas connection string

1. Create a free cluster at https://www.mongodb.com/cloud/atlas
2. Create a database user (Database Access) and allow your IP (Network Access — or `0.0.0.0/0` for local dev only)
3. Copy the connection string from "Connect" → "Drivers": `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/document-platform`

## 2. Get an Upstash Redis connection string

1. Create a free Redis database at https://upstash.com
2. Copy the **TLS** connection string (`rediss://default:<password>@<endpoint>.upstash.io:6379`)

## 3. Install dependencies

```bash
npm install
```

This installs all three workspaces (`shared`, `server`, `client`) in one pass via npm workspaces.

## 4. Configure environment variables

```bash
cp server/.env.example server/.env
```

Fill in `MONGODB_URI` and `REDIS_URL` with the values from steps 1–2, and generate the two JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run that twice and paste the results into `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.

## 5. Build the shared package

The server and client both depend on `@platform/shared`'s compiled output:

```bash
npm run build:shared
```

Re-run this whenever you change anything under `shared/src` (or just leave `tsc --watch` running there during development).

## 6. Seed system roles

Seeds the four system roles (`admin`, `manager`, `editor`, `viewer`) with their permission sets:

```bash
npm run seed
```

## 7. Run the app

```bash
npm run dev:server   # API on http://localhost:4000
npm run dev:client    # SPA on http://localhost:5173 (proxies /api to the server)
```

Open http://localhost:5173/register to create your organization and first Admin user.

## Other useful commands

| Command             | Purpose                                                                      |
| ------------------- | ---------------------------------------------------------------------------- |
| `npm run lint`      | ESLint across all workspaces                                                 |
| `npm run format`    | Prettier write across the repo                                               |
| `npm run typecheck` | TypeScript project-wide type check                                           |
| `npm test`          | Server test suite (Vitest + an in-memory MongoDB, no Atlas needed for tests) |
| `npm run build`     | Production build of `shared`, `server`, and `client` in order                |

## API Documentation

Once the server is running, Swagger UI is served at http://localhost:4000/api/docs. Health checks: `GET /health` and `GET /health/ready`.
