-- library_nov7_shelf_batch: Wright BST, WBC 23B essays, Goldingay NICOT,
-- Eaton TOTC, Caragounis, Porter encyclopedia, Brown BST 1982, Smith.
-- Owner confirm 2026-11-07. Celebration Hymnal already on the shelf; skipped.
-- Idempotent by natural keys. Hosted push only. DML-only (no gen-types).
-- IVP, IVP Academic, Eerdmans, Zondervan Academic, and Baker Academic link
-- to existing publisher rows. Matthias Media stays free text.

-- ---------------------------------------------------------------------------
-- People (Claire S. Smith, Christopher J. H. Wright, Stanley E. Porter,
-- and Dana M. Harris already exist. Raymond Brown is not Raymond E. Brown.)
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('John', NULL::text, 'Goldingay'),
	('Duane', 'A.', 'Garrett'),
	('Paul', 'R.', 'House'),
	('Michael', 'A.', 'Eaton'),
	('Chrys', 'C.', 'Caragounis'),
	('Christopher', 'D.', 'Land'),
	('Jonathan', 'M.', 'Watt'),
	('Raymond', NULL::text, 'Brown')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- Series commentaries
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_id, publisher_location,
	year, original_year, isbn, volume_number, series_id,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.subtitle, v.publisher, pub.id, v.publisher_location,
	v.year, v.original_year, v.isbn, v.volume_number, s.id,
	'Commentary', 'monograph', 'english', 'reference', false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'The Message of Lamentations',
		NULL::text,
		'IVP Academic',
		'Downers Grove, IL',
		2023,
		2015,
		'9781514006399',
		NULL::text,
		'BST'
	),
	(
		'The Message of Hebrews',
		'Christ above All',
		'IVP',
		'Downers Grove, IL',
		1982,
		NULL::int,
		'9780877842897',
		NULL::text,
		'BST'
	),
	(
		'Song of Songs and Lamentations',
		NULL::text,
		'Zondervan Academic',
		'Grand Rapids, MI',
		2016,
		2004,
		'9780310522195',
		'23B',
		'WBC'
	),
	(
		'The Book of Lamentations',
		NULL::text,
		'Eerdmans',
		'Grand Rapids, MI',
		2022,
		NULL::int,
		'9780802825421',
		NULL::text,
		'NICOT'
	),
	(
		'Ecclesiastes',
		NULL::text,
		'IVP Academic',
		'Downers Grove, IL',
		2009,
		1983,
		'9780830842186',
		'16',
		'TOTC'
	)
) AS v(
	title, subtitle, publisher, publisher_location,
	year, original_year, isbn, volume_number, series_abbr
)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.title = v.title
		AND b.series_id = s.id
);

-- ---------------------------------------------------------------------------
-- Standalone books
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, edition, publisher, publisher_id, publisher_location,
	year, original_year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.subtitle, v.edition, v.publisher, pub.id, v.publisher_location,
	v.year, v.original_year, v.isbn,
	v.genre, v.work_type, 'english', v.reading_status, false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'The Development of Greek and the New Testament',
		'Morphology, Syntax, Phonology, and Textual Transmission',
		NULL::text,
		'Baker Academic',
		'Grand Rapids, MI',
		2006,
		2004,
		'9780801032301',
		'Greek Language Tools',
		'monograph',
		'reference'
	),
	(
		'God''s Good Design',
		'What the Bible Really Says about Men and Women',
		'2nd',
		'Matthias Media',
		'Sydney',
		2019,
		2012,
		'9781925424515',
		'Biblical Theology',
		'monograph',
		'unread'
	),
	(
		'Encyclopedia of Biblical Greek Language and Linguistics',
		NULL::text,
		NULL::text,
		'Baker Academic',
		'Grand Rapids, MI',
		2026,
		NULL::int,
		'9781540961631',
		'Biblical Reference',
		'edited_volume',
		'reference'
	)
) AS v(
	title, subtitle, edition, publisher, publisher_location,
	year, original_year, isbn, genre, work_type, reading_status
)
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.title = v.title
		AND b.series_id IS NULL
);

-- ---------------------------------------------------------------------------
-- Authors and editors
-- ---------------------------------------------------------------------------
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('The Message of Lamentations', 'BST', 'Christopher', 'J. H.', 'Wright', 'author', 0),
	('The Message of Hebrews', 'BST', 'Raymond', NULL::text, 'Brown', 'author', 0),
	('Song of Songs and Lamentations', 'WBC', 'Duane', 'A.', 'Garrett', 'author', 0),
	('Song of Songs and Lamentations', 'WBC', 'Paul', 'R.', 'House', 'author', 1),
	('The Book of Lamentations', 'NICOT', 'John', NULL::text, 'Goldingay', 'author', 0),
	('Ecclesiastes', 'TOTC', 'Michael', 'A.', 'Eaton', 'author', 0)
) AS v(title, series_abbr, first_name, middle_name, last_name, role, sort_order)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b
	ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
JOIN public.people p
	ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	(
		'The Development of Greek and the New Testament',
		'Chrys', 'C.', 'Caragounis', 'author', 0
	),
	('God''s Good Design', 'Claire', 'S.', 'Smith', 'author', 0),
	(
		'Encyclopedia of Biblical Greek Language and Linguistics',
		'Stanley', 'E.', 'Porter', 'editor', 0
	),
	(
		'Encyclopedia of Biblical Greek Language and Linguistics',
		'Christopher', 'D.', 'Land', 'editor', 1
	),
	(
		'Encyclopedia of Biblical Greek Language and Linguistics',
		'Jonathan', 'M.', 'Watt', 'editor', 2
	),
	(
		'Encyclopedia of Biblical Greek Language and Linguistics',
		'Dana', 'M.', 'Harris', 'editor', 3
	)
) AS v(title, first_name, middle_name, last_name, role, sort_order)
JOIN public.books b
	ON b.title = v.title AND b.series_id IS NULL AND b.deleted_at IS NULL
JOIN public.people p
	ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id
);

-- ---------------------------------------------------------------------------
-- Commentary coverage on the volume
-- ---------------------------------------------------------------------------
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('The Message of Lamentations', 'BST', 'Lamentations'),
	('The Message of Hebrews', 'BST', 'Hebrews'),
	('Song of Songs and Lamentations', 'WBC', 'Song of Songs'),
	('Song of Songs and Lamentations', 'WBC', 'Lamentations'),
	('The Book of Lamentations', 'NICOT', 'Lamentations'),
	('Ecclesiastes', 'TOTC', 'Ecclesiastes')
) AS v(title, series_abbr, bible_book)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b
	ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);

-- ---------------------------------------------------------------------------
-- WBC 23B: Garrett on Song of Songs, House on Lamentations.
-- Pages follow the 2004 text (House's introduction starts at 278).
-- Lamentations page_end stays null; indexes follow the commentary.
-- ---------------------------------------------------------------------------
INSERT INTO public.essays (
	essay_title, parent_book_id, page_start, page_end, created_by, created_at
)
SELECT
	v.essay_title,
	b.id,
	v.page_start,
	v.page_end,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid,
	timestamptz '2026-11-07 18:00:00+00' + (v.ord * interval '1 second')
FROM (VALUES
	(0, 'Song of Songs', '1', '277'),
	(1, 'Lamentations', '278', NULL::text)
) AS v(ord, essay_title, page_start, page_end)
JOIN public.series s ON s.abbreviation = 'WBC' AND s.deleted_at IS NULL
JOIN public.books b
	ON b.title = 'Song of Songs and Lamentations'
	AND b.series_id = s.id
	AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.essays e
	WHERE e.deleted_at IS NULL
		AND e.parent_book_id = b.id
		AND e.essay_title = v.essay_title
);

INSERT INTO public.essay_authors (essay_id, person_id, role, sort_order)
SELECT e.id, p.id, 'author', 0
FROM (VALUES
	('Song of Songs', 'Duane', 'A.', 'Garrett'),
	('Lamentations', 'Paul', 'R.', 'House')
) AS v(essay_title, first_name, middle_name, last_name)
JOIN public.series s ON s.abbreviation = 'WBC' AND s.deleted_at IS NULL
JOIN public.books b
	ON b.title = 'Song of Songs and Lamentations'
	AND b.series_id = s.id
	AND b.deleted_at IS NULL
JOIN public.essays e
	ON e.parent_book_id = b.id
	AND e.essay_title = v.essay_title
	AND e.deleted_at IS NULL
JOIN public.people p
	ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.essay_authors ea
	WHERE ea.essay_id = e.id AND ea.person_id = p.id
);

INSERT INTO public.book_bible_coverage (essay_id, bible_book, created_by)
SELECT e.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Song of Songs', 'Song of Songs'),
	('Lamentations', 'Lamentations')
) AS v(essay_title, bible_book)
JOIN public.series s ON s.abbreviation = 'WBC' AND s.deleted_at IS NULL
JOIN public.books b
	ON b.title = 'Song of Songs and Lamentations'
	AND b.series_id = s.id
	AND b.deleted_at IS NULL
JOIN public.essays e
	ON e.parent_book_id = b.id
	AND e.essay_title = v.essay_title
	AND e.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.essay_id = e.id AND c.bible_book = v.bible_book
);
