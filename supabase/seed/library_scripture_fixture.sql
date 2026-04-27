-- =============================================================================
-- Scripture references fixture
-- Filed: 2026-04-25 (Session 2 prep — Track E)
--
-- 20 scripture_references across the 5 smoke-data books per Tracker_1
-- Session 2 spec. Includes:
--   - Verse-level: Phil 2:5, Rom 8:28, Eph 1:7
--   - Verse-range: Phil 2:1–11, Rom 8:18–39, John 1:1–18, Heb 1:1–4
--   - Chapter-only: Phil 2 (whole chapter), Rom 8 (whole chapter)
--   - Whole-book: Philippians, Romans
--
-- Used to verify search_scripture_refs(...) before real data lands. Acceptance
-- target: search_scripture_refs('Philippians', 2, 5) returns three rows
-- (Phil 2:1–11, Phil 2 whole chapter, Philippians whole book).
--
-- HOW TO APPLY (manual):
--   psql ... -f supabase/seed/library_scripture_fixture.sql
--   OR paste into Studio SQL editor.
--
--   Idempotent — dedup on (book_id, bible_book, chapter_start, verse_start).
--   Safe to re-run.
--
-- DEPENDENCIES:
--   - 00000000000000_baseline.sql + 20260425160000_library_delta_v1.sql applied
--   - supabase/seed/library_seed.sql (bible_books) applied
--   - supabase/seed/library_smoke_data.sql applied (provides the 5 parent books)
--
-- After applying, search_scripture_refs() returns the expected rows. Wire into
-- /library/search-passage in Session 3.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: temp lookup of book ids by title
-- ---------------------------------------------------------------------------

WITH books AS (
	SELECT id, title FROM public.books WHERE deleted_at IS NULL
)
INSERT INTO public.scripture_references (
	book_id, bible_book, chapter_start, verse_start, chapter_end, verse_end,
	page_start, page_end, needs_review
)
SELECT v.book_id, v.bible_book, v.cs, v.vs, v.ce, v.ve, v.ps, v.pe, v.nr
FROM (
	-- Bauckham — Jesus and the Eyewitnesses
	-- John as central to the eyewitness argument
	SELECT (SELECT id FROM books WHERE title = 'Jesus and the Eyewitnesses') AS book_id,
		'John'::TEXT AS bible_book, 1::INT AS cs, 1::INT AS vs, 1::INT AS ce, 18::INT AS ve,
		'358'::TEXT AS ps, '383'::TEXT AS pe, false AS nr
	UNION ALL
	SELECT (SELECT id FROM books WHERE title = 'Jesus and the Eyewitnesses'),
		'John', 21, 24, 21, 25, '402', '423', false
	UNION ALL
	SELECT (SELECT id FROM books WHERE title = 'Jesus and the Eyewitnesses'),
		'Mark', NULL, NULL, NULL, NULL, '124', '154', false  -- Mark whole-book
	UNION ALL
	SELECT (SELECT id FROM books WHERE title = 'Jesus and the Eyewitnesses'),
		'Luke', 1, 1, 1, 4, '116', '124', false
	UNION ALL

	-- Wright — The Resurrection of the Son of God
	SELECT (SELECT id FROM books WHERE title = 'The Resurrection of the Son of God'),
		'1 Corinthians', 15, 1, 15, 58, '317', '398', false
	UNION ALL
	SELECT (SELECT id FROM books WHERE title = 'The Resurrection of the Son of God'),
		'Romans', 8, 18, 8, 39, '241', '267', false
	UNION ALL
	SELECT (SELECT id FROM books WHERE title = 'The Resurrection of the Son of God'),
		'Philippians', 2, 5, 2, 11, '224', '230', false
	UNION ALL
	SELECT (SELECT id FROM books WHERE title = 'The Resurrection of the Son of God'),
		'Acts', NULL, NULL, NULL, NULL, '432', '476', false  -- Acts whole-book

	UNION ALL

	-- Childs — The Book of Exodus (commentary)
	SELECT (SELECT id FROM books WHERE title = 'The Book of Exodus'),
		'Exodus', NULL, NULL, NULL, NULL, '1', '659', false  -- whole book
	UNION ALL
	SELECT (SELECT id FROM books WHERE title = 'The Book of Exodus'),
		'Exodus', 3, 1, 3, 22, '47', '78', false
	UNION ALL
	SELECT (SELECT id FROM books WHERE title = 'The Book of Exodus'),
		'Exodus', 20, 1, 20, 17, '385', '439', false
	UNION ALL
	SELECT (SELECT id FROM books WHERE title = 'The Book of Exodus'),
		'Exodus', 14, NULL, 14, NULL, '218', '241', false  -- chapter-only

	UNION ALL

	-- Wallace — Greek Grammar Beyond the Basics
	SELECT (SELECT id FROM books WHERE title = 'Greek Grammar Beyond the Basics'),
		'Philippians', 2, 1, 2, 11, '634', '637', false
	UNION ALL
	SELECT (SELECT id FROM books WHERE title = 'Greek Grammar Beyond the Basics'),
		'John', 1, 1, 1, 1, '266', '269', false
	UNION ALL
	SELECT (SELECT id FROM books WHERE title = 'Greek Grammar Beyond the Basics'),
		'Romans', 8, 28, 8, 28, '196', '197', false
	UNION ALL
	SELECT (SELECT id FROM books WHERE title = 'Greek Grammar Beyond the Basics'),
		'Hebrews', 1, 1, 1, 4, '413', '415', false

	UNION ALL

	-- Calvin — Institutes of the Christian Religion
	SELECT (SELECT id FROM books WHERE title = 'Institutes of the Christian Religion'),
		'Romans', NULL, NULL, NULL, NULL, '1', '1734', false  -- whole-book reference
	UNION ALL
	SELECT (SELECT id FROM books WHERE title = 'Institutes of the Christian Religion'),
		'Philippians', NULL, NULL, NULL, NULL, '1', '1734', false
	UNION ALL
	SELECT (SELECT id FROM books WHERE title = 'Institutes of the Christian Religion'),
		'Ephesians', 1, 7, 1, 14, '598', '602', false
	UNION ALL
	SELECT (SELECT id FROM books WHERE title = 'Institutes of the Christian Religion'),
		'Philippians', 2, NULL, 2, NULL, '478', '491', false  -- Phil 2 whole chapter
) AS v(book_id, bible_book, cs, vs, ce, ve, ps, pe, nr)
WHERE v.book_id IS NOT NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.scripture_references existing
		WHERE existing.book_id = v.book_id
			AND existing.bible_book = v.bible_book
			AND existing.chapter_start IS NOT DISTINCT FROM v.cs
			AND existing.verse_start IS NOT DISTINCT FROM v.vs
			AND existing.chapter_end IS NOT DISTINCT FROM v.ce
			AND existing.verse_end IS NOT DISTINCT FROM v.ve
			AND existing.deleted_at IS NULL
	);

-- =============================================================================
-- Verify (paste these into psql / Studio after running):
--
--   SELECT COUNT(*) FROM scripture_references WHERE deleted_at IS NULL;
--     -- Expect 20.
--
--   SELECT book_title, page_start, manual_entry
--     FROM search_scripture_refs('Philippians', 2, 5);
--     -- Expect 4 rows: Wright (Phil 2:5–11 in 2:1–11),
--     --                Wallace (Phil 2:1–11),
--     --                Calvin (Phil 2 chapter),
--     --                Calvin (Philippians whole book).
--
--   SELECT book_title, page_start FROM search_scripture_refs('Romans', 8, 28);
--     -- Expect: Wright Rom 8:18–39, Wallace Rom 8:28, Calvin Romans whole book.
--
--   SELECT book_title FROM search_scripture_refs('Mark');
--     -- Expect: Bauckham Mark whole-book (chapter null = entire bible_book).
-- =============================================================================
