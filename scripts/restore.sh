#!/usr/bin/env bash
# Restore from a backup archive produced by scripts/backup.sh.
#
# Usage:
#   sudo ./scripts/restore.sh /var/backups/worktrack/worktrack-<ts>.tar.zst[.age]
#
# Pre-requisite: docker compose stack already running, but databases empty.
set -euo pipefail

ARCHIVE=${1:?path to backup archive}
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

if [[ "$ARCHIVE" == *.age ]]; then
  echo ">> decrypting"
  age -d -i "${BACKUP_AGE_IDENTITY:?set BACKUP_AGE_IDENTITY}" "$ARCHIVE" > "$WORK/restore.tar.zst"
  ARCHIVE="$WORK/restore.tar.zst"
fi

tar --use-compress-program=zstd -xf "$ARCHIVE" -C "$WORK"

echo ">> restoring Postgres"
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "${POSTGRES_USER:-worktrack}" -d "${POSTGRES_DB:-worktrack}" < "$WORK/postgres.sql"

echo ">> restoring MinIO"
docker compose -f docker-compose.prod.yml cp "$WORK/minio/." minio:/data/
docker compose -f docker-compose.prod.yml exec -T minio mc mb --ignore-existing local/worktrack || true

echo ">> restoring secrets"
cp -a "$WORK/secrets/." secrets/

echo "restore complete — restart services to pick up new secrets"
