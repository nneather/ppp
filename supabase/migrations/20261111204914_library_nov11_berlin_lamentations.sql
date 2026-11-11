-- library_nov11_berlin_lamentations: Adele Berlin, Lamentations (OTL).
-- Owner confirm 2026-11-11: hardcover 2002, ISBN 9780664218492.
-- Idempotent by natural keys. Hosted push only. DML-only (no gen-types).
-- Adele Berlin and series OTL already exist. Westminster John Knox links
-- to the existing publisher row. Subtitle omitted, matching the other OTL rows.

INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location,
	year, isbn, series_id,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	'Lamentations',
	'Westminster John Knox',
	pub.id,
	'Louisville, KY',
	2002,
	'9780664218492',
	s.id,
	'Commentary',
	'monograph',
	'english',
	'reference',
	false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM public.series s
LEFT JOIN public.publishers pub
	ON pub.canonical_name = 'Westminster John Knox' AND pub.deleted_at IS NULL
WHERE s.abbreviation = 'OTL'
	AND s.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.books b
		WHERE b.deleted_at IS NULL
			AND b.title = 'Lamentations'
			AND b.series_id = s.id
	);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.series s
JOIN public.books b
	ON b.title = 'Lamentations' AND b.series_id = s.id AND b.deleted_at IS NULL
JOIN public.people p
	ON p.deleted_at IS NULL
	AND p.first_name = 'Adele'
	AND p.middle_name IS NULL
	AND p.last_name = 'Berlin'
WHERE s.abbreviation = 'OTL'
	AND s.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.book_authors ba
		WHERE ba.book_id = b.id AND ba.person_id = p.id
	);

INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, 'Lamentations', 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM public.series s
JOIN public.books b
	ON b.title = 'Lamentations' AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE s.abbreviation = 'OTL'
	AND s.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.book_bible_coverage c
		WHERE c.book_id = b.id AND c.bible_book = 'Lamentations'
	);
