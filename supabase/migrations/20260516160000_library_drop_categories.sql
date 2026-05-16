-- Decision 022: collapse genre + category into a single content-type taxonomy.
-- Drops `books.primary_category_id`, `book_categories`, and `categories`.
-- Genre (closed enum, schema CHECK) becomes the only content-type axis.
-- Physical shelving lives on `books.shelving_location` (TEXT, untouched).
--
-- Pre-migration audit (2026-05-16):
--   - 1,350 live books
--   - 284 books carry primary_category_id (only 2 distinct categories used:
--     Biblical Studies = 257, Languages & Reference = 27)
--   - 285 book_categories junction rows (degenerate ~1:1 with primary)
--   - 0 books have genre IS NULL AND primary_category_id IS NOT NULL
--     → category carries no signal that genre doesn't already capture
--   - 0 books use shelving_location (kept as the escape hatch anyway)
--
-- Snapshot for reversibility: docs/library_pre_category_drop_snapshot.md.
-- Audit log retains historical category-table rows (append-only; unaffected).
--
-- Code-side purge (Phase 3a in the cleanup plan) shipped immediately prior;
-- no supabase-js SELECT names these columns/tables at the time of apply.

ALTER TABLE books DROP COLUMN IF EXISTS primary_category_id;
DROP TABLE IF EXISTS book_categories;
DROP TABLE IF EXISTS categories;
