# WorkTrack — Project Context for Claude Code

## What this project is
Self-hosted employee time tracking and productivity analytics system for office environments. Four components: desktop agent (Tauri 2 + Rust + React), browser extension (Manifest V3), backend API (Fastify + PostgreSQL/TimescaleDB + Redis), and admin dashboard (Next.js 14). Data flow: agent and extension collect activity events → agent batches and reports over HTTPS → Fastify ingest API → PostgreSQL/TimescaleDB → Next.js dashboard renders timelines, productivity scores, and Excel exports for managers and admins.

## Repo layout
- `apps/agent` — Tauri 2 desktop agent (Rust core, React UI for login/status, system tray)
- `apps/extension` — browser extension (Chromium + Firefox via separate manifests)
- `apps/backend` — Fastify API + BullMQ workers
- `apps/dashboard` — Next.js 14 admin panel
- `packages/shared` — Zod schemas, TypeScript types, constants shared by backend/dashboard/extension
- `packages/database` — Prisma schema, migrations, and seed scripts
- `packages/config` — shared eslint, tsconfig, prettier configs
- `docker/` — Postgres, Redis, Nginx configs for compose
- `docs/` — architecture, deployment, privacy policy, API reference

## Tech stack quick ref
- Runtime: Node 20 LTS, Rust stable, pnpm 9+
- Frameworks: Fastify 4, Next.js 14 (App Router), Tauri 2, React 18
- Data: PostgreSQL 16 + TimescaleDB, Redis 7, Prisma 5
- Validation: Zod (shared via `packages/shared`)
- Build: Turbo + pnpm workspaces
- Tests: Vitest (unit), Playwright (e2e), `cargo test` (Rust)

## Critical commands
- `pnpm install` — install all workspace deps
- `pnpm dev` — run all apps in dev mode (turbo)
- `pnpm dev:backend` — backend only
- `pnpm dev:dashboard` — dashboard only
- `pnpm dev:agent` — Tauri agent
- `pnpm test` — all tests
- `pnpm lint` — lint across workspaces
- `pnpm typecheck` — tsc across workspaces
- `pnpm db:migrate` — apply Prisma migrations
- `pnpm db:seed` — seed dev data
- `docker compose up -d` — start postgres, redis, timescaledb

## Environment variables
See `.env.example` files in each app. Never commit real `.env`. The dashboard reads `NEXT_PUBLIC_*` only for non-secrets; everything sensitive stays server-side.

## Coding conventions
- TypeScript strict mode everywhere. No `any` without `// eslint-disable-next-line` and a justification comment.
- All API requests/responses validated with Zod schemas from `packages/shared`.
- All DB access goes through Prisma. No raw SQL except in TimescaleDB-specific aggregation queries (clearly marked).
- Errors: throw typed errors, never strings. Centralized error handler maps to HTTP responses.
- Logging: Pino with request-id correlation. Never `console.log` in production code paths.
- Secrets: only in env vars, never in code or commits.

## Privacy invariants (these are tested)
1. The agent never collects data outside the user's scheduled work hours.
2. The agent never collects data while a private session is active (only the start/stop events of the private session are recorded).
3. Screenshots are only created when a configured trigger fires, never on a timer.
4. PII columns (email, IP) are encrypted at rest.
5. Data retention job runs daily; events older than `retention_days` are deleted.

## Current state
- Phase 0 complete: monorepo skeleton, CLAUDE.md, lint/format configs, README, initial git commit.
- Phase 1 not yet started.

## Known issues / tech debt
- None yet.

## How to add a new event type
1. Add the type to `packages/shared/src/schemas/events.ts`
2. Update Prisma schema in `packages/database/prisma/schema.prisma`
3. Generate migration: `pnpm db:migrate dev --name add_<event_type>`
4. Add ingest handler in `apps/backend/src/routes/ingest`
5. Update agent in `apps/agent/src-tauri/src/monitor`
6. Add aggregation in worker if needed
7. Surface in dashboard if relevant
