-- library_sep26_shelf_batch: Bollhagen Ecclesiastes, O'Donnell Job, Marshall/Towner
-- Pastorals, Fee Philippians, Guthrie Philippians, Chapman Philippians,
-- Conybeare/Stock LXX grammar (owner confirm 2026-09-26).
-- CONC → ConC (commentary-guide form; SBLHS §8.4 does not list CPH Concordia;
-- CC there is Continental Commentaries). Idempotent by natural keys.
-- Hosted push only. DML-only (no gen-types).

-- ---------------------------------------------------------------------------
-- Series: ConC rename + Focus on the Bible
-- ---------------------------------------------------------------------------
UPDATE public.series
SET
	abbreviation = 'ConC',
	name = 'Concordia Commentary',
	updated_at = now()
WHERE deleted_at IS NULL
	AND abbreviation IN ('CONC', 'ConC')
	AND (
		abbreviation IS DISTINCT FROM 'ConC'
		OR name IS DISTINCT FROM 'Concordia Commentary'
	);

INSERT INTO public.series (name, abbreviation, include_in_citation, created_by)
SELECT v.name, v.abbreviation, true, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Focus on the Bible', 'FotB')
) AS v(name, abbreviation)
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = v.abbreviation
);

-- ---------------------------------------------------------------------------
-- People (new). Existing: O'Donnell, Marshall, Fee, Guthrie, Chapman.
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('James', 'G.', 'Bollhagen'),
	('Philip', 'H.', 'Towner'),
	('F. C.', NULL, 'Conybeare'),
	('St. George', NULL, 'Stock')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- Commentaries
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
	('Ecclesiastes', 'Concordia Pub. House', 'Saint Louis', 2011, '9780570063872', 'ConC'),
	('Job', 'P&R Publishing', 'Phillipsburg, NJ', 2025, '9781629954523', 'REC'),
	('The Pastoral Epistles', 'T&T Clark', 'Edinburgh', 1999, '9780567086617', 'ICC'),
	('Paul''s Letter to the Philippians', 'Eerdmans', 'Grand Rapids, MI', 1995, '9780802825117', 'NICNT'),
	('Philippians', 'Zondervan Academic', 'Grand Rapids, MI', 2023, '9780310243892', 'ZECNT'),
	('Philippians', 'Christian Focus Publications', 'Fearn', 2012, '9781845506872', 'FotB')
) AS v(title, publisher, publisher_location, year, isbn, series_abbr)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id = s.id
);

-- ---------------------------------------------------------------------------
-- Standalone: Conybeare & Stock (Baker Academic paperback, 2001 reprint of 1905)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_id, publisher_location,
	year, original_year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.subtitle, v.publisher, pub.id, v.publisher_location,
	v.year, v.original_year, v.isbn,
	'Greek Language Tools', 'monograph', 'english', 'unread', false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'Grammar of Septuagint Greek',
		'With Selected Readings, Vocabularies, and Updated Indexes',
		'Baker Academic',
		'Grand Rapids, MI',
		2001,
		1905,
		'9780801045929'
	)
) AS v(title, subtitle, publisher, publisher_location, year, original_year, isbn)
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
SELECT b.id, p.id, 'author', v.sort_order
FROM (VALUES
	('Ecclesiastes', 'ConC', 'James', 'G.', 'Bollhagen', 0),
	('Job', 'REC', 'Douglas', 'Sean', 'O''Donnell', 0),
	('The Pastoral Epistles', 'ICC', 'I.', 'Howard', 'Marshall', 0),
	('The Pastoral Epistles', 'ICC', 'Philip', 'H.', 'Towner', 1),
	('Paul''s Letter to the Philippians', 'NICNT', 'Gordon', 'D.', 'Fee', 0),
	('Philippians', 'ZECNT', 'George', 'H', 'Guthrie', 0),
	('Philippians', 'FotB', 'David', 'W.', 'Chapman', 0)
) AS v(title, series_abbr, first_name, middle_name, last_name, sort_order)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
JOIN public.people p ON p.deleted_at IS NULL
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
	('Grammar of Septuagint Greek', 'F. C.', NULL, 'Conybeare', 0),
	('Grammar of Septuagint Greek', 'St. George', NULL, 'Stock', 1)
) AS v(title, first_name, middle_name, last_name, sort_order)
JOIN public.books b
	ON b.title = v.title AND b.series_id IS NULL AND b.deleted_at IS NULL
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id
);

-- ---------------------------------------------------------------------------
-- Bible coverage (commentaries only)
-- ---------------------------------------------------------------------------
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Ecclesiastes', 'ConC', 'Ecclesiastes'),
	('Job', 'REC', 'Job'),
	('The Pastoral Epistles', 'ICC', '1 Timothy'),
	('The Pastoral Epistles', 'ICC', '2 Timothy'),
	('The Pastoral Epistles', 'ICC', 'Titus'),
	('Paul''s Letter to the Philippians', 'NICNT', 'Philippians'),
	('Philippians', 'ZECNT', 'Philippians'),
	('Philippians', 'FotB', 'Philippians')
) AS v(title, series_abbr, bible_book)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);
