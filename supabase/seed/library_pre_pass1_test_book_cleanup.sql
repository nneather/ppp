-- =============================================================================
-- Pre-Pass-1 cleanup of leftover hand-entered test books
-- Filed: 2026-04-30 (Session 4)
--
-- Hard-deletes the 6 ad-hoc test books that survived
-- `library_smoke_data_cleanup.sql` (those targeted only the 15 Session 1
-- smoke-seed titles). These rows were entered through the UI during Sessions
-- 1-3 hands-on testing and are not authoritative — clearing them now keeps
-- the post-Pass-1 state to "1,330 imported books, period" rather than
-- "1,330 imported + 6 orphans + 1 enriched".
--
-- The single UPDATE candidate "Julius Caesar" (id a39d6cc8…) is intentionally
-- LEFT in place — it matches a spreadsheet row by title+author and will be
-- enriched in-place by Pass 1 (publisher, year, pages, ISBN). That's the
-- desired Pass 2-style behavior, captured here so the apply diff stays clean.
--
-- HOW TO APPLY:
--   psql "$(supabase status --output env | grep DB_URL | cut -d= -f2)" \
--     -f supabase/seed/library_pre_pass1_test_book_cleanup.sql
--   OR paste into Studio SQL editor.
--
-- Idempotent: re-running is a no-op (rows already gone).
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _test_book_ids ON COMMIT DROP AS
SELECT id FROM public.books
WHERE id IN (
	'23c29de4-f10b-434f-983d-7f6b913fc99f',  -- "Testing"
	'16c5e06e-da9d-46f8-ba8b-4b9b12cd8df7',  -- "Grounded in Heaven"
	'a415698e-fbe0-4d23-9ac7-f5710d65be6f',  -- "IVP Bible Background"
	'83239541-eab5-4050-a1aa-884b8d9ac18a',  -- "IVP Greek"
	'4cc9b232-9061-44e3-8cec-1025e7a09ef7',  -- "IVP Hebrew"
	'0236bf82-17c8-4695-b3f2-3e17876e74e2'   -- "Romeo and Juliet"
);

-- Junction + child cleanup (no ON DELETE CASCADE on these FKs, per Surprise #8 in
-- docs/decisions/008-library-pass-1-import.md).
DELETE FROM public.book_authors          WHERE book_id IN (SELECT id FROM _test_book_ids);
DELETE FROM public.book_categories       WHERE book_id IN (SELECT id FROM _test_book_ids);
DELETE FROM public.book_bible_coverage   WHERE book_id IN (SELECT id FROM _test_book_ids);
DELETE FROM public.book_ancient_coverage WHERE book_id IN (SELECT id FROM _test_book_ids);
DELETE FROM public.book_topics           WHERE book_id IN (SELECT id FROM _test_book_ids);
DELETE FROM public.scripture_references  WHERE book_id IN (SELECT id FROM _test_book_ids);
DELETE FROM public.essays                WHERE parent_book_id IN (SELECT id FROM _test_book_ids);

-- Now the parent rows.
DELETE FROM public.books                 WHERE id IN (SELECT id FROM _test_book_ids);

COMMIT;

-- Verify: should be 1 (just Julius Caesar) before Pass 1.
SELECT COUNT(*) AS books_remaining FROM public.books WHERE deleted_at IS NULL;

-- Verify the targeted ids are gone.
SELECT COUNT(*) AS test_rows_left FROM public.books
WHERE id IN (
	'23c29de4-f10b-434f-983d-7f6b913fc99f',
	'16c5e06e-da9d-46f8-ba8b-4b9b12cd8df7',
	'a415698e-fbe0-4d23-9ac7-f5710d65be6f',
	'83239541-eab5-4050-a1aa-884b8d9ac18a',
	'4cc9b232-9061-44e3-8cec-1025e7a09ef7',
	'0236bf82-17c8-4695-b3f2-3e17876e74e2'
);
