#!/usr/bin/env bash
# Generate an RS256 JWT key pair into ../../secrets/.
# Run once per environment. The .env JWT_*_PATH variables point at the result.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SECRETS_DIR="$ROOT/secrets"

mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

PRIV="$SECRETS_DIR/jwt-private.pem"
PUB="$SECRETS_DIR/jwt-public.pem"

if [ -f "$PRIV" ] && [ -f "$PUB" ]; then
  echo "JWT keys already exist at $SECRETS_DIR — refusing to overwrite. Delete them manually if you really want to rotate."
  exit 0
fi

openssl genrsa -out "$PRIV" 2048
openssl rsa -in "$PRIV" -pubout -out "$PUB"
chmod 600 "$PRIV"
chmod 644 "$PUB"

echo "Generated:"
echo "  $PRIV"
echo "  $PUB"

if [ -z "${MASTER_KEK_BASE64:-}" ]; then
  KEK_FILE="$SECRETS_DIR/master-kek.txt"
  if [ ! -f "$KEK_FILE" ]; then
    openssl rand -base64 32 > "$KEK_FILE"
    chmod 600 "$KEK_FILE"
    echo "Wrote master KEK to $KEK_FILE — copy it into MASTER_KEK_BASE64 in your .env."
  fi
fi
