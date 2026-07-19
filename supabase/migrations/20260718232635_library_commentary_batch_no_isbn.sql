-- Library: add physical commentaries researched 2026-07-18 (no-ISBN shelf batch).
-- Idempotent by title (+ series where needed). Reuses existing people/series when present.
-- Haggai, Zechariah 1-8 already in library — only fills volume_number 25B.

-- ---------------------------------------------------------------------------
-- Series (new)
-- ---------------------------------------------------------------------------
INSERT INTO public.series (name, abbreviation, created_by)
SELECT v.name, v.abbreviation, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Black''s New Testament Commentaries', 'BNTC'),
	('Classic Commentary Library', 'CCL'),
	('IVP New Testament Commentary', 'IVPNTC')
) AS v(name, abbreviation)
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL
		AND s.abbreviation = v.abbreviation
);

-- ---------------------------------------------------------------------------
-- People (new authors only)
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Robert', 'D', 'Bergen'),
	('J. N. D.', NULL, 'Kelly'),
	('J. B.', NULL, 'Lightfoot'),
	('John', NULL, 'Murray'),
	('Jerome', 'D', 'Quinn'),
	('C. S.', NULL, 'Mann')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- Existing Meyers AB: fill volume
-- ---------------------------------------------------------------------------
UPDATE public.books
SET volume_number = '25B', updated_at = now()
WHERE id = 'b11e6c21-2593-4f00-b7c8-85dc431ee21f'
	AND deleted_at IS NULL
	AND volume_number IS NULL;

-- ---------------------------------------------------------------------------
-- Books
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_location, year, original_year, isbn,
	volume_number, series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	v.title,
	v.publisher,
	v.publisher_location,
	v.year,
	v.original_year,
	v.isbn,
	v.volume_number,
	s.id,
	'Commentary',
	'monograph',
	'english',
	'reference',
	false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	-- Bergen NAC
	(
		'1, 2 Samuel',
		'Broadman & Holman Publishers',
		'Nashville, TN',
		1996,
		NULL::int,
		'9780805401073',
		'7',
		'NAC'
	),
	-- Kelly BNTC
	(
		'The Epistles of Peter and of Jude',
		'A. & C. Black',
		'London',
		1969,
		NULL,
		'9780713612851',
		NULL,
		'BNTC'
	),
	-- Lightfoot CCL (Zondervan reprint; 1974 printing; work originally 1865)
	(
		'The Epistle of St. Paul to the Galatians',
		'Zondervan',
		'Grand Rapids, MI',
		1974,
		1865,
		'9780310276401',
		NULL,
		'CCL'
	),
	-- Michaels IVPNTC
	(
		'Revelation',
		'InterVarsity Press',
		'Downers Grove, IL',
		1997,
		NULL,
		'9780830818204',
		'20',
		'IVPNTC'
	),
	-- Murray NICNT combined one-volume
	(
		'The Epistle to the Romans',
		'Eerdmans',
		'Grand Rapids, MI',
		1968,
		1959,
		'9780802822864',
		NULL,
		'NICNT'
	),
	-- Quinn AB
	(
		'The Letter to Titus',
		'Doubleday',
		'Garden City, NY',
		1990,
		NULL,
		'9780385059008',
		'35',
		'AB'
	),
	-- Brown AB
	(
		'The Epistles of John',
		'Doubleday',
		'Garden City, NY',
		1982,
		NULL,
		'9780385056861',
		'30',
		'AB'
	),
	-- Mann AB
	(
		'Mark',
		'Doubleday',
		'Garden City, NY',
		1986,
		NULL,
		'9780385032537',
		'27',
		'AB'
	)
) AS v(title, publisher, publisher_location, year, original_year, isbn, volume_number, series_abbr)
JOIN public.series s
	ON s.abbreviation = v.series_abbr
	AND s.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.title = v.title
		AND b.series_id = s.id
);

-- ---------------------------------------------------------------------------
-- Authors (natural-key lookup; re-attach if missing)
-- ---------------------------------------------------------------------------
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', v.sort_order
FROM (VALUES
	('1, 2 Samuel', 'NAC', 'Robert', 'D', 'Bergen', 0),
	('The Epistles of Peter and of Jude', 'BNTC', 'J. N. D.', NULL, 'Kelly', 0),
	('The Epistle of St. Paul to the Galatians', 'CCL', 'J. B.', NULL, 'Lightfoot', 0),
	('Revelation', 'IVPNTC', 'J.', 'Ramsey', 'Michaels', 0),
	('The Epistle to the Romans', 'NICNT', 'John', NULL, 'Murray', 0),
	('The Letter to Titus', 'AB', 'Jerome', 'D', 'Quinn', 0),
	('The Epistles of John', 'AB', 'Raymond', 'E', 'Brown', 0),
	('Mark', 'AB', 'C. S.', NULL, 'Mann', 0)
) AS v(title, series_abbr, first_name, middle_name, last_name, sort_order)
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
-- Bible coverage
-- ---------------------------------------------------------------------------
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('1, 2 Samuel', 'NAC', '1 Samuel'),
	('1, 2 Samuel', 'NAC', '2 Samuel'),
	('The Epistles of Peter and of Jude', 'BNTC', '1 Peter'),
	('The Epistles of Peter and of Jude', 'BNTC', '2 Peter'),
	('The Epistles of Peter and of Jude', 'BNTC', 'Jude'),
	('The Epistle of St. Paul to the Galatians', 'CCL', 'Galatians'),
	('Revelation', 'IVPNTC', 'Revelation'),
	('The Epistle to the Romans', 'NICNT', 'Romans'),
	('The Letter to Titus', 'AB', 'Titus'),
	('The Epistles of John', 'AB', '1 John'),
	('The Epistles of John', 'AB', '2 John'),
	('The Epistles of John', 'AB', '3 John'),
	('Mark', 'AB', 'Mark')
) AS v(title, series_abbr, bible_book)
JOIN public.series s
	ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b
	ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);
