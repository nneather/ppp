-- =============================================================================
-- books.needs_review_note — document CSV delete-on-import convention
--
-- App: src/lib/library/server/books-csv.ts — rows whose note starts with one
-- of LIBRARY_CSV_DELETE_ON_IMPORT_PREFIXES are soft-deleted on apply (skips
-- genre/series validation for that row).
-- =============================================================================

COMMENT ON COLUMN public.books.needs_review_note IS
	'Human + auto-generated review text. CSV import: a leading DELETE ON IMPORT prefix (see books-csv.ts) soft-deletes the row by id.';
