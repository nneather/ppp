-- library_oct19_shelf_batch: Louw-Nida (2 vol), Schnabel ZECNT Acts,
-- Oldfather Loeb Epictetus (2 vol), Hardy LCC paperback standalone,
-- Andersen TOTC Job (owner confirm 2026-10-19: 1A, 2A, 3B).
-- Idempotent by natural keys. Hosted push only. DML-only (no gen-types).
-- No new series. No new publishers-registry rows (UBS and Harvard stay free-text).

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Johannes', 'P.', 'Louw'),
	('Eugene', 'A.', 'Nida'),
	('Eckhard', 'J.', 'Schnabel'),
	(NULL::text, NULL::text, 'Epictetus'),
	('W. A.', NULL::text, 'Oldfather'),
	('Edward', 'R.', 'Hardy'),
	('Cyril', 'C.', 'Richardson'),
	('Francis', 'I.', 'Andersen')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- Standalone: Louw-Nida (2nd ed., ISBN empty) + Hardy (no series)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location,
	year, original_year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, pub.id, v.publisher_location,
	v.year, v.original_year, v.isbn,
	v.genre, v.work_type, 'english', v.reading_status, false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'Greek-English Lexicon of the New Testament: Based on Semantic Domains, Volume 1: Introduction and Domains',
		'United Bible Societies',
		'New York, NY',
		1989,
		NULL::int,
		NULL::text,
		'Greek Language Tools',
		'reference_work',
		'reference'
	),
	(
		'Greek-English Lexicon of the New Testament: Based on Semantic Domains, Volume 2: Indices',
		'United Bible Societies',
		'New York, NY',
		1989,
		NULL::int,
		NULL::text,
		'Greek Language Tools',
		'reference_work',
		'reference'
	),
	(
		'Christology of the Later Fathers',
		'Westminster John Knox',
		'Louisville, KY',
		2006,
		1954,
		'9780664241520',
		'Church Fathers',
		'edited_volume',
		'unread'
	)
) AS v(title, publisher, publisher_location, year, original_year, isbn, genre, work_type, reading_status)
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.title = v.title
		AND b.series_id IS NULL
);

-- ---------------------------------------------------------------------------
-- Series: ZECNT Acts (no volume_number), LCL Epictetus, TOTC Job 14
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location,
	year, original_year, isbn, volume_number, series_id,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, pub.id, v.publisher_location,
	v.year, v.original_year, v.isbn, v.volume_number, s.id,
	v.genre, v.work_type, 'english', v.reading_status, false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'Acts',
		'Zondervan',
		'Grand Rapids, MI',
		2012,
		NULL::int,
		'9780310243670',
		NULL::text,
		'ZECNT',
		'Commentary',
		'monograph',
		'reference'
	),
	(
		'Discourses, Volume I: Books 1–2',
		'Harvard University Press',
		'Cambridge, MA',
		1925,
		NULL::int,
		'9780674991453',
		'131',
		'LCL',
		'Philosophy',
		'monograph',
		'unread'
	),
	(
		'Discourses, Volume II: Books 3–4. Fragments. The Encheiridion',
		'Harvard University Press',
		'Cambridge, MA',
		1928,
		NULL::int,
		'9780674992405',
		'218',
		'LCL',
		'Philosophy',
		'monograph',
		'unread'
	),
	(
		'Job',
		'IVP Academic',
		'Downers Grove, IL',
		2008,
		1976,
		'9780830842148',
		'14',
		'TOTC',
		'Commentary',
		'monograph',
		'reference'
	)
) AS v(
	title, publisher, publisher_location, year, original_year, isbn,
	volume_number, series_abbr, genre, work_type, reading_status
)
JOIN public.series s
	ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.title = v.title
		AND b.series_id = s.id
);

-- ---------------------------------------------------------------------------
-- Authors / editors / translator
-- ---------------------------------------------------------------------------
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	(
		'Greek-English Lexicon of the New Testament: Based on Semantic Domains, Volume 1: Introduction and Domains',
		'Johannes', 'P.', 'Louw', 'editor', 0
	),
	(
		'Greek-English Lexicon of the New Testament: Based on Semantic Domains, Volume 1: Introduction and Domains',
		'Eugene', 'A.', 'Nida', 'editor', 1
	),
	(
		'Greek-English Lexicon of the New Testament: Based on Semantic Domains, Volume 2: Indices',
		'Johannes', 'P.', 'Louw', 'editor', 0
	),
	(
		'Greek-English Lexicon of the New Testament: Based on Semantic Domains, Volume 2: Indices',
		'Eugene', 'A.', 'Nida', 'editor', 1
	),
	(
		'Christology of the Later Fathers',
		'Edward', 'R.', 'Hardy', 'editor', 0
	),
	(
		'Christology of the Later Fathers',
		'Cyril', 'C.', 'Richardson', 'editor', 1
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

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('Acts', 'ZECNT', 'Eckhard', 'J.', 'Schnabel', 'author', 0),
	('Discourses, Volume I: Books 1–2', 'LCL', NULL::text, NULL::text, 'Epictetus', 'author', 0),
	('Discourses, Volume I: Books 1–2', 'LCL', 'W. A.', NULL::text, 'Oldfather', 'translator', 1),
	('Discourses, Volume II: Books 3–4. Fragments. The Encheiridion', 'LCL', NULL::text, NULL::text, 'Epictetus', 'author', 0),
	('Discourses, Volume II: Books 3–4. Fragments. The Encheiridion', 'LCL', 'W. A.', NULL::text, 'Oldfather', 'translator', 1),
	('Job', 'TOTC', 'Francis', 'I.', 'Andersen', 'author', 0)
) AS v(title, series_abbr, first_name, middle_name, last_name, role, sort_order)
JOIN public.series s
	ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
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

-- ---------------------------------------------------------------------------
-- Commentary coverage
-- ---------------------------------------------------------------------------
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Acts', 'ZECNT', 'Acts'),
	('Job', 'TOTC', 'Job')
) AS v(title, series_abbr, bible_book)
JOIN public.series s
	ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b
	ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);
