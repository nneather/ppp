-- library_nicot_ecclesiastes_longman: NICOT Ecclesiastes, 2nd ed. (owner confirm 2026-10-23).
-- Tremper Longman III already exists. NICOT + Eerdmans already exist.
-- Idempotent by title + series + edition. Hosted push only.

INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location, year, isbn,
	edition, series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, pub.id, v.publisher_location, v.year, v.isbn,
	v.edition, s.id, 'Commentary', 'monograph', 'english',
	'reference', false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'The Book of Ecclesiastes',
		'Eerdmans',
		'Grand Rapids, MI',
		2026,
		'9780802879059',
		'2nd ed.'
	)
) AS v(title, publisher, publisher_location, year, isbn, edition)
JOIN public.series s ON s.abbreviation = 'NICOT' AND s.deleted_at IS NULL
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.title = v.title
		AND b.series_id = s.id
		AND b.edition IS NOT DISTINCT FROM v.edition
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM (VALUES
	('The Book of Ecclesiastes', '2nd ed.', 'Tremper', 'Longman', 'III')
) AS v(title, edition, first_name, last_name, suffix)
JOIN public.series s ON s.abbreviation = 'NICOT' AND s.deleted_at IS NULL
JOIN public.books b
	ON b.title = v.title
	AND b.series_id = s.id
	AND b.edition IS NOT DISTINCT FROM v.edition
	AND b.deleted_at IS NULL
JOIN public.people p
	ON p.deleted_at IS NULL
	AND p.first_name = v.first_name
	AND p.middle_name IS NULL
	AND p.last_name = v.last_name
	AND p.suffix = v.suffix
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id
);

INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, 'Ecclesiastes', 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('The Book of Ecclesiastes', '2nd ed.')
) AS v(title, edition)
JOIN public.series s ON s.abbreviation = 'NICOT' AND s.deleted_at IS NULL
JOIN public.books b
	ON b.title = v.title
	AND b.series_id = s.id
	AND b.edition IS NOT DISTINCT FROM v.edition
	AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = 'Ecclesiastes'
);
