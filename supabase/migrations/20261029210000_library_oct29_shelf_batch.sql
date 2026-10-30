-- library_oct29_shelf_batch: Robertson, Fallacies 3rd, Whitacre, Weiß KEK, Smith WUNT II
-- (owner confirm 2026-10-29: Fallacies 2nd is Baker US; Whitacre is the Baker Academic reprint).
-- Idempotent by natural keys. Hosted push only.
-- DML-only (no gen-types). New series KEK and WUNT II. No new publishers-registry rows.
-- Baker Academic links to the existing publisher row. Broadman Press, Vandenhoeck & Ruprecht,
-- and Mohr Siebeck stay free text.

-- ---------------------------------------------------------------------------
-- Existing Exegetical Fallacies is the 2nd edition (Baker US), not 1984.
-- ISBN was the Paternoster twin (9780853646778). See decision 133.
-- ---------------------------------------------------------------------------
UPDATE public.books
SET
	year = 1996,
	edition = '2nd',
	isbn = '9780801020865'
WHERE id = '70130cd4-0733-4fc9-aaf2-0d862ed4863f'
	AND deleted_at IS NULL
	AND title = 'Exegetical Fallacies'
	AND series_id IS NULL
	AND (
		year IS DISTINCT FROM 1996
		OR edition IS DISTINCT FROM '2nd'
		OR isbn IS DISTINCT FROM '9780801020865'
	);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('A.', 'T.', 'Robertson'),
	('Rodney', 'A.', 'Whitacre'),
	('Hans-Friedrich', NULL::text, 'Weiß'),
	('Claire', 'S.', 'Smith')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- Series (KEK is not EKK; WUNT II is the second series only)
-- ---------------------------------------------------------------------------
INSERT INTO public.series (name, abbreviation, created_by)
SELECT v.name, v.abbreviation, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Kritisch-Exegetischer Kommentar über das Neue Testament', 'KEK'),
	('Wissenschaftliche Untersuchungen zum Neuen Testament, 2. Reihe', 'WUNT II')
) AS v(name, abbreviation)
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = v.abbreviation
);

-- ---------------------------------------------------------------------------
-- Standalone books (Fallacies 3rd shares a title with the 2nd; key includes edition)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, edition, publisher, publisher_id, publisher_location,
	year, original_year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.subtitle, v.edition, v.publisher, pub.id, v.publisher_location,
	v.year, v.original_year, v.isbn,
	v.genre, 'monograph', v.language, v.reading_status, false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'A Grammar of the Greek New Testament in the Light of Historical Research',
		NULL::text,
		'4th',
		'Broadman Press',
		'Nashville, TN',
		1934,
		NULL::int,
		NULL::text,
		'Greek Language Tools',
		'english',
		'reference'
	),
	(
		'Exegetical Fallacies',
		NULL::text,
		'3rd',
		'Baker Academic',
		'Grand Rapids, MI',
		2026,
		NULL::int,
		'9781540969224',
		'Greek Language Tools',
		'english',
		'unread'
	),
	(
		'A Patristic Greek Reader',
		NULL::text,
		NULL::text,
		'Baker Academic',
		'Grand Rapids, MI',
		2012,
		2007,
		'9780801048012',
		'Greek Language Tools',
		'english',
		'reference'
	)
) AS v(
	title, subtitle, edition, publisher, publisher_location,
	year, original_year, isbn, genre, language, reading_status
)
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.title = v.title
		AND b.series_id IS NULL
		AND COALESCE(b.edition, '') = COALESCE(v.edition, '')
);

-- ---------------------------------------------------------------------------
-- Series volumes
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, edition, publisher, publisher_id, publisher_location,
	year, original_year, isbn, volume_number, series_id,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.subtitle, v.edition, v.publisher, pub.id, v.publisher_location,
	v.year, v.original_year, v.isbn, v.volume_number, s.id,
	v.genre, 'monograph', v.language, v.reading_status, false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'Der Brief an die Hebräer',
		NULL::text,
		'15th',
		'Vandenhoeck & Ruprecht',
		'Göttingen',
		1991,
		NULL::int,
		'9783525516256',
		'13',
		'KEK',
		'Commentary',
		'german',
		'reference'
	),
	(
		'Pauline Communities as ''Scholastic Communities''',
		'A Study of the Vocabulary of ''Teaching'' in 1 Corinthians, 1 and 2 Timothy and Titus',
		NULL::text,
		'Mohr Siebeck',
		'Tübingen',
		2012,
		NULL::int,
		'9783161519635',
		'335',
		'WUNT II',
		'Acts and Paul',
		'english',
		'unread'
	)
) AS v(
	title, subtitle, edition, publisher, publisher_location,
	year, original_year, isbn, volume_number, series_abbr,
	genre, language, reading_status
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
-- Authors
-- ---------------------------------------------------------------------------
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', v.sort_order
FROM (VALUES
	(
		'A Grammar of the Greek New Testament in the Light of Historical Research',
		'4th',
		'A.', 'T.', 'Robertson',
		0
	),
	('Exegetical Fallacies', '3rd', 'D.', 'A.', 'Carson', 0),
	('Exegetical Fallacies', '3rd', 'Andrew', 'David', 'Naselli', 1),
	('A Patristic Greek Reader', '', 'Rodney', 'A.', 'Whitacre', 0)
) AS v(title, edition, first_name, middle_name, last_name, sort_order)
JOIN public.books b
	ON b.title = v.title
	AND b.series_id IS NULL
	AND b.deleted_at IS NULL
	AND COALESCE(b.edition, '') = v.edition
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
SELECT b.id, p.id, 'author', v.sort_order
FROM (VALUES
	('Der Brief an die Hebräer', 'KEK', 'Hans-Friedrich', NULL::text, 'Weiß', 0),
	(
		'Pauline Communities as ''Scholastic Communities''',
		'WUNT II',
		'Claire', 'S.', 'Smith',
		0
	)
) AS v(title, series_abbr, first_name, middle_name, last_name, sort_order)
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

-- ---------------------------------------------------------------------------
-- Commentary coverage
-- ---------------------------------------------------------------------------
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, 'Hebrews', 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM public.books b
JOIN public.series s ON s.id = b.series_id AND s.deleted_at IS NULL
WHERE b.deleted_at IS NULL
	AND b.title = 'Der Brief an die Hebräer'
	AND s.abbreviation = 'KEK'
	AND NOT EXISTS (
		SELECT 1 FROM public.book_bible_coverage c
		WHERE c.book_id = b.id AND c.bible_book = 'Hebrews'
	);
