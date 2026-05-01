-- =============================================================================
-- Library smoke-test data CLEANUP
-- Filed: 2026-04-30 (Session 4)
-- Updated: 2026-04-30 — added explicit junction deletes (no ON DELETE CASCADE
--   on book_authors / book_categories / scripture_references / etc.)
--
-- Hard-deletes the 15 smoke-seed books shipped in `library_smoke_data.sql` so
-- they don't pollute Pass 1 import counts or the title+author dedup fallback.
-- The smoke books exist solely as Session 1 sanity rows; once Pass 1 lands
-- 1,330 real books, the smoke data has served its purpose.
--
-- HOW TO APPLY:
--   psql "$(supabase status --output env | grep DB_URL | cut -d= -f2)" \
--     -f supabase/seed/library_smoke_data_cleanup.sql
--   OR paste into Studio SQL editor.
--
-- Idempotent: re-running is a no-op (rows already gone).
-- People rows (Bauckham, Wright, etc.) are intentionally NOT deleted — they
-- may collide with real authors in the import; the importer's findOrCreatePerson
-- B14 dedup will reuse them.
-- =============================================================================

BEGIN;

-- Resolve the smoke book ids once into a temp table so subsequent DELETEs
-- target the same set without re-querying / risking drift.
CREATE TEMP TABLE _smoke_book_ids ON COMMIT DROP AS
SELECT id FROM public.books
WHERE title IN (
	'Jesus and the Eyewitnesses',
	'The Resurrection of the Son of God',
	'The Book of Exodus',
	'Greek Grammar Beyond the Basics',
	'Institutes of the Christian Religion',
	'The Gospel According to John',
	'Romans',
	'Luke 1:1–9:50',
	'Luke 9:51–24:53',
	'An Introduction to the New Testament',
	'Biblical Theology of the Old and New Testaments',
	'Lord Jesus Christ',
	'The New Testament and the People of God',
	'Jesus and the Victory of God',
	'A New Testament Biblical Theology'
);

-- Delete junctions + child rows referencing those books.
-- Order doesn't matter among siblings; do all of them before the parent.
DELETE FROM public.book_authors          WHERE book_id IN (SELECT id FROM _smoke_book_ids);
DELETE FROM public.book_categories       WHERE book_id IN (SELECT id FROM _smoke_book_ids);
DELETE FROM public.book_bible_coverage   WHERE book_id IN (SELECT id FROM _smoke_book_ids);
DELETE FROM public.book_ancient_coverage WHERE book_id IN (SELECT id FROM _smoke_book_ids);
DELETE FROM public.book_topics           WHERE book_id IN (SELECT id FROM _smoke_book_ids);
DELETE FROM public.scripture_references  WHERE book_id IN (SELECT id FROM _smoke_book_ids);
-- essays.parent_book_id has no smoke rows (Session 1.5 didn't create any),
-- but include defensively for future safety.
DELETE FROM public.essays                WHERE parent_book_id IN (SELECT id FROM _smoke_book_ids);

-- Now the parent rows.
DELETE FROM public.books                 WHERE id IN (SELECT id FROM _smoke_book_ids);

COMMIT;

-- Verify count + remaining smoke rows.
SELECT COUNT(*) AS books_remaining FROM public.books WHERE deleted_at IS NULL;
SELECT COUNT(*) AS smoke_rows_left FROM public.books
WHERE title IN (
	'Jesus and the Eyewitnesses', 'The Resurrection of the Son of God', 'The Book of Exodus',
	'Greek Grammar Beyond the Basics', 'Institutes of the Christian Religion',
	'The Gospel According to John', 'Romans', 'Luke 1:1–9:50', 'Luke 9:51–24:53',
	'An Introduction to the New Testament', 'Biblical Theology of the Old and New Testaments',
	'Lord Jesus Christ', 'The New Testament and the People of God',
	'Jesus and the Victory of God', 'A New Testament Biblical Theology'
);
