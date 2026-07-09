#!/usr/bin/env bash
# Restore smoke: dump invoicing (+ profiles) and library tables → scratch Postgres 17.
# Proves the backup shape restores (pre-data + data; post-data skipped — no auth/roles bootstrap).
#
#   npx dotenv -e .env.local -- bash scripts/backup-restore-verify/restore-smoke.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DB_URL="${BACKUP_DATABASE_URL:-${LIBRARY_DST_DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "Set BACKUP_DATABASE_URL or LIBRARY_DST_DATABASE_URL in .env.local" >&2
  exit 1
fi

# Docker on macOS cannot reach Supabase Direct (IPv6-only). Prefer Session Pooler.
if [[ "$DB_URL" == *"db."*".supabase.co"* ]]; then
  echo "==> Direct URI detected — deriving Session Pooler URL for Docker dumps..."
  POOLER_URL="$(npx dotenv -e .env.local -e .env -- npx tsx scripts/backup-restore-verify/derive-pooler-url.ts)"
  if [[ -z "$POOLER_URL" ]]; then
    echo "Could not derive pooler URL. Set BACKUP_DATABASE_URL to Session pooler (port 5432)." >&2
    exit 1
  fi
  DB_URL="$POOLER_URL"
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

# Same -t lists as .github/workflows/backup.yml (invoicing includes profiles).
INVOICING_TABLES=(profiles clients client_rates time_entries invoices invoice_line_items)
LIBRARY_TABLES=(
  books people series publishers bible_books ancient_texts
  book_authors book_bible_coverage book_ancient_coverage book_topics
  essays essay_authors scripture_references
)

invoicing_flags=()
for t in "${INVOICING_TABLES[@]}"; do
  invoicing_flags+=(-t "public.${t}")
done

library_flags=()
for t in "${LIBRARY_TABLES[@]}"; do
  library_flags+=(-t "public.${t}")
done

echo "==> pg_dump invoicing (+ profiles)..."
docker run --rm \
  -e "DATABASE_URL=$DB_URL" \
  -v "$WORK:/work" \
  postgres:17 \
  bash -c 'pg_dump -F c -f /work/invoicing.dump "$DATABASE_URL" '"$(printf '%q ' "${invoicing_flags[@]}")"

echo "==> pg_dump library..."
docker run --rm \
  -e "DATABASE_URL=$DB_URL" \
  -v "$WORK:/work" \
  postgres:17 \
  bash -c 'pg_dump -F c -f /work/library.dump "$DATABASE_URL" '"$(printf '%q ' "${library_flags[@]}")"

echo "==> Scratch Postgres on ${SCRATCH_PORT}..."
docker run -d --name "$SCRATCH_CONTAINER" \
  -e POSTGRES_PASSWORD="$SCRATCH_PASS" \
  -p "127.0.0.1:${SCRATCH_PORT}:5432" \
  postgres:17 >/dev/null

for _ in $(seq 1 30); do
  docker exec "$SCRATCH_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
if ! docker exec "$SCRATCH_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
  echo "Scratch Postgres did not become ready" >&2
  exit 1
fi

# Restore helper: pre-data (CREATE TABLE) + data only.
# Skip post-data (FKs, triggers, RLS, indexes) — avoids auth.users / write_audit_log deps.
# pg_restore may exit 1 on non-fatal notices; we assert row counts instead.
restore_archive() {
  local archive="$1"
  local label="$2"
  docker cp "$WORK/$archive" "$SCRATCH_CONTAINER:/$archive"
  echo "==> pg_restore pre-data ($label)..."
  docker exec "$SCRATCH_CONTAINER" \
    pg_restore -U postgres --section=pre-data --no-owner --no-privileges -d postgres "/$archive" \
    || true
  echo "==> pg_restore data ($label)..."
  docker exec "$SCRATCH_CONTAINER" \
    pg_restore -U postgres --section=data --no-owner --no-privileges -d postgres "/$archive" \
    || true
}

restore_archive invoicing.dump invoicing

CLIENT_COUNT=$(docker exec "$SCRATCH_CONTAINER" psql -U postgres -tA \
  -c "SELECT count(*) FROM public.clients WHERE deleted_at IS NULL")
PROFILE_COUNT=$(docker exec "$SCRATCH_CONTAINER" psql -U postgres -tA \
  -c "SELECT count(*) FROM public.profiles WHERE deleted_at IS NULL")

if [[ "${CLIENT_COUNT:-0}" -lt 1 ]]; then
  echo "Invoicing restore failed: expected ≥1 live clients, got '${CLIENT_COUNT}'" >&2
  exit 1
fi
if [[ "${PROFILE_COUNT:-0}" -lt 1 ]]; then
  echo "Invoicing restore failed: expected ≥1 live profiles, got '${PROFILE_COUNT}'" >&2
  exit 1
fi

echo "==> Invoicing OK: ${CLIENT_COUNT} live client(s), ${PROFILE_COUNT} live profile(s)"

restore_archive library.dump library

BOOK_COUNT=$(docker exec "$SCRATCH_CONTAINER" psql -U postgres -tA \
  -c "SELECT count(*) FROM public.books WHERE deleted_at IS NULL")
AUTHOR_COUNT=$(docker exec "$SCRATCH_CONTAINER" psql -U postgres -tA \
  -c "SELECT count(*) FROM public.book_authors")
SCRIPTURE_COUNT=$(docker exec "$SCRATCH_CONTAINER" psql -U postgres -tA \
  -c "SELECT count(*) FROM public.scripture_references WHERE deleted_at IS NULL")

if [[ "${BOOK_COUNT:-0}" -lt 1 ]]; then
  echo "Library restore failed: expected ≥1 live books, got '${BOOK_COUNT}'" >&2
  exit 1
fi
if [[ "${AUTHOR_COUNT:-0}" -lt 1 ]]; then
  echo "Library restore failed: expected ≥1 book_authors, got '${AUTHOR_COUNT}'" >&2
  exit 1
fi
if [[ "${SCRIPTURE_COUNT:-0}" -lt 1 ]]; then
  echo "Library restore failed: expected ≥1 live scripture_references, got '${SCRIPTURE_COUNT}'" >&2
  exit 1
fi

echo "==> Library OK: ${BOOK_COUNT} books, ${AUTHOR_COUNT} book_authors, ${SCRIPTURE_COUNT} scripture_references"
echo "==> Restore smoke OK"
