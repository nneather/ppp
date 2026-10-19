-- library_oct19_nidotte_shelf: Noonan, Connelly, Celebration Hymnal,
-- Beale BECNT Colossians, Kim/Bruce WBC 45 2nd ed., Weima BECNT,
-- NIDOTTE 1997 hardcover vols 1–5.
-- Also correct WBC Bruce Thessalonians ebook ISBN → hardcover.
-- Owner confirm 2026-10-19: 1A, 2A, 3 default gray pew, 4 correct ISBN.
-- Idempotent by natural keys. Hosted push only. DML-only (no gen-types).
-- No new publishers-registry rows (Triumph Books and Word Music stay free-text).

-- ---------------------------------------------------------------------------
-- Series: NIDOTTE (self-named; include_in_citation false like NIDNTTE / TDNT)
-- ---------------------------------------------------------------------------
INSERT INTO public.series (name, abbreviation, include_in_citation, created_by)
SELECT v.name, v.abbreviation, false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('New International Dictionary of Old Testament Theology and Exegesis', 'NIDOTTE')
) AS v(name, abbreviation)
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = v.abbreviation
);

UPDATE public.series
SET include_in_citation = false, updated_at = now()
WHERE abbreviation = 'NIDOTTE'
	AND deleted_at IS NULL
	AND include_in_citation IS DISTINCT FROM false;

-- ---------------------------------------------------------------------------
-- People (new). Existing: Gregory K. Beale, F. F. Bruce.
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Benjamin', 'J.', 'Noonan'),
	('Bill', NULL::text, 'Connelly'),
	('Tom', NULL::text, 'Fettke'),
	('Seyoon', NULL::text, 'Kim'),
	('Jeffrey', 'A. D.', 'Weima'),
	('Willem', 'A.', 'VanGemeren')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- WBC 45 Bruce: ebook ISBN → 2015 hardcover reprint
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET isbn = '9780310521990', updated_at = now()
FROM public.series s
WHERE s.id = b.series_id
	AND s.abbreviation = 'WBC'
	AND s.deleted_at IS NULL
	AND b.deleted_at IS NULL
	AND b.title = '1 and 2 Thessalonians'
	AND b.volume_number = '45'
	AND b.edition IS NULL
	AND b.isbn = '9780310586371';

-- ---------------------------------------------------------------------------
-- Standalone: Noonan, Connelly, Celebration Hymnal
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_id, publisher_location,
	year, original_year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.subtitle, v.publisher, pub.id, v.publisher_location,
	v.year, v.original_year, v.isbn,
	v.genre, v.work_type, 'english', v.reading_status, false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'Advances in the Study of Biblical Hebrew and Aramaic',
		'New Insights for Reading the Old Testament',
		'Zondervan Academic',
		'Grand Rapids, MI',
		2020,
		NULL::int,
		'9780310596011',
		'Hebrew Language Tools',
		'monograph',
		'unread'
	),
	(
		'Forward Progress',
		'The Definitive Guide to the Future of College Football',
		'Triumph Books',
		'Chicago, IL',
		2025,
		NULL::int,
		'9781637278703',
		'Sports',
		'monograph',
		'unread'
	),
	(
		'The Celebration Hymnal',
		'Songs and Hymns for Worship',
		'Word Music',
		'Nashville, TN',
		1997,
		NULL::int,
		'9783010142366',
		'Hymnals and Liturgy',
		'edited_volume',
		'unread'
	)
) AS v(title, subtitle, publisher, publisher_location, year, original_year, isbn, genre, work_type, reading_status)
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id IS NULL
);

-- ---------------------------------------------------------------------------
-- BECNT: Beale Colossians and Philemon; Weima 1-2 Thessalonians
-- (siblings omit volume_number)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location, year, isbn,
	series_id, genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, pub.id, v.publisher_location, v.year, v.isbn,
	s.id, 'Commentary', 'monograph', 'english', 'reference', false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Colossians and Philemon', 'Baker Academic', 'Grand Rapids, MI', 2019, '9780801026676'),
	('1-2 Thessalonians', 'Baker Academic', 'Grand Rapids, MI', 2014, '9780801026850')
) AS v(title, publisher, publisher_location, year, isbn)
JOIN public.series s ON s.abbreviation = 'BECNT' AND s.deleted_at IS NULL
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id = s.id
);

-- ---------------------------------------------------------------------------
-- WBC 45 2nd ed. (Kim / Bruce). Keyed by ISBN so the 2015 Bruce row stays.
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location, year, isbn,
	edition, volume_number, series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, pub.id, v.publisher_location, v.year, v.isbn,
	v.edition, v.volume_number, s.id, 'Commentary', 'monograph', 'english',
	'reference', false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'1 and 2 Thessalonians',
		'Zondervan Academic',
		'Grand Rapids, MI',
		2023,
		'9780785250210',
		'2nd ed.',
		'45'
	)
) AS v(title, publisher, publisher_location, year, isbn, edition, volume_number)
JOIN public.series s ON s.abbreviation = 'WBC' AND s.deleted_at IS NULL
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.isbn = v.isbn
);

-- ---------------------------------------------------------------------------
-- NIDOTTE vols 1–5 (1997 hardcover; per-volume ISBNs, not the set barcode)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location, year, isbn,
	volume_number, total_volumes, series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, pub.id, v.publisher_location, v.year, v.isbn,
	v.volume_number, v.total_volumes, s.id, 'Biblical Reference', 'reference_work',
	'english', 'reference', false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('New International Dictionary of Old Testament Theology and Exegesis', 'Zondervan', 'Grand Rapids, MI', 1997, '9780310481706', '1', 5),
	('New International Dictionary of Old Testament Theology and Exegesis', 'Zondervan', 'Grand Rapids, MI', 1997, '9780310202172', '2', 5),
	('New International Dictionary of Old Testament Theology and Exegesis', 'Zondervan', 'Grand Rapids, MI', 1997, '9780310202189', '3', 5),
	('New International Dictionary of Old Testament Theology and Exegesis', 'Zondervan', 'Grand Rapids, MI', 1997, '9780310202196', '4', 5),
	('New International Dictionary of Old Testament Theology and Exegesis', 'Zondervan', 'Grand Rapids, MI', 1997, '9780310213116', '5', 5)
) AS v(title, publisher, publisher_location, year, isbn, volume_number, total_volumes)
JOIN public.series s ON s.abbreviation = 'NIDOTTE' AND s.deleted_at IS NULL
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.series_id = s.id
		AND b.volume_number = v.volume_number
);

-- ---------------------------------------------------------------------------
-- Authors / editors
-- ---------------------------------------------------------------------------
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('Advances in the Study of Biblical Hebrew and Aramaic', 'Benjamin', 'J.', 'Noonan', 'author', 0),
	('Forward Progress', 'Bill', NULL::text, 'Connelly', 'author', 0),
	('The Celebration Hymnal', 'Tom', NULL::text, 'Fettke', 'editor', 0)
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
	('Colossians and Philemon', 'BECNT', 'Gregory', 'K.', 'Beale', 'author', 0),
	('1-2 Thessalonians', 'BECNT', 'Jeffrey', 'A. D.', 'Weima', 'author', 0)
) AS v(title, series_abbr, first_name, middle_name, last_name, role, sort_order)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
JOIN public.people p
	ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id
);

-- Kim/Bruce keyed by the 2nd-ed. ISBN (title+WBC also matches the 2015 Bruce row).
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('9780785250210', 'Seyoon', NULL::text, 'Kim', 'author', 0),
	('9780785250210', 'F.', 'F.', 'Bruce', 'author', 1)
) AS v(isbn, first_name, middle_name, last_name, role, sort_order)
JOIN public.books b ON b.isbn = v.isbn AND b.deleted_at IS NULL
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
SELECT b.id, p.id, 'editor', 0
FROM public.series s
JOIN public.books b ON b.series_id = s.id AND b.deleted_at IS NULL
JOIN public.people p
	ON p.deleted_at IS NULL
	AND p.first_name = 'Willem'
	AND p.middle_name = 'A.'
	AND p.last_name = 'VanGemeren'
WHERE s.abbreviation = 'NIDOTTE'
	AND s.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.book_authors ba
		WHERE ba.book_id = b.id AND ba.person_id = p.id
	);

-- ---------------------------------------------------------------------------
-- Commentary coverage (title books only)
-- ---------------------------------------------------------------------------
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Colossians and Philemon', 'BECNT', 'Colossians'),
	('Colossians and Philemon', 'BECNT', 'Philemon'),
	('1-2 Thessalonians', 'BECNT', '1 Thessalonians'),
	('1-2 Thessalonians', 'BECNT', '2 Thessalonians')
) AS v(title, series_abbr, bible_book)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);

INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('9780785250210', '1 Thessalonians'),
	('9780785250210', '2 Thessalonians')
) AS v(isbn, bible_book)
JOIN public.books b ON b.isbn = v.isbn AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);
