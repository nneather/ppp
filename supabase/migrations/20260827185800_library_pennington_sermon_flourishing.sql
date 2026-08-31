-- library_pennington_sermon_flourishing: Pennington Sermon on the Mount (owner confirm)
-- 1B paperback 2018 / original_year 2017; Commentary; Matthew coverage + Matt 5–7 passage.
-- Idempotent by natural keys. Hosted push only. DML-only (no gen-types).

INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Jonathan', 'T.', 'Pennington')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

INSERT INTO public.books (
	title, subtitle, publisher, publisher_id, publisher_location,
	year, original_year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.subtitle, v.publisher, pub.id, v.publisher_location,
	v.year, v.original_year, v.isbn,
	'Commentary', 'monograph', 'english', 'reference', false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'The Sermon on the Mount and Human Flourishing',
		'A Theological Commentary',
		'Baker Academic',
		'Grand Rapids, MI',
		2018,
		2017,
		'9781540960641'
	)
) AS v(title, subtitle, publisher, publisher_location, year, original_year, isbn)
LEFT JOIN public.publishers pub ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id IS NULL
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', v.sort_order
FROM (VALUES
	('The Sermon on the Mount and Human Flourishing', 'Jonathan', 'T.', 'Pennington', 0)
) AS v(title, first_name, middle_name, last_name, sort_order)
JOIN public.books b ON b.title = v.title AND b.series_id IS NULL AND b.deleted_at IS NULL
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id
);

INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('The Sermon on the Mount and Human Flourishing', 'Matthew')
) AS v(title, bible_book)
JOIN public.books b ON b.title = v.title AND b.series_id IS NULL AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);

-- Whole-book locator for the Sermon (Matt 5–7). Pages = catalog 352-page span, not TOC-verified.
INSERT INTO public.scripture_references (
	book_id, bible_book, chapter_start, chapter_end,
	page_start, page_end, needs_review, created_by
)
SELECT
	b.id, v.bible_book, v.chapter_start, v.chapter_end,
	v.page_start, v.page_end, false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'The Sermon on the Mount and Human Flourishing',
		'Matthew',
		5,
		7,
		'1',
		'352'
	)
) AS v(title, bible_book, chapter_start, chapter_end, page_start, page_end)
JOIN public.books b ON b.title = v.title AND b.series_id IS NULL AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.scripture_references sr
	WHERE sr.deleted_at IS NULL
		AND sr.book_id = b.id
		AND sr.bible_book = v.bible_book
		AND sr.chapter_start = v.chapter_start
		AND sr.chapter_end = v.chapter_end
		AND sr.verse_start IS NULL
		AND sr.verse_end IS NULL
);
