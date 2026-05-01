-- =============================================================================
-- books.import_match_type — Open Library enrichment provenance
-- Filed: 2026-05-01 (Session 5.5 — Review Queue UI)
--
-- Records which Open Library match-type the row was enriched with at import
-- time:
--   - title+author : OL returned a match on both title AND first-author
--                    last_name. Highest confidence.
--   - title-only   : OL returned a match on title only — author didn't match.
--                    Risk of wrong-edition metadata; auto-flagged for review.
--   - no-match     : OL returned nothing. No enrichment merged into the row.
--
-- NULL values are intentional: the BDAG ADDITIONS row never went through OL
-- enrichment, and any future hand-created books (UI / barcode / Pass-2 inserts
-- where enrichment couldn't run) get NULL too.
--
-- Drives the `?match_type=title-only|no-match` slice on /library/review so the
-- review queue can drain the high-risk OL matches independently of the no-OL
-- corpus. Backfilled post-Pass-1 from `enriched_library.csv` via
-- `scripts/library-import/patch-import-match-type.ts`.
--
-- Field is spreadsheet-owned per decision 007 — Pass 2 will refresh it from
-- the new enrichment run.
-- =============================================================================

ALTER TABLE public.books
	ADD COLUMN IF NOT EXISTS import_match_type TEXT
		CHECK (import_match_type IS NULL OR import_match_type IN ('title+author', 'title-only', 'no-match'));

CREATE INDEX IF NOT EXISTS idx_books_import_match_type
	ON public.books (import_match_type)
	WHERE deleted_at IS NULL;
