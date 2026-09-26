-- library_hatch_redpath_lxx_concordance: Baker 1983 reprint, one set row
-- (owner confirm 2026-09-26). Three Clarendon volumes bound as two books.
-- Hosted push only. DML-only (no gen-types).

INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Edwin', NULL::text, 'Hatch'),
	('Henry', 'A.', 'Redpath')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location,
	year, original_year, isbn, total_volumes,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, pub.id, v.publisher_location,
	v.year, v.original_year, v.isbn, v.total_volumes,
	'Greek Language Tools', 'monograph', 'english', 'reference', false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES (
	'A Concordance to the Septuagint and the Other Greek Versions of the Old Testament (Including the Apocryphal Books)',
	'Baker Book House',
	'Grand Rapids, MI',
	1983,
	1897,
	'9780801042706',
	2
)) AS v(title, publisher, publisher_location, year, original_year, isbn, total_volumes)
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.title = v.title
		AND b.series_id IS NULL
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', v.sort_order
FROM (VALUES
	(
		'A Concordance to the Septuagint and the Other Greek Versions of the Old Testament (Including the Apocryphal Books)',
		'Edwin',
		NULL::text,
		'Hatch',
		0
	),
	(
		'A Concordance to the Septuagint and the Other Greek Versions of the Old Testament (Including the Apocryphal Books)',
		'Henry',
		'A.',
		'Redpath',
		1
	)
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
