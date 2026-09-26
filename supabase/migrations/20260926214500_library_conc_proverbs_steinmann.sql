-- library_conc_proverbs_steinmann: ConC Proverbs, Andrew E. Steinmann
-- (owner confirm 2026-09-26, year 2009). Idempotent by natural keys.
-- Hosted push only. DML-only (no gen-types).

INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Andrew', 'E.', 'Steinmann')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

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
	('Proverbs', 'Concordia Pub. House', 'Saint Louis', 2009, '9780758603203', 'ConC')
) AS v(title, publisher, publisher_location, year, isbn, series_abbr)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id = s.id
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', v.sort_order
FROM (VALUES
	('Proverbs', 'ConC', 'Andrew', 'E.', 'Steinmann', 0)
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

INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Proverbs', 'ConC', 'Proverbs')
) AS v(title, series_abbr, bible_book)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);
