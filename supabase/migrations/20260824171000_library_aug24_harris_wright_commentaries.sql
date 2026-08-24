-- library_aug24_harris_wright_commentaries: Harris prepositions, Wright OT ethics,
-- WBC Zondervan reprints (Mounce / Bauckham / Lane 47A+47B), Kruse PNTC 2nd, Schreiner BECNT.
-- Owner confirm 2026-08-24: 1A two Lane rows, 2B Zondervan reprints, 3B Kruse 2020,
-- 4A Harris 2012 hardcover, 5B Wright 2011 paperback (original_year 2004).
-- Idempotent by natural keys. Hosted push only. DML-only (no gen-types).

-- ---------------------------------------------------------------------------
-- People (new)
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('William', 'D.', 'Mounce')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- Standalone (Harris, Wright)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location, year, original_year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, pub.id, v.publisher_location, v.year, v.original_year, v.isbn,
	v.genre, 'monograph', 'english', v.reading_status, false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'Prepositions and Theology in the Greek New Testament',
		'Zondervan',
		'Grand Rapids, MI',
		2012,
		NULL::int,
		'9780310493921',
		'Greek Language Tools',
		'unread'
	),
	(
		'Old Testament Ethics for the People of God',
		'IVP Academic',
		'Downers Grove, IL',
		2011,
		2004,
		'9780830839612',
		'Ethics',
		'unread'
	)
) AS v(title, publisher, publisher_location, year, original_year, isbn, genre, reading_status)
LEFT JOIN public.publishers pub ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id IS NULL
);

-- ---------------------------------------------------------------------------
-- Commentaries (WBC / PNTC / BECNT)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location, year, original_year, isbn,
	volume_number, series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, pub.id, v.publisher_location, v.year, v.original_year, v.isbn,
	v.volume_number, s.id, 'Commentary', 'monograph', 'english',
	'reference', false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Pastoral Epistles', 'Zondervan Academic', 'Grand Rapids, MI', 2016, 2000, '9780310522089', '46', 'WBC'),
	('Jude, 2 Peter', 'Zondervan Academic', 'Grand Rapids, MI', 2014, 1983, '9780310521693', '50', 'WBC'),
	('The Letters of John', 'Eerdmans', 'Grand Rapids, MI', 2020, 2000, '9780802876676', NULL::text, 'PNTC'),
	('Revelation', 'Baker Academic', 'Grand Rapids, MI', 2023, NULL::int, '9781540960504', NULL::text, 'BECNT'),
	('Hebrews 1-8', 'Zondervan Academic', 'Grand Rapids, MI', 2015, 1991, '9780310521792', '47A', 'WBC'),
	('Hebrews 9-13', 'Zondervan Academic', 'Grand Rapids, MI', 2015, 1991, '9780310522027', '47B', 'WBC')
) AS v(title, publisher, publisher_location, year, original_year, isbn, volume_number, series_abbr)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
LEFT JOIN public.publishers pub ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id = s.id
);

-- ---------------------------------------------------------------------------
-- Authors
-- ---------------------------------------------------------------------------
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', v.sort_order
FROM (VALUES
	('Prepositions and Theology in the Greek New Testament', 'Murray', 'J.', 'Harris', 0),
	('Old Testament Ethics for the People of God', 'Christopher', 'J. H.', 'Wright', 0)
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

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', v.sort_order
FROM (VALUES
	('Pastoral Epistles', 'WBC', 'William', 'D.', 'Mounce', 0),
	('Jude, 2 Peter', 'WBC', 'Richard', NULL, 'Bauckham', 0),
	('The Letters of John', 'PNTC', 'Colin', NULL, 'Kruse', 0),
	('Revelation', 'BECNT', 'Thomas', 'R.', 'Schreiner', 0),
	('Hebrews 1-8', 'WBC', 'William', 'L.', 'Lane', 0),
	('Hebrews 9-13', 'WBC', 'William', 'L.', 'Lane', 0)
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

-- ---------------------------------------------------------------------------
-- Bible coverage (Commentaries only)
-- ---------------------------------------------------------------------------
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Pastoral Epistles', 'WBC', '1 Timothy'),
	('Pastoral Epistles', 'WBC', '2 Timothy'),
	('Pastoral Epistles', 'WBC', 'Titus'),
	('Jude, 2 Peter', 'WBC', 'Jude'),
	('Jude, 2 Peter', 'WBC', '2 Peter'),
	('The Letters of John', 'PNTC', '1 John'),
	('The Letters of John', 'PNTC', '2 John'),
	('The Letters of John', 'PNTC', '3 John'),
	('Revelation', 'BECNT', 'Revelation'),
	('Hebrews 1-8', 'WBC', 'Hebrews'),
	('Hebrews 9-13', 'WBC', 'Hebrews')
) AS v(title, series_abbr, bible_book)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);
