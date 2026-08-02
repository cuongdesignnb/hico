#!/bin/sh
set -eu

DUMP_FILE="/backups/hico_backup_20260728.dump"

if [ ! -f "$DUMP_FILE" ]; then
  echo "[postgres-init] Dump file not found: $DUMP_FILE"
  exit 0
fi

echo "[postgres-init] Restoring HICO database from $DUMP_FILE"
pg_restore \
  --verbose \
  --username="$POSTGRES_USER" \
  --no-owner \
  --no-acl \
  --role="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  "$DUMP_FILE"

echo "[postgres-init] Restore completed"
