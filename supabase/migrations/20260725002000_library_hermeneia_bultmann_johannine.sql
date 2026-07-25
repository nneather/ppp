-- library_hermeneia_bultmann_johannine
-- Add Hermeneia series + Bultmann The Johannine Epistles (Fortress 1973).
-- Rename Rudolph → Rudolf Bultmann; attach translators + Funk editor.
-- Idempotent by natural keys. Hosted push only.

-- 1) Series
INSERT INTO public.series (name, abbreviation, created_by)
SELECT v.name, v.abbreviation, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Hermeneia', 'Herm')
) AS v(name, abbreviation)
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = v.abbreviation
);

-- 2) Rename Rudolph → Rudolf (existing person; refreshes author_display via trigger)
UPDATE public.people
SET first_name = 'Rudolf'
WHERE deleted_at IS NULL
	AND first_name = 'Rudolph'
	AND middle_name IS NULL
	AND last_name = 'Bultmann';

-- 3) People (translators; Funk already exists as Robert / W. / Funk)
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('R. Philip', NULL::text, 'O''Hara'),
	('Lane', 'C.', 'McGaughy')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- 4) Book
INSERT INTO public.books (
	title, publisher, publisher_location, year, original_year, isbn,
	volume_number, series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, v.publisher_location, v.year, v.original_year, v.isbn,
	v.volume_number, s.id, 'Commentary', 'monograph', 'english',
	'reference', false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'The Johannine Epistles',
		'Fortress Press',
		'Philadelphia',
		1973,
		1967,
		'9780800660031',
		NULL::text,
		'Herm'
	)
) AS v(title, publisher, publisher_location, year, original_year, isbn, volume_number, series_abbr)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id = s.id
);

-- 5) Credits (title-page order)
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('The Johannine Epistles', 'Herm', 'Rudolf', NULL::text, 'Bultmann', 'author', 0),
	('The Johannine Epistles', 'Herm', 'R. Philip', NULL::text, 'O''Hara', 'translator', 1),
	('The Johannine Epistles', 'Herm', 'Lane', 'C.', 'McGaughy', 'translator', 2),
	('The Johannine Epistles', 'Herm', 'Robert', 'W.', 'Funk', 'translator', 3),
	('The Johannine Epistles', 'Herm', 'Robert', 'W.', 'Funk', 'editor', 4)
) AS v(title, series_abbr, first_name, middle_name, last_name, role, sort_order)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id AND ba.role = v.role
);

-- 6) Bible coverage (1–3 John)
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('The Johannine Epistles', 'Herm', '1 John'),
	('The Johannine Epistles', 'Herm', '2 John'),
	('The Johannine Epistles', 'Herm', '3 John')
) AS v(title, series_abbr, bible_book)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);
