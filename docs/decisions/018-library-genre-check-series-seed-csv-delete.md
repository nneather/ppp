# 018 — Library genre CHECK, series seed, CSV delete-on-import

**Date:** 2026-05-07  
**Module:** library

## Built

- **`books_genre_check`** — Postgres CHECK on `books.genre` aligned with [`src/lib/types/library.ts`](src/lib/types/library.ts) `GENRES` (migration `20260507190000`).
- **16 series** idempotent inserts by abbreviation (migration `20260507190100`).
- **`needs_review_note` COMMENT** documenting CSV delete prefix (migration `20260507190200`).
- **Audit script** [`supabase/scripts/library_genre_stale_candidates.sql`](supabase/scripts/library_genre_stale_candidates.sql) for `General` / `Pastoral` rows before any rename migration.
- **CSV import** — [`LIBRARY_CSV_DELETE_ON_IMPORT_PREFIXES`](src/lib/library/server/books-csv.ts) + `softDelete` prepared op; preview/apply show delete counts.

## Decided

- **Soft-delete** duplicate rows on import (set `deleted_at`) rather than hard-delete, matching app conventions.
- **Legacy genres** `General` and `Pastoral` kept in CHECK + `GENRES` until owner renames rows after reviewing the audit query.

## Schema changes

- `20260507190000_library_books_genre_check.sql`
- `20260507190100_library_series_seed_review_import.sql`
- `20260507190200_library_books_needs_review_note_comment.sql`

## Carry-forward

- After `db push`, run `library_genre_stale_candidates.sql` in Studio; then optional `UPDATE` to `General Epistles` / `Pastoral Ministry` if desired (requires matching CHECK list).
