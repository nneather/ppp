-- library_sep9_shelf_batch: Thiselton Two Horizons, Kidner KCC/BST, Leo XIV encyclical,
-- Sklar Additional Notes (Exod/Lev/Num), ACCS OT III (owner confirm).
-- Idempotent by natural keys. Hosted push only. DML-only (no gen-types).

-- ---------------------------------------------------------------------------
-- People (new): Leo XIV; Joseph T. Lienhard (ACCS OT III volume editor)
-- Existing: Anthony C. Thiselton, Derek Kidner, Jay Sklar
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Leo', NULL, 'XIV'),
	('Joseph', 'T.', 'Lienhard')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- Series books: Kidner KCC + BST, ACCS OT III
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location, year, original_year, isbn,
	volume_number, series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, pub.id, v.publisher_location, v.year, v.original_year, v.isbn,
	v.volume_number, s.id, v.genre, v.work_type, 'english',
	v.reading_status, false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Ezra and Nehemiah', 'IVP Academic', 'Downers Grove, IL', 2024, 1979, '9781514005422', NULL::text, 'KCC', 'Commentary', 'monograph', 'reference'),
	('The Message of Ecclesiastes', 'IVP Academic', 'Downers Grove, IL', 2023, 1976, '9781514006313', NULL::text, 'BST', 'Commentary', 'monograph', 'reference'),
	('Exodus, Leviticus, Numbers, Deuteronomy', 'IVP', 'Downers Grove, IL', 2001, NULL::int, '9780830814732', '3', 'ACCS', 'Commentary', 'edited_volume', 'reference')
) AS v(title, publisher, publisher_location, year, original_year, isbn, volume_number, series_abbr, genre, work_type, reading_status)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
LEFT JOIN public.publishers pub ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id = s.id
);

-- ---------------------------------------------------------------------------
-- Standalone: Thiselton Two Horizons, Leo XIV encyclical, Sklar Additional Notes
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location, year, original_year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, pub.id, v.publisher_location, v.year, v.original_year, v.isbn,
	v.genre, v.work_type, 'english', v.reading_status, false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'The Two Horizons: New Testament Hermeneutics and Philosophical Description',
		'Eerdmans',
		'Grand Rapids, MI',
		1980,
		NULL::int,
		'9780802800060',
		'New Testament',
		'monograph',
		'unread'
	),
	(
		'Magnifica humanitas: Encyclical Letter on Safeguarding the Human Person in the Time of Artificial Intelligence',
		'Libreria Editrice Vaticana',
		'Vatican City',
		2026,
		NULL::int,
		'9788826610979',
		'Ethics',
		'monograph',
		'unread'
	),
	('Additional Notes on Exodus', 'Gleanings Press', 'St. Louis, MO', 2025, NULL::int, '9798290081069', 'Commentary', 'monograph', 'reference'),
	('Additional Notes on Leviticus', 'Gleanings Press', 'St. Louis, MO', 2023, NULL::int, '9798862875553', 'Commentary', 'monograph', 'reference'),
	('Additional Notes on Numbers', 'Gleanings Press', 'St. Louis, MO', 2023, NULL::int, '9798862879445', 'Commentary', 'monograph', 'reference')
) AS v(title, publisher, publisher_location, year, original_year, isbn, genre, work_type, reading_status)
LEFT JOIN public.publishers pub ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id IS NULL
);

-- ---------------------------------------------------------------------------
-- Authors / editors
-- ---------------------------------------------------------------------------
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('Ezra and Nehemiah', 'KCC', 'Derek', NULL, 'Kidner', 'author', 0),
	('The Message of Ecclesiastes', 'BST', 'Derek', NULL, 'Kidner', 'author', 0),
	('Exodus, Leviticus, Numbers, Deuteronomy', 'ACCS', 'Joseph', 'T.', 'Lienhard', 'editor', 0)
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
	('The Two Horizons: New Testament Hermeneutics and Philosophical Description', 'Anthony', 'C.', 'Thiselton', 'author', 0),
	('Magnifica humanitas: Encyclical Letter on Safeguarding the Human Person in the Time of Artificial Intelligence', 'Leo', NULL, 'XIV', 'author', 0),
	('Additional Notes on Exodus', 'Jay', NULL, 'Sklar', 'author', 0),
	('Additional Notes on Leviticus', 'Jay', NULL, 'Sklar', 'author', 0),
	('Additional Notes on Numbers', 'Jay', NULL, 'Sklar', 'author', 0)
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

-- ---------------------------------------------------------------------------
-- Bible coverage (Commentaries only)
-- ---------------------------------------------------------------------------
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Ezra and Nehemiah', 'KCC', 'Ezra'),
	('Ezra and Nehemiah', 'KCC', 'Nehemiah'),
	('The Message of Ecclesiastes', 'BST', 'Ecclesiastes'),
	('Exodus, Leviticus, Numbers, Deuteronomy', 'ACCS', 'Exodus'),
	('Exodus, Leviticus, Numbers, Deuteronomy', 'ACCS', 'Leviticus'),
	('Exodus, Leviticus, Numbers, Deuteronomy', 'ACCS', 'Numbers'),
	('Exodus, Leviticus, Numbers, Deuteronomy', 'ACCS', 'Deuteronomy')
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
	('Additional Notes on Exodus', 'Exodus'),
	('Additional Notes on Leviticus', 'Leviticus'),
	('Additional Notes on Numbers', 'Numbers')
) AS v(title, bible_book)
JOIN public.books b ON b.title = v.title AND b.series_id IS NULL AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);
