-- library_sep16_shelf_batch: NIDNTTE 5 vols, TGC AI Apocalypse, Lewis Poems,
-- Dostoevsky P&V Dead House, DPL 1st edition (owner confirm 2026-09-16).
-- DPL 2nd already in catalog — move citation abbr DPL → DPL2; 1993 1st gets DPL.
-- Reuse Fyodor Dostoevsky (not Dostoyevsky twin). Idempotent by natural keys.
-- Hosted push only. DML-only (no gen-types).

-- ---------------------------------------------------------------------------
-- Series: NIDNTTE (self-named; include_in_citation false like TDNT)
-- ---------------------------------------------------------------------------
INSERT INTO public.series (name, abbreviation, include_in_citation, created_by)
SELECT v.name, v.abbreviation, false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('New International Dictionary of New Testament Theology and Exegesis', 'NIDNTTE')
) AS v(name, abbreviation)
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = v.abbreviation
);

UPDATE public.series
SET include_in_citation = false, updated_at = now()
WHERE abbreviation = 'NIDNTTE'
	AND deleted_at IS NULL
	AND include_in_citation IS DISTINCT FROM false;

-- ---------------------------------------------------------------------------
-- People (new). Existing: Silva, Hansen, C. S. Lewis, Fyodor Dostoevsky,
-- Gerald F. Hawthorne, Ralph P. Martin.
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Skyler', 'R.', 'Flowers'),
	('Walter', NULL, 'Hooper'),
	('Richard', NULL, 'Pevear'),
	('Larissa', NULL, 'Volokhonsky'),
	('Daniel', 'G.', 'Reid')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- NIDNTTE vols 1–5 (same title + volume_number; per-vol ISBNs)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location, year, original_year, isbn,
	edition, volume_number, total_volumes, series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, pub.id, v.publisher_location, v.year, v.original_year, v.isbn,
	v.edition, v.volume_number, v.total_volumes, s.id, 'Biblical Reference', 'reference_work',
	'english', 'reference', false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('New International Dictionary of New Testament Theology and Exegesis', 'Zondervan Academic', 'Grand Rapids, MI', 2014, 1975, '9780310276159', 'Second', '1', 5),
	('New International Dictionary of New Testament Theology and Exegesis', 'Zondervan Academic', 'Grand Rapids, MI', 2014, 1975, '9780310276166', 'Second', '2', 5),
	('New International Dictionary of New Testament Theology and Exegesis', 'Zondervan Academic', 'Grand Rapids, MI', 2014, 1975, '9780310276173', 'Second', '3', 5),
	('New International Dictionary of New Testament Theology and Exegesis', 'Zondervan Academic', 'Grand Rapids, MI', 2014, 1975, '9780310276180', 'Second', '4', 5),
	('New International Dictionary of New Testament Theology and Exegesis', 'Zondervan Academic', 'Grand Rapids, MI', 2014, 1975, '9780310520078', 'Second', '5', 5)
) AS v(title, publisher, publisher_location, year, original_year, isbn, edition, volume_number, total_volumes)
JOIN public.series s ON s.abbreviation = 'NIDNTTE' AND s.deleted_at IS NULL
LEFT JOIN public.publishers pub ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.series_id = s.id
		AND b.volume_number = v.volume_number
);

-- ---------------------------------------------------------------------------
-- DPL 1993 1st (same title as 2023 2nd — key by ISBN, not title+series)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location, year, original_year, isbn,
	edition, citation_abbreviation, series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, pub.id, v.publisher_location, v.year, v.original_year, v.isbn,
	v.edition, v.citation_abbreviation, s.id, 'Biblical Reference', 'edited_volume',
	'english', 'reference', false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'Dictionary of Paul and His Letters',
		'IVP',
		'Downers Grove, IL',
		1993,
		NULL::int,
		'9780830817788',
		'First',
		'DPL'
	)
) AS v(title, publisher, publisher_location, year, original_year, isbn, edition, citation_abbreviation)
JOIN public.series s ON s.name = 'IVP Bible Dictionary Series' AND s.deleted_at IS NULL
LEFT JOIN public.publishers pub ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.isbn = v.isbn
);

-- ---------------------------------------------------------------------------
-- Standalone: TGC AI Apocalypse, Lewis Poems / Narrative Poems, P&V Dead House
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_id, publisher_location, year, original_year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.subtitle, v.publisher, pub.id, v.publisher_location, v.year, v.original_year, v.isbn,
	v.genre, v.work_type, 'english', v.reading_status, false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'The AI Apocalypse',
		'A Survival Guide for Humanity',
		'The Gospel Coalition',
		'Indianapolis, IN',
		2026,
		NULL::int,
		'9781956593211',
		'Applied Theology',
		'edited_volume',
		'unread'
	),
	(
		'Poems',
		NULL,
		'HarperOne',
		'San Francisco',
		2017,
		1964,
		'9780062643520',
		'Poetry',
		'monograph',
		'unread'
	),
	(
		'Narrative Poems',
		NULL,
		'HarperOne',
		'San Francisco',
		2017,
		1969,
		'9780062643681',
		'Poetry',
		'monograph',
		'unread'
	),
	(
		'Notes from a Dead House',
		NULL,
		'Vintage',
		'New York',
		2016,
		1862,
		'9780307949875',
		'Literature',
		'monograph',
		'unread'
	)
) AS v(title, subtitle, publisher, publisher_location, year, original_year, isbn, genre, work_type, reading_status)
LEFT JOIN public.publishers pub ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id IS NULL
);

-- ---------------------------------------------------------------------------
-- DPL 2nd: SBL-historical split — 1993 is DPL; 2023 becomes DPL2
-- ---------------------------------------------------------------------------
UPDATE public.books
SET citation_abbreviation = 'DPL2', updated_at = now()
WHERE id = 'c1d69b7a-4b80-41ae-afc4-cb500c567096'
	AND deleted_at IS NULL
	AND citation_abbreviation IS DISTINCT FROM 'DPL2';

-- ---------------------------------------------------------------------------
-- Authors / editors / translators
-- ---------------------------------------------------------------------------
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('New International Dictionary of New Testament Theology and Exegesis', 'NIDNTTE', 'Moisés', NULL, 'Silva', 'editor', 0)
) AS v(title, series_abbr, first_name, middle_name, last_name, role, sort_order)
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
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('9780830817788', 'Gerald', 'F.', 'Hawthorne', 'editor', 0),
	('9780830817788', 'Ralph', 'P.', 'Martin', 'editor', 1),
	('9780830817788', 'Daniel', 'G.', 'Reid', 'editor', 2)
) AS v(isbn, first_name, middle_name, last_name, role, sort_order)
JOIN public.books b ON b.isbn = v.isbn AND b.deleted_at IS NULL
JOIN public.people p ON p.deleted_at IS NULL
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
	('The AI Apocalypse', 'Collin', NULL, 'Hansen', 'editor', 0),
	('The AI Apocalypse', 'Skyler', 'R.', 'Flowers', 'editor', 1),
	('Poems', 'C.', 'S.', 'Lewis', 'author', 0),
	('Poems', 'Walter', NULL, 'Hooper', 'editor', 1),
	('Narrative Poems', 'C.', 'S.', 'Lewis', 'author', 0),
	('Narrative Poems', 'Walter', NULL, 'Hooper', 'editor', 1),
	('Notes from a Dead House', 'Fyodor', NULL, 'Dostoevsky', 'author', 0),
	('Notes from a Dead House', 'Richard', NULL, 'Pevear', 'translator', 1),
	('Notes from a Dead House', 'Larissa', NULL, 'Volokhonsky', 'translator', 2)
) AS v(title, first_name, middle_name, last_name, role, sort_order)
JOIN public.books b ON b.title = v.title AND b.series_id IS NULL AND b.deleted_at IS NULL
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id
);
