# WorkTrack — security review checklist

Last reviewed: 2026-05-08 (Phase 9). This document captures the controls
that exist today and the gaps a security audit should close before a public
launch.

## Controls in place

- **Auth:** RS256 JWT with short-lived (15 min) access tokens. Refresh
  tokens (7 days) stored hashed in Redis with single-use rotation — replay
  of an old refresh token is rejected and the entire chain invalidated.
- **Password storage:** bcrypt cost 12. Tested in
  `apps/backend/test/unit/password.test.ts`.
- **Rate limiting:** `@fastify/rate-limit` on `/api/v1/auth/login` (5
  attempts per 15 min per IP+route), `/api/v1/auth/refresh` (30/min), and
  `/api/v1/auth/agent/enroll` (30/h).
- **CORS:** dashboard origin is the only allowed origin. Browser direct
  fetches to the backend are blocked; everything goes through Next.js's
  `/api/proxy/*` route.
- **Cookies:** access + refresh tokens live in `httpOnly`, `SameSite=Lax`,
  `Secure` (in prod) cookies. JS in the dashboard cannot read them.
- **CSP / hardening headers:** `nginx-proxy` injects HSTS, X-Frame-Options
  DENY, X-Content-Type-Options nosniff, Referrer-Policy and Permissions-
  Policy via `docker/nginx/proxy.conf`. The Next dashboard sets
  `poweredByHeader: false`.
- **Encryption at rest:** screenshots are encrypted with AES-256-GCM using
  a per-organization key derived via HKDF from the master KEK. The master
  KEK is loaded from env at boot; the schema captures `encryption.keyId` so
  rotation is supported (rotation script tracked).
- **Audit log:** every state-changing request and every administrative
  action writes an `AuditLog` row with actor id, IP, user-agent, and
  metadata. The agent's `tab_focus`/`window_focus` ingest is `x-audit-skip`
  to keep the table small.
- **Tamper resistance:** the Tauri agent uses the OS keychain for the
  long-lived agent JWT (`keyring` crate). Single-instance lock prevents
  duplicate processes; auto-start on login is wired through
  `tauri-plugin-autostart`.
- **TimescaleDB retention:** raw events older than 90 days (configurable per
  org) are deleted by the retention policy (`prisma/sql/timescale`). Daily
  summaries remain for trend reporting.

## Privacy invariants (tested or assertable)

1. The agent never collects data outside the user's scheduled work hours
   (gated by `AppState::is_collecting`).
2. The agent never collects data while a private session is active (only
   the boundaries are recorded).
3. Screenshots are only created when a configured trigger fires, never on a
   timer.
4. PII columns (consent IP, audit IP, screenshots) are encrypted or
   pseudonymised at rest.
5. The retention worker actually deletes events — TimescaleDB
   `add_retention_policy` is enabled in production.

## Open follow-ups

- [ ] Implement `GET /api/v1/me/data-export` (GDPR Article 15 — schema
      already captures everything; need a route handler).
- [ ] Implement `DELETE /api/v1/me` for right-to-erasure (Article 17).
- [ ] Master KEK rotation script (`scripts/rotate-kek.ts`) + `keyId`
      bump-and-walk over screenshots.
- [ ] Playwright E2E covering: login, agent enroll → ingest → see in
      dashboard, Excel export job lifecycle, screenshot review.
- [ ] OWASP ZAP automated scan on every release.
- [ ] WebSocket `?token=` query parameter: rotate to a per-connection
      ephemeral token rather than reusing the access token (lower blast
      radius if logs leak).
- [ ] Migrate to Argon2id for password hashing once we have a migration
      story (bcrypt is fine for now but Argon2 is the modern default).

## Threat model assumptions

- The host VPS is single-tenant and runs only the WorkTrack stack.
- `secrets/jwt-private.pem` and `MASTER_KEK_BASE64` are protected by the
  host's filesystem permissions and Docker secrets respectively. An
  attacker with root on the host has full data access — out of scope.
- The browser extension trusts the desktop agent (via Native Messaging) for
  authentication; an attacker with code execution on the user's machine can
  forge events as that user — out of scope (this is what tamper-resistance
  controls are best-effort defense for).
- Network adversaries are mitigated by TLS 1.3 only; HTTP redirects to
  HTTPS via Let's Encrypt.
