#!/usr/bin/env bash
# Restore smoke: invoicing pg_dump → scratch Postgres; profiles row seeded first.
#
#   dotenv -e .env.local -- bash scripts/backup-restore-verify/restore-smoke.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DB_URL="${BACKUP_DATABASE_URL:-${LIBRARY_DST_DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "Set BACKUP_DATABASE_URL or LIBRARY_DST_DATABASE_URL in .env.local" >&2
  exit 1
fi

WORK="$(mktemp -d)"
SCRATCH_CONTAINER="ppp-restore-smoke-$$"
SCRATCH_PORT=55432
SCRATCH_PASS="restore-smoke-local"
SCRATCH_URL="postgresql://postgres:${SCRATCH_PASS}@127.0.0.1:${SCRATCH_PORT}/postgres"

cleanup() {
  docker rm -f "$SCRATCH_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

INVOICING_TABLES=(clients client_rates time_entries invoices invoice_line_items)
invoicing_flags=()
for t in "${INVOICING_TABLES[@]}"; do
  invoicing_flags+=(-t "public.${t}")
done

echo "==> pg_dump invoicing tables..."
docker run --rm \
  -e "DATABASE_URL=$DB_URL" \
  -v "$WORK:/work" \
  postgres:17 \
  bash -c 'pg_dump -F c -f /work/invoicing.dump "$DATABASE_URL" '"$(printf '%q ' "${invoicing_flags[@]}")"

echo "==> Scratch Postgres on ${SCRATCH_PORT}..."
docker run -d --name "$SCRATCH_CONTAINER" \
  -e POSTGRES_PASSWORD="$SCRATCH_PASS" \
  -p "127.0.0.1:${SCRATCH_PORT}:5432" \
  postgres:17 >/dev/null

for _ in $(seq 1 30); do
  docker exec "$SCRATCH_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

echo "==> profiles schema + owner row (FK parent)..."
docker run --rm \
  -e "DATABASE_URL=$DB_URL" \
  -v "$WORK:/work" \
  postgres:17 \
  bash -c 'pg_dump --schema-only -f /work/profiles.sql "$DATABASE_URL" -t public.profiles'

docker cp "$WORK/profiles.sql" "$SCRATCH_CONTAINER:/profiles.sql"
docker exec "$SCRATCH_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -f /profiles.sql

OWNER_ID=$(docker run --rm -e "DATABASE_URL=$DB_URL" postgres:17 \
  psql "$DB_URL" -tA -c "SELECT id FROM public.profiles WHERE deleted_at IS NULL LIMIT 1")
if [[ -z "$OWNER_ID" ]]; then
  echo "No live profiles row in prod" >&2
  exit 1
fi

# profiles dump is DDL only; copy the live row from prod (data-only slice)
docker run --rm \
  -e "DATABASE_URL=$DB_URL" \
  -v "$WORK:/work" \
  postgres:17 \
  bash -c "pg_dump --data-only -f /work/profiles-data.sql \"\$DATABASE_URL\" -t public.profiles --where \"id = '$OWNER_ID'\""

docker cp "$WORK/profiles-data.sql" "$SCRATCH_CONTAINER:/profiles-data.sql"
docker exec "$SCRATCH_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -f /profiles-data.sql

echo "==> pg_restore invoicing dump..."
docker cp "$WORK/invoicing.dump" "$SCRATCH_CONTAINER:/invoicing.dump"
docker exec "$SCRATCH_CONTAINER" pg_restore -d postgres /invoicing.dump

CLIENT_COUNT=$(docker exec "$SCRATCH_CONTAINER" psql -U postgres -tA \
  -c "SELECT count(*) FROM public.clients WHERE deleted_at IS NULL")

echo "==> Restore smoke OK: ${CLIENT_COUNT} live client row(s); profiles id ${OWNER_ID}"
