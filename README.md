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

## Ports used (development)

All host ports are deliberately picked in the **7xxx** range so they don't
collide with whatever else you may already be running locally (Next/Vite on
3000, Rails on 4000, system Postgres on 5432, system Redis on 6379, MinIO on
9000, etc).

| Service | Host port | Container port | Open in browser |
| --- | ---: | ---: | --- |
| **Admin dashboard** (Next.js) | **7330** | — | <http://localhost:7330> |
| **Backend API** (Fastify) | **7340** | — | <http://localhost:7340/health> |
| **PostgreSQL + TimescaleDB** | **7432** | 5432 | `postgres://worktrack:worktrack@localhost:7432/worktrack` |
| **Redis** | **7379** | 6379 | `redis://localhost:7379` |
| **MinIO** API (S3-compatible) | **7900** | 9000 | <http://localhost:7900> |
| **MinIO** console | **7901** | 9001 | <http://localhost:7901> (login `worktrack` / `worktrack-dev-secret`) |
| **Mailhog** SMTP | **7025** | 1025 | use as outbound SMTP |
| **Mailhog** web UI | **7826** | 8025 | <http://localhost:7826> |

If you previously had WorkTrack running on the old ports (3000 / 4000 /
5432 / 6379 / 9000 / …), copy the new `.env.example` files over your `.env`
and run `docker compose down` once so the host-port bindings get re-created.

---

## Getting started — the diploma-friendly version

The whole stack (backend, dashboard, Postgres, Redis, MinIO, Mailhog) can be
brought up on a single machine in about 5 minutes. Follow the steps in order.

### 0. Prerequisites

Install once, system-wide:

- **Node.js 20 LTS** (`node --version` should print `v20.x`)
- **pnpm 9 or newer** — `npm install -g pnpm`
- **Docker Desktop** with Docker Compose
- **Rust stable** (only required if you intend to run the desktop agent —
  install via [rustup.rs](https://rustup.rs/))
- **OpenSSL** (already present on macOS / Linux; on Windows install via
  [Git for Windows](https://git-scm.com/download/win) which bundles it)

### 1. Clone & install dependencies

```bash
git clone <your-fork-url> worktrack
cd worktrack
pnpm install
```

### 2. Create your local `.env`

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp packages/database/.env.example packages/database/.env
```

The example files already point at the 7xxx ports listed above — no edits
needed for a vanilla dev setup.

### 3. Generate the JWT keys and master encryption key

```bash
mkdir -p secrets
openssl genrsa -out secrets/jwt-private.pem 2048
openssl rsa  -in secrets/jwt-private.pem -pubout -out secrets/jwt-public.pem

# 32-byte master key, base64-encoded. Paste the output into MASTER_KEK_BASE64
# in both .env and apps/backend/.env.
openssl rand -base64 32
```

### 4. Start the infrastructure containers

```bash
docker compose up -d
docker compose ps     # all four containers should report 'healthy' or 'running'
```

This brings up Postgres (TimescaleDB), Redis, MinIO and Mailhog. Wait ~10
seconds the first time so Postgres can finish initializing.

### 5. Apply migrations and seed demo data

```bash
pnpm db:migrate
pnpm db:seed
```

The seed prints the demo credentials at the end — by default:

```
Admin login:    admin@acme.test    / WorkTrack!Dev2026
Manager logins: alice.manager@acme.test, bob.manager@acme.test / WorkTrack!Dev2026
Employee logins: employee1@acme.test … employee10@acme.test (same password)
```

The seed also generates **two weeks of realistic activity events** for every
employee — productive tools (VS Code, GitHub, Jira), neutral (Slack, Gmail)
and distracting (YouTube, Facebook, TikTok) — so every page in the dashboard
has something to show.

### 6. Run the backend and the dashboard

In one terminal:

```bash
pnpm dev:backend
# → backend listening on http://localhost:7340
```

In a second terminal:

```bash
pnpm dev:dashboard
# → dashboard ready on http://localhost:7330
```

Open <http://localhost:7330> and sign in with the admin credentials above.
You should land on the Live page with a sidebar of Team, Reports, Rules,
Users, Review, Settings.

> **Tip.** `pnpm dev` runs everything (backend + dashboard + agent + ext)
> through Turbo in a single terminal. The two-terminal split above is just
> more pleasant when you only need the web stack.

---

## For a worker — installing the time-logging tools

There are **two pieces** a regular employee installs on their workstation:

1. The **WorkTrack desktop agent** (Tauri app). It is the only thing that
   talks to the server — it owns auth, the offline buffer, and the tray
   "Start / Stop workday" controls.
2. The **WorkTrack browser extension** (Chrome / Edge or Firefox), which
   forwards tab-focus events to the agent over native messaging. The
   extension is optional but recommended — without it the server only sees
   process / window-title events from the desktop agent and not the active
   browser URL.

### 7a. Build and install the desktop agent

```bash
# from the repo root
pnpm --filter @worktrack/agent build      # produces a release bundle
# during development you can also use:
pnpm dev:agent                            # opens the Tauri window in dev mode
```

The agent's first window is the **enrollment screen**. Fill in:

- **Server URL** → `http://localhost:7340` (already pre-filled)
- **Enrollment token** → generated by an admin (see "Issuing an enrollment
  token" below)

After enrollment the agent docks into the system tray. The employee clicks
**Start Workday** to begin collecting. Outside scheduled hours, or in a
private session, the agent collects nothing.

### 7b. Build and install the browser extension

```bash
pnpm --filter @worktrack/extension build
# outputs:
#   dist-chrome/   ← load via chrome://extensions  → Developer mode → Load unpacked
#   dist-firefox/  ← about:debugging → This Firefox → Load Temporary Add-on
```

**Chrome / Edge / Brave:**

1. Open `chrome://extensions/` (or `edge://extensions/`).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select `apps/extension/dist-chrome/`.
4. Pin the extension to the toolbar so the popup is reachable.

**Firefox:**

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**
3. Select `apps/extension/dist-firefox/manifest.json`.

For production rollout via Group Policy / Intune, see
`apps/extension/README.md` and `docs/policies/`.

### 7c. Issuing an enrollment token (admin task)

1. Sign in to the dashboard at <http://localhost:7330> as `admin@acme.test`.
2. Navigate to **Users**, find the employee, click **Issue enroll token**.
3. Copy the one-time token and hand it (over a secure channel) to the
   employee — they paste it into the agent's enrollment screen.

Tokens are single-use and expire after a short window.

---

## Day-to-day worker flow

1. **Log in once** to the desktop agent (via enrollment token, then it
   stays signed in).
2. Each morning the agent shows **Start Workday** in its tray menu. The
   moment you click it, monitoring begins (and not before).
3. When you take a private break, click **Start Private Session** — the
   agent records only the start/stop boundary, never the contents.
4. End of day: **Stop Workday**. The agent flushes any buffered events.

The employee never needs to interact with the dashboard.

---

## Useful commands

```bash
pnpm dev              # everything (Turbo)
pnpm dev:backend      # Fastify, hot reload
pnpm dev:dashboard    # Next.js, hot reload
pnpm dev:agent        # Tauri agent in dev mode
pnpm test             # vitest across the workspace
pnpm typecheck        # tsc --noEmit everywhere
pnpm lint             # eslint everywhere
pnpm db:migrate       # prisma migrate dev
pnpm db:seed          # repopulate demo data (idempotent)
pnpm db:reset         # nuke + re-migrate + re-seed
docker compose up -d  # start infra
docker compose down   # stop infra (data preserved in named volumes)
```

---

## Deployment

Production deployment uses `docker-compose.prod.yml` behind nginx + Let's
Encrypt. Full instructions, including backup/restore and TLS setup, live in
[`docs/deployment.md`](docs/deployment.md).

## Project status

All nine phases complete. See `CLAUDE.md` § "Current state" for the
phase-by-phase summary, and the `docs/` directory for `architecture.md`,
`deployment.md`, `privacy-policy.md`, `security.md`, and `api.md`.

## License

TBD — to be selected before first external release.
