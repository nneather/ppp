-- library_oct1: Witherington SRC Corinthians + Jobes LXX reader
-- (owner confirm 2026-10-01). Idempotent by natural keys.
-- Hosted push only. DML-only (no gen-types).

-- ---------------------------------------------------------------------------
-- Series: Socio-Rhetorical Commentary (SRC). Footnotes cite the abbr;
-- bibliography cites the name. No volume numbers in this series.
-- ---------------------------------------------------------------------------
INSERT INTO public.series (name, abbreviation, include_in_citation, created_by)
SELECT v.name, v.abbreviation, true, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Socio-Rhetorical Commentary', 'SRC')
) AS v(name, abbreviation)
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = v.abbreviation
);

-- ---------------------------------------------------------------------------
-- People. Suffix on last_name matches Henry M. Robert III.
-- Karen H. Jobes already exists.
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Ben', NULL, 'Witherington III')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- SRC commentary. Short title; series carries the socio-rhetorical line.
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location, year, isbn,
	series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, pub.id, v.publisher_location, v.year, v.isbn,
	s.id, 'Commentary', 'monograph', 'english',
	'reference', false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'Conflict and Community in Corinth',
		'Eerdmans',
		'Grand Rapids, MI',
		1995,
		'9780802801449',
		'SRC'
	)
) AS v(title, publisher, publisher_location, year, isbn, series_abbr)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id = s.id
);

-- ---------------------------------------------------------------------------
-- Standalone reader. Jobes is senior editor; student contributors omitted.
-- No publishers-registry row for Kregel Academic (free-text, like siblings).
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_id, publisher_location,
	year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.subtitle, v.publisher, pub.id, v.publisher_location,
	v.year, v.isbn,
	'Greek Language Tools', 'edited_volume', 'english', 'unread', false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'Discovering the Septuagint',
		'A Guided Reader',
		'Kregel Academic',
		'Grand Rapids, MI',
		2016,
		'9780825443428'
	)
) AS v(title, subtitle, publisher, publisher_location, year, isbn)
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.title = v.title
		AND b.series_id IS NULL
);

-- ---------------------------------------------------------------------------
-- Authors
-- ---------------------------------------------------------------------------
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.series s
JOIN public.books b
	ON b.title = 'Conflict and Community in Corinth'
	AND b.series_id = s.id
	AND b.deleted_at IS NULL
JOIN public.people p
	ON p.deleted_at IS NULL
	AND p.first_name = 'Ben'
	AND p.middle_name IS NULL
	AND p.last_name = 'Witherington III'
WHERE s.deleted_at IS NULL
	AND s.abbreviation = 'SRC'
	AND NOT EXISTS (
		SELECT 1 FROM public.book_authors ba
		WHERE ba.book_id = b.id AND ba.person_id = p.id
	);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'editor', 0
FROM public.books b
JOIN public.people p
	ON p.deleted_at IS NULL
	AND p.first_name = 'Karen'
	AND p.middle_name = 'H.'
	AND p.last_name = 'Jobes'
WHERE b.deleted_at IS NULL
	AND b.title = 'Discovering the Septuagint'
	AND b.series_id IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.book_authors ba
		WHERE ba.book_id = b.id AND ba.person_id = p.id
	);

-- ---------------------------------------------------------------------------
-- Bible coverage (commentary only)
-- ---------------------------------------------------------------------------
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Conflict and Community in Corinth', 'SRC', '1 Corinthians'),
	('Conflict and Community in Corinth', 'SRC', '2 Corinthians')
) AS v(title, series_abbr, bible_book)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);
