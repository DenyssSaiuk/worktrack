# WorkTrack

Self-hosted employee time tracking and productivity analytics for office environments.

> **Privacy notice.** WorkTrack is workplace monitoring software. Before deploying it, the operating organization is responsible for complying with local labor law and data protection regulations (Ukrainian Law on Personal Data Protection, GDPR where applicable, and any equivalent local frameworks). Employees must be informed and their consent recorded with timestamp and policy version. See `docs/privacy-policy.md` for a customizable template.

## Architecture at a glance

| Component | Stack | Purpose |
| --- | --- | --- |
| `apps/dashboard` | Next.js 14, Tailwind, shadcn/ui | Web UI for admins, managers **and workers** (`/workday` page = Start/Stop Workday). Workers register and sign in entirely on the web — no desktop install required. |
| `apps/extension` | MV3, TypeScript | Browser extension — signs in with the worker's email/password, pushes `tab_focus` events straight to the backend over HTTPS while a workday is active. |
| `apps/backend` | Node 20, Fastify, Prisma | Ingest API, auth, BullMQ workers, WebSockets. Web flow uses `POST /api/v1/me/{workday,heartbeat,events}` with the same user JWT the dashboard uses. |
| `apps/agent` | Tauri 2, Rust, React + TS | _Optional_ desktop agent. Kept in the repo for legacy / OS-level monitoring (process names, idle, screenshots), but is not part of the default deployment any more. |
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
- **Rust stable** — only required if you also build the optional Tauri
  desktop agent at `apps/agent/`. The default web-only flow doesn't need
  it. Install via [rustup.rs](https://rustup.rs/) if you do.
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

Open <http://localhost:7330> and sign in:

- as **admin** (`admin@acme.test`) → land on **Live** with sidebar
  Workday, Live, Team, Review, Reports, Rules, Users, Settings.
- as **manager** (`alice.manager@acme.test`) → land on **Live** with
  sidebar Workday, Live, Team, Review, Reports.
- as **employee** (`employee1@acme.test`) → land on **My Workday** with
  only Workday + Sign out in the sidebar.

> **Tip.** `pnpm dev` runs everything through Turbo in a single
> terminal. The two-terminal split above is just more pleasant when you
> only need the web stack.

---

## For a worker — the web-only onboarding

Workers do **not** install a desktop app. Everything happens in the browser:

1. Open the dashboard at <http://localhost:7330> and sign in with the
   credentials the admin gave you (e.g. `employee1@acme.test`).
2. You land on **My Workday**. Click **Start Workday** — the dashboard
   creates a session via `POST /api/v1/me/workday/start` and a live timer
   starts. The page also begins sending a heartbeat every 30 s so your
   manager sees you as online.
3. (Recommended) Install the **WorkTrack browser extension** so tab
   focus events also feed into the session — see § 7 below. Without the
   extension only the dashboard tab can heartbeat, so the activity
   timeline will only show the moments your workday started and stopped.
4. Click **Stop Workday** at the end of the day. The session is closed
   server-side, the extension stops sending, nothing is collected until
   the next Start.

There is no enrollment token, no Tauri install, no native messaging
bridge — the worker's web cookie / JWT is the credential.

### 7. Install the browser extension (optional but recommended)

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

The popup asks for **email**, **password**, and the **server URL**
(default `http://localhost:7340`). Sign in once and the extension owns
its own JWT — it doesn't depend on the dashboard cookies. The popup then
exposes the same Start / Stop Workday button as the dashboard, so a
worker can manage their workday from either side.

For production rollout via Group Policy / Intune, see
`apps/extension/README.md` and `docs/policies/`.

### Optional: the legacy desktop agent

The Tauri agent at `apps/agent/` is still in the repo for deployments
that need OS-level signals (process names, idle detection, manager-
triggered screenshots). Bring it up with:

```bash
pnpm --filter @worktrack/agent build
pnpm dev:agent
```

It uses the old enrollment-token flow (admin issues a token, worker
pastes it into the agent). It is **not required** for the web-only
deployment and is **not** part of the default getting-started path.

---

## Day-to-day worker flow

1. Open <http://localhost:7330> in the morning and sign in.
2. On **My Workday**, click **Start Workday**.
3. Do your work. The dashboard timer ticks; if the extension is
   installed it pushes tab events as you focus tabs.
4. End of day: **Stop Workday**. The session closes and tracking halts.

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

## Screenshots

Demo screenshots of the running app (admin, manager, and employee views,
plus the browser-extension popup) live under
[`docs/screenshots/`](docs/screenshots/). Highlights:

- `01-login.png` — shared sign-in page
- `02-live.png` … `09-settings.png` — admin / manager dashboard pages
- `11-employee-workday-idle.png` / `12-employee-workday-active.png` —
  worker's web view, before and after **Start Workday**
- `14-extension-popup-signed-out.png` / `15-extension-popup-active.png`
  — browser-extension popup, login form and active tracking state

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
