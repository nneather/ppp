-- library_aug12_shelf_batch: shelf adds + Fitzgerald FSG Homer remint (owner confirm 2026-08-12)
-- Idempotent by natural keys. Hosted push only. DML-only (no gen-types).

-- ---------------------------------------------------------------------------
-- Series: Oxford World's Classics
-- ---------------------------------------------------------------------------
INSERT INTO public.series (name, abbreviation, created_by)
SELECT v.name, v.abbreviation, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Oxford World''s Classics', 'OWC')
) AS v(name, abbreviation)
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = v.abbreviation
);

-- ---------------------------------------------------------------------------
-- People (new)
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('E. M. W.', NULL, 'Tillyard'),
	('Gary', 'N.', 'Knoppers'),
	('Saint', NULL, 'Anselm'),
	('Brian', NULL, 'Davies'),
	('G.', 'R.', 'Evans'),
	('Robert', NULL, 'Fitzgerald')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- Remint English Homer shelf copies → Fitzgerald / FSG (preserve book ids)
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	title = v.title,
	publisher = v.publisher,
	publisher_location = v.publisher_location,
	year = v.year,
	original_year = v.original_year,
	isbn = v.isbn,
	series_id = NULL,
	volume_number = NULL,
	genre = v.genre,
	work_type = 'monograph',
	language = 'english',
	reading_status = v.reading_status,
	needs_review = false,
	updated_at = now()
FROM (VALUES
	(
		'ac0c0aff-f3ed-4cba-8f45-87d1fd676332'::uuid,
		'The Iliad',
		'Farrar, Straus and Giroux',
		'New York, NY',
		2004,
		1974,
		'9780374529055',
		'Literature',
		'read'
	),
	(
		'38b8c941-caa7-4983-9341-e994f9ed06c7'::uuid,
		'The Odyssey',
		'Farrar, Straus and Giroux',
		'New York, NY',
		1998,
		1961,
		'9780374525743',
		'Literature',
		'read'
	)
) AS v(id, title, publisher, publisher_location, year, original_year, isbn, genre, reading_status)
WHERE b.id = v.id
	AND b.deleted_at IS NULL
	AND (
		b.title IS DISTINCT FROM v.title
		OR b.publisher IS DISTINCT FROM v.publisher
		OR b.publisher_location IS DISTINCT FROM v.publisher_location
		OR b.year IS DISTINCT FROM v.year
		OR b.original_year IS DISTINCT FROM v.original_year
		OR b.isbn IS DISTINCT FROM v.isbn
		OR b.series_id IS NOT NULL
		OR b.volume_number IS NOT NULL
		OR b.genre IS DISTINCT FROM v.genre
		OR b.reading_status IS DISTINCT FROM v.reading_status
	);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT v.book_id, p.id, 'translator', 1
FROM (VALUES
	('ac0c0aff-f3ed-4cba-8f45-87d1fd676332'::uuid, 'Robert', NULL, 'Fitzgerald'),
	('38b8c941-caa7-4983-9341-e994f9ed06c7'::uuid, 'Robert', NULL, 'Fitzgerald')
) AS v(book_id, first_name, middle_name, last_name)
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = v.book_id AND ba.person_id = p.id
);

-- ---------------------------------------------------------------------------
-- Books with series
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_location, year, original_year, isbn,
	volume_number, series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, v.publisher_location, v.year, v.original_year, v.isbn,
	v.volume_number, s.id, v.genre, v.work_type, 'english',
	v.reading_status, false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'Iliad, Volume II: Books 13–24',
		'Harvard University Press',
		'Cambridge, MA',
		1999,
		1925,
		'9780674995802',
		'171',
		'LCL',
		'Greek Language Tools',
		'monograph',
		'reference'
	),
	(
		'Odyssey, Volume I: Books 1–12',
		'Harvard University Press',
		'Cambridge, MA',
		1995,
		1919,
		'9780674995611',
		'104',
		'LCL',
		'Greek Language Tools',
		'monograph',
		'reference'
	),
	(
		'Anselm of Canterbury: The Major Works',
		'Oxford University Press',
		'Oxford',
		2008,
		NULL::int,
		'9780199540082',
		NULL,
		'OWC',
		'Church Fathers',
		'edited_volume',
		'unread'
	),
	(
		'1 Chronicles 1–9',
		'Doubleday',
		'Garden City, NY',
		2004,
		NULL::int,
		'9780385469289',
		'12',
		'AB',
		'Commentary',
		'monograph',
		'reference'
	),
	(
		'2 Corinthians',
		'P&R Publishing',
		NULL,
		2023,
		NULL::int,
		'9781629959146',
		NULL,
		'REC',
		'Commentary',
		'monograph',
		'reference'
	)
) AS v(
	title, publisher, publisher_location, year, original_year, isbn,
	volume_number, series_abbr, genre, work_type, reading_status
)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id = s.id
);

-- ---------------------------------------------------------------------------
-- Standalone: Personal Heresy (1939 Oxford; ISBN null)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_location, year, original_year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, v.publisher_location, v.year, v.original_year, v.isbn,
	v.genre, 'monograph', 'english', v.reading_status, false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'The Personal Heresy: A Controversy',
		'Oxford University Press',
		'Oxford',
		1939,
		NULL::int,
		NULL,
		'Literary Criticism',
		'unread'
	)
) AS v(title, publisher, publisher_location, year, original_year, isbn, genre, reading_status)
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id IS NULL
);

-- ---------------------------------------------------------------------------
-- book_authors
-- ---------------------------------------------------------------------------
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('The Personal Heresy: A Controversy', NULL::text, 'C.', 'S.', 'Lewis', 'author', 0),
	('The Personal Heresy: A Controversy', NULL::text, 'E. M. W.', NULL, 'Tillyard', 'author', 1),
	('Iliad, Volume II: Books 13–24', 'LCL', NULL, NULL, 'Homer', 'author', 0),
	('Odyssey, Volume I: Books 1–12', 'LCL', NULL, NULL, 'Homer', 'author', 0),
	('Anselm of Canterbury: The Major Works', 'OWC', 'Saint', NULL, 'Anselm', 'author', 0),
	('Anselm of Canterbury: The Major Works', 'OWC', 'Brian', NULL, 'Davies', 'editor', 1),
	('Anselm of Canterbury: The Major Works', 'OWC', 'G.', 'R.', 'Evans', 'editor', 2),
	('1 Chronicles 1–9', 'AB', 'Gary', 'N.', 'Knoppers', 'author', 0),
	('2 Corinthians', 'REC', 'Trent', NULL, 'Casto', 'author', 0)
) AS v(title, series_abbr, first_name, middle_name, last_name, role, sort_order)
LEFT JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.deleted_at IS NULL
	AND (
		(v.series_abbr IS NULL AND b.series_id IS NULL)
		OR b.series_id = s.id
	)
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id AND ba.role = v.role
);

-- ---------------------------------------------------------------------------
-- Bible coverage (commentaries)
-- ---------------------------------------------------------------------------
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('1 Chronicles 1–9', 'AB', '1 Chronicles'),
	('2 Corinthians', 'REC', '2 Corinthians')
) AS v(title, series_abbr, bible_book)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);
