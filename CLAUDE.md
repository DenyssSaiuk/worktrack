# WorkTrack — Project Context for Claude Code

## What this project is

Self-hosted employee time tracking and productivity analytics system for
office environments. Four components: desktop agent (Tauri 2 + Rust +
React), browser extension (Manifest V3), backend API (Fastify +
PostgreSQL/TimescaleDB + Redis), and admin dashboard (Next.js 14). Data
flow: agent and extension collect activity events → agent batches and
reports over HTTPS → Fastify ingest API → PostgreSQL/TimescaleDB →
Next.js dashboard renders timelines, productivity scores, screenshot
review queue, and Excel exports for managers and admins.

## Repo layout

- `apps/agent` — Tauri 2 desktop agent (Rust core, React UI, system tray,
  SQLite buffer, sync loop, OS keychain)
- `apps/extension` — MV3 browser extension (Chromium + Firefox manifests,
  native-messaging bridge to the agent)
- `apps/backend` — Fastify API + BullMQ workers + WebSocket
- `apps/dashboard` — Next.js 14 App Router admin panel
- `packages/shared` — Zod schemas / TypeScript types / constants
- `packages/database` — Prisma schema, migrations, seed
- `packages/config` — shared eslint / tsconfig / prettier
- `docker/` — Postgres init.sql, nginx hardening rules
- `scripts/` — backup.sh, restore.sh
- `docs/` — architecture, deployment, privacy, security, api reference

## Tech stack quick ref

- Runtime: Node 20 LTS, Rust stable, pnpm 9+
- Frameworks: Fastify 4, Next.js 14 (App Router), Tauri 2, React 18
- Data: PostgreSQL 16 + TimescaleDB, Redis 7, Prisma 5
- Validation: Zod (shared via `packages/shared`)
- Build: Turbo + pnpm workspaces
- Tests: Vitest (unit + integration), `cargo check` (Rust)
- AI (optional): `@anthropic-ai/sdk` calling `claude-sonnet-4-6`

## Critical commands

- `pnpm install` — install all workspace deps
- `pnpm dev` — run all apps in dev mode (turbo)
- `pnpm dev:backend` / `pnpm dev:dashboard` / `pnpm dev:agent`
- `pnpm test` — vitest across the workspace (12 backend tests, 3 shared)
- `pnpm lint` / `pnpm typecheck` / `pnpm format` / `pnpm format:check`
- `pnpm db:migrate` — Prisma migrate dev
- `pnpm db:seed` — seed: 1 org, 1 admin, 2 managers, 10 employees
- `docker compose up -d` — Postgres + TimescaleDB + Redis + Mailhog + MinIO
- `docker compose -f docker-compose.prod.yml --env-file .env up -d` —
  production stack with nginx-proxy + acme-companion (Let's Encrypt)

## Environment variables

See `.env.example` files in each app. Never commit real `.env`. The
dashboard uses `NEXT_PUBLIC_*` only for non-secrets; everything sensitive
stays server-side.

## Coding conventions

- TypeScript strict mode everywhere. No `any` without justification.
- Zod schemas from `packages/shared` validate every API surface.
- All DB access goes through Prisma. Raw SQL is allowed only for
  TimescaleDB-specific aggregation/retention (kept in `prisma/sql/`).
- Errors via typed `AppError`. Centralized error handler maps to HTTP.
- Logging: Pino with request-id correlation. No `console.log` in prod
  paths.
- Rust: `#![deny(unsafe_code)]`, errors via `thiserror` / `AgentError`,
  no `unwrap()` outside tests/main bootstrap.
- No default exports, except where Next.js / Vitest / Tauri require them
  (override per-package in eslint).

## Privacy invariants (enforced or testable)

1. The agent never collects data outside the user's scheduled work
   hours. (`AppState::is_collecting` gate; integration test queues no
   events while `workdayActive=false`.)
2. The agent never collects data while a private session is active —
   only the start/stop boundaries.
3. Screenshots are only created when a configured trigger fires, never
   on a timer.
4. PII columns and screenshots are encrypted at rest with per-org
   AES-256-GCM keys derived via HKDF from the master KEK.
5. Data retention: TimescaleDB `add_retention_policy` deletes raw events
   after `Organization.retentionDays` (default 90, max 365).

See `docs/security.md` for the full controls list and follow-ups.

## Current state — Phases 0-9 complete

| Phase | Status | What landed |
| --- | --- | --- |
| 0 — Init | done | monorepo scaffold, configs, README |
| 1 — Foundation | done | shared configs, Prisma schema, docker-compose, Husky, CI |
| 2 — Backend auth | done | Fastify + JWT (RS256, single-use refresh rotation), users CRUD, audit, rate-limit, 7 unit + 3 integration tests |
| 3 — Ingest pipeline | done | enroll → session → batched events (idempotent) → heartbeat; daily aggregation BullMQ worker with cron; TimescaleDB hypertable + retention + compression; k6 load script |
| 4 — Desktop agent | done | Tauri 2 + Rust monitor / SQLite buffer / sync / tray / keychain; React UI (enroll + status); cross-platform compile-clean |
| 5 — Browser extension | done | MV3 (Chromium + Firefox), tab focus → native-messaging → agent; offline queue; build script for both targets; Group Policy templates |
| 6 — Admin dashboard | done | Next.js 14 App Router + Tailwind; httpOnly cookie auth + middleware; Live (WebSocket), Team, User detail (Recharts), Reports, Rules, Users, Settings; backend routes for activity / rules / settings / WS |
| 7 — Excel exports | done | exceljs worker (5 sheets + screenshot index), MinIO storage, signed URLs, WebSocket progress |
| 8 — Screenshots + AI | done | encrypted multipart upload, BullMQ Anthropic-backed worker, manager review queue UI; opt-in per org |
| 9 — Hardening | done | production docker-compose with nginx-proxy + acme-companion + secrets; per-app Dockerfiles; backup/restore scripts; deployment, privacy, security, architecture, API docs |

## Known gaps / follow-ups

- Trigger engine in the Rust agent (which condition fires a screenshot
  capture) is deferred — the upload + AI + review pipeline lands first
  so a real trigger can be added without server-side changes.
- `GET /api/v1/me/data-export` (GDPR Art. 15) and `DELETE /api/v1/me`
  (Art. 17) need route handlers — schema already captures everything.
- Master KEK rotation script (`scripts/rotate-kek.ts`).
- Playwright E2E covering login → enroll → ingest → dashboard → export.
- WebSocket auth: rotate the `?token=` to a per-connection ephemeral
  token rather than reusing the access token.
- Tauri MSI/NSIS/DMG production builds need real artwork + signing
  certs; placeholder icons committed so cargo can compile today.

## How to add a new event type

1. Add the type to `packages/shared/src/schemas/events.ts`
2. Update `packages/database/prisma/schema.prisma`
3. `pnpm db:migrate dev --name add_<event_type>`
4. Add ingest handler in `apps/backend/src/routes/ingest`
5. Update agent in `apps/agent/src-tauri/src/monitor`
6. Surface in dashboard if relevant
