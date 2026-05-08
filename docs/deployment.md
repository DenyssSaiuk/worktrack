# WorkTrack — Production deployment

This guide covers a single-VPS deployment that supports up to ~500 agents.
For larger fleets, scale the backend + workers horizontally behind the
nginx-proxy, point them at managed Postgres/Redis/object storage, and
remove MinIO from the compose file.

## 1. Prerequisites on the VPS

- Docker Engine 24+ and the Compose plugin (`docker compose version`)
- A public IPv4 address with ports 80 + 443 open
- DNS records pointing at that IP for **two** hostnames:
  - `worktrack.example.com` (dashboard)
  - `api.worktrack.example.com` (backend API)
- ~10 GB disk free in `/var/lib/docker` for the initial volumes

## 2. Bootstrap secrets

```bash
git clone https://github.com/your-org/worktrack
cd worktrack
mkdir -p secrets
chmod 700 secrets

# RS256 keypair for JWT signing
openssl genrsa -out secrets/jwt-private.pem 2048
openssl rsa -in secrets/jwt-private.pem -pubout -out secrets/jwt-public.pem
chmod 600 secrets/jwt-private.pem
chmod 644 secrets/jwt-public.pem

# Master KEK for screenshot/PII encryption (32 bytes, base64)
openssl rand -base64 32 > secrets/master-kek.txt
chmod 600 secrets/master-kek.txt

cp .env.example .env
# Edit .env — see § 3.
```

## 3. Required environment variables

In `.env`:

| Variable | Notes |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | DB credentials |
| `REDIS_PASSWORD` | required in prod, never the dev default |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | rotate from MinIO defaults |
| `MASTER_KEK_BASE64` | paste the contents of `secrets/master-kek.txt` |
| `DASHBOARD_HOST_PUBLIC` | e.g. `worktrack.example.com` |
| `BACKEND_HOST_PUBLIC` | e.g. `api.worktrack.example.com` |
| `BACKEND_URL_PUBLIC` | e.g. `https://api.worktrack.example.com` |
| `DASHBOARD_ORIGIN` | same as the dashboard URL incl. scheme |
| `ACME_EMAIL` | who Let's Encrypt should contact |

## 4. First boot

```bash
docker compose -f docker-compose.prod.yml --env-file .env pull
docker compose -f docker-compose.prod.yml --env-file .env up -d

# Run migrations + create the first admin
docker compose -f docker-compose.prod.yml exec backend \
  node node_modules/@worktrack/database/dist/migrate.js

docker compose -f docker-compose.prod.yml exec backend \
  node dist/scripts/admin-create.js \
    --email admin@your-org.com \
    --password "$(openssl rand -base64 24)"
```

Sign in to `https://worktrack.example.com` with the admin credentials.

## 5. nginx-proxy + Let's Encrypt

The compose stack already includes:

- `nginxproxy/nginx-proxy` — generates per-vhost nginx configs from the
  `VIRTUAL_HOST` and `VIRTUAL_PORT` labels on the backend / dashboard
  containers
- `nginxproxy/acme-companion` — issues + renews TLS certs from Let's Encrypt
  using the `LETSENCRYPT_HOST` label

`docker/nginx/proxy.conf` adds HSTS, X-Frame-Options DENY, X-Content-Type-
Options nosniff, Referrer-Policy and Permissions-Policy headers globally.

## 6. Backups

`scripts/backup.sh` produces a single `.tar.zst[.age]` containing:

- pg_dump of the database
- a MinIO mirror of the screenshot bucket
- the `secrets/` directory

Recommended cadence:

```cron
0 3 * * * /opt/worktrack/scripts/backup.sh /var/backups/worktrack
0 4 * * 0 rsync -a /var/backups/worktrack/ remote:worktrack-backups/
```

Encrypt the archive at rest by setting `BACKUP_AGE_RECIPIENT` (an
[age](https://age-encryption.org) recipient) before running the script.

## 7. Restore

`scripts/restore.sh <path-to-archive>` will:

1. Decrypt with age (if the archive ends in `.age`)
2. `psql` the Postgres dump back into the running container
3. Mirror the MinIO content
4. Replace `secrets/`

After restore, restart the stack so the backend + workers reread their
secrets:

```bash
docker compose -f docker-compose.prod.yml restart backend workers dashboard
```

## 8. Health & monitoring

- `GET /health` returns `200 {status:"ok"}` from the backend always.
- `GET /ready` checks DB + Redis connectivity.
- The dashboard responds at `/login`.
- nginx-proxy exposes its own access logs to Docker's logging driver.

If you run Prometheus, scrape the backend's `/metrics` endpoint (TODO: not
yet implemented; tracked in `docs/runbooks/observability.md`).

## 9. Rotating the master KEK

1. Mint a new KEK and add it as `MASTER_KEK_BASE64_NEXT` in `.env`.
2. Run a one-shot rotation job (`docker compose run --rm backend node
   dist/scripts/rotate-kek.js`) which re-encrypts every screenshot with the
   new KEK and bumps `keyId` to `v2`.
3. Promote `MASTER_KEK_BASE64_NEXT` to `MASTER_KEK_BASE64`, restart the
   stack.
4. Revoke the old key from your secret manager.

(Rotation script is on the Phase 9 follow-up list — design pattern is
`encryption.keyId` lookup driven, so the schema already supports it.)
