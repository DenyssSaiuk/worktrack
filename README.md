# WorkTrack

Self-hosted employee time tracking and productivity analytics for office environments.

> **Privacy notice.** WorkTrack is workplace monitoring software. Before deploying it, the operating organization is responsible for complying with local labor law and data protection regulations (Ukrainian Law on Personal Data Protection, GDPR where applicable, and any equivalent local frameworks). Employees must be informed and their consent recorded with timestamp and policy version. See `docs/privacy-policy.md` for a customizable template.

## Architecture at a glance

| Component | Stack | Purpose |
| --- | --- | --- |
| `apps/agent` | Tauri 2, Rust, React + TS | Desktop agent — login, monitoring, tray, offline buffer |
| `apps/extension` | MV3, TypeScript, Vite | Browser extension — tab/URL tracking, talks to the agent via Native Messaging |
| `apps/backend` | Node 20, Fastify, Prisma | Ingest API, auth, BullMQ workers, WebSockets |
| `apps/dashboard` | Next.js 14, Tailwind, shadcn/ui | Admin & manager UI |
| `packages/shared` | TypeScript, Zod | Shared types/schemas |
| `packages/database` | Prisma | Schema, migrations, seeds |
| `packages/config` | ESLint, tsconfig, prettier | Shared lint/format configs |

Data store: PostgreSQL 16 + TimescaleDB for activity events; Redis 7 for sessions, queues, and rate limiting.

## Prerequisites

- Node.js 20 LTS or newer
- pnpm 9 or newer
- Rust stable (only required for `apps/agent`)
- Docker + Docker Compose

## Quick start (development)

```bash
# 1. Install workspace dependencies
pnpm install

# 2. Bring up infra (Postgres + TimescaleDB, Redis, Mailhog)
docker compose up -d

# 3. Apply database migrations and seed
pnpm db:migrate
pnpm db:seed

# 4. Run all apps in dev mode (Turbo orchestrates)
pnpm dev
```

The dashboard runs at <http://localhost:3000>, the API at <http://localhost:4000>.

After seeding, sign in to the dashboard with the credentials printed by the seed script (look for `Admin login:` in the output).

## First admin user

The seed script (`packages/database/prisma/seed.ts`) creates one organization, one admin, two managers, and ten employees for development. For production, see `docs/deployment.md` — there is an `admin:create` CLI command to bootstrap the first user.

## Deployment

Production deployment uses `docker-compose.prod.yml` behind nginx + Let's Encrypt. Full instructions, including backup/restore and TLS setup, live in `docs/deployment.md`.

## Project status

All nine phases complete. See `CLAUDE.md` § "Current state" for the
phase-by-phase summary, and the `docs/` directory for `architecture.md`,
`deployment.md`, `privacy-policy.md`, `security.md`, and `api.md`.

## License

TBD — to be selected before first external release.
