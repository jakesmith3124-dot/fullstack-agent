#!/usr/bin/env bash
# Off-site backup of the database (everything except Supabase's own internals) and the uploaded photos.
# Supabase Pro also takes daily backups automatically; this is an extra copy you control.
# Usage: SUPABASE_DB_URL=postgresql://... SUPABASE_URL=https://xyz.supabase.co SUPABASE_SERVICE_ROLE_KEY=... bash scripts/backup.sh
set -euo pipefail
: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL (Project settings → Database → Connection string, session mode)}"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
OUT="backups/$STAMP"
mkdir -p "$OUT"
pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges --schema=public --schema=auth --format=custom --file "$OUT/database.dump"
echo "✓ Database saved to $OUT/database.dump"
if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  node --import tsx scripts/backup-storage.mts "$OUT/storage"
fi
echo "Store the backups folder somewhere safe and encrypted. It contains children's personal data."
