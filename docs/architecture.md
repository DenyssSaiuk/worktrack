# WorkTrack — architecture overview

```
┌──────────────┐  HTTPS    ┌────────────────┐  TimescaleDB
│ Tauri Agent  │──────────▶│  Fastify API   │──▶  Postgres
│  (Rust+React)│           │  (apps/backend)│      hypertable
└──────┬───────┘           └────────┬───────┘
       │ Native Messaging           │ BullMQ
       ▼                            ▼
┌──────────────┐           ┌────────────────┐
│   Browser    │           │   Workers      │  Redis
│  Extension   │           │  - aggregate   │
│   (MV3 SW)   │           │  - excel       │
└──────────────┘           │  - ai-analyze  │
                           └────────┬───────┘
                                    │ S3 / MinIO
                                    ▼
┌──────────────────────────────────────────┐
│         Next.js admin dashboard          │
│         (apps/dashboard, App Router)     │
│   - Live (WebSocket)                     │
│   - Team / User detail (Recharts)        │
│   - Reports (BullMQ + signed URL)        │
│   - Rules / Users / Settings             │
│   - Screenshot review (AES-256-GCM)      │
└──────────────────────────────────────────┘
```

## Data flow

1. **Agent monitor** polls the active window + idle timer every second
   (`apps/agent/src-tauri/src/monitor`). Events are appended to a local
   SQLite buffer.
2. **Agent sync** flushes batches every 30 s to `/api/v1/ingest/events`. A
   60 s heartbeat keeps `Device.lastSeenAt` fresh and broadcasts an
   `online: true` over the dashboard's WebSocket.
3. **Browser extension** observes tab/window focus, drops query strings,
   and sends a `tab_focus` event to the agent via Native Messaging. The
   agent buffers and syncs along with its own events.
4. **Backend** writes to a TimescaleDB hypertable on `(sessionId, timestamp,
   clientEventId)`; retention + compression policies prune chunks.
5. **Daily aggregation worker** runs at 00:05 UTC and produces
   `DailySummary` rows per user (worked / idle / private / productive /
   neutral / distracting minutes plus top apps & sites).
6. **Excel export worker** materialises a 5-sheet workbook into MinIO and
   returns a signed URL via WebSocket.
7. **Screenshot pipeline** (opt-in per org, manager-requested only): agent
   captures → multipart upload → backend encrypts with HKDF-derived org key
   → MinIO. Manager dashboard `/review` shows the queue. Activity
   classification relies on the rich text we already collect (process name
   + window title + browser domain + page title), so screenshots are a
   forensics tool rather than a default data stream.

## Privacy gates

- Agent only collects when **enrolled AND workdayActive AND
  !inPrivateSession**. The gate is in `AppState::is_collecting`; outside it,
  the monitor loop tick is a no-op.
- Screenshots are never timer-driven. Triggers are explicit and
  org-configured (currently a stub on the agent — server side ready).
- Encryption: AES-256-GCM; per-org key via HKDF-SHA256 with a stable
  `keyId` so the master KEK can be rotated without re-encryption.
- Retention: TimescaleDB `add_retention_policy` plus a configurable
  `Organization.retentionDays`. Daily summaries are kept indefinitely.

## Why the choices

- **Tauri 2** over Electron: 5–10× smaller binaries, Rust core for
  resource-bounded monitoring loops, modern web view for the tray UI.
- **Fastify** over Express: ~2× throughput on the ingest hot path, built-in
  schema validation, mature plugin ecosystem (jwt, rate-limit, multipart,
  websocket).
- **TimescaleDB hypertable** for activity events: query performance for
  per-user-per-day ranges + automatic retention/compression. Keeps Postgres
  as the only OLTP store.
- **BullMQ + Redis** for queues: durable, scriptable, with cron support
  (`upsertJobScheduler`).
- **Next.js 14 App Router** for the dashboard: SSR-with-cookies fits the
  httpOnly auth model; React Server Components keep the bundle small;
  `middleware.ts` handles redirect-on-no-cookie cleanly.
- **MinIO** for self-hosted S3 compatibility: same SDK as AWS, swap with
  managed S3 when scaling out.
- **No AI / LLM dependency**: window/tab titles plus the process name and
  domain are sufficient to classify activity via productivity rules. AI
  screenshot analysis was specced as a fallback but skipped — it adds
  privacy risk and operating cost without unlocking real classification
  the rules engine can't already cover.

## Component map

| Path | Purpose |
| --- | --- |
| `apps/agent` | Tauri 2 desktop agent |
| `apps/extension` | MV3 browser extension |
| `apps/backend` | Fastify API + BullMQ workers |
| `apps/dashboard` | Next.js admin panel |
| `packages/shared` | Zod schemas, constants |
| `packages/database` | Prisma schema + seed |
| `packages/config` | Shared eslint / tsconfig / prettier |
| `docker/` | Postgres init.sql, nginx hardening rules |
| `scripts/` | backup.sh, restore.sh |
| `docs/` | architecture, deployment, privacy, security |
