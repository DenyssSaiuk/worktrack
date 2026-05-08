#!/usr/bin/env bash
# WorkTrack backup script. Captures Postgres + MinIO + secrets into a
# timestamped archive. Run from the host where docker-compose.prod.yml is
# checked out.
#
# Usage:
#   sudo ./scripts/backup.sh /var/backups/worktrack
#
# The resulting archive is encrypted with age (https://age-encryption.org)
# using the recipient configured in BACKUP_AGE_RECIPIENT. Secrets never leave
# the box in plaintext.
set -euo pipefail

DEST=${1:-/var/backups/worktrack}
mkdir -p "$DEST"
TS=$(date -u +%Y%m%dT%H%M%SZ)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo ">> dumping Postgres"
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump --clean --if-exists -U "${POSTGRES_USER:-worktrack}" "${POSTGRES_DB:-worktrack}" \
  > "$WORK/postgres.sql"

echo ">> snapshotting MinIO"
docker compose -f docker-compose.prod.yml exec -T minio \
  mc mirror --quiet /data "$WORK/minio"

echo ">> bundling secrets"
mkdir -p "$WORK/secrets"
cp -a secrets/* "$WORK/secrets/"

echo ">> tar"
TARFILE="$DEST/worktrack-$TS.tar.zst"
tar --use-compress-program=zstd -cf "$TARFILE" -C "$WORK" .

if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  echo ">> encrypting via age"
  age -r "$BACKUP_AGE_RECIPIENT" -o "$TARFILE.age" "$TARFILE"
  rm "$TARFILE"
  TARFILE="$TARFILE.age"
fi

echo "wrote $TARFILE"
