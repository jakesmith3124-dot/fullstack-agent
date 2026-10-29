#!/usr/bin/env bash
# Runs the migrations and the RLS test suite against a throwaway local Postgres.
# Needs the Postgres server binaries (initdb, pg_ctl). Usage: npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."

PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
DATA="$(mktemp -d)"
PORT="${TEST_PG_PORT:-54999}"
cleanup() { "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

if [ "$(id -u)" = "0" ]; then
  echo "Run this as a normal user (Postgres refuses to run as root)." >&2
  exit 1
fi

"$PG_BIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"$PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" start >/dev/null

PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -c "create database test"
"${PSQL[@]}" -d test -f supabase/tests/shim.sql
for f in supabase/migrations/*.sql; do
  "${PSQL[@]}" -d test -f "$f"
done
"${PSQL[@]}" -d test -f supabase/seed.sql
"${PSQL[@]}" -d test -f supabase/tests/rls.test.sql
echo "Database tests passed."
