-- library_aug5_shepherd_noll_vallier: three standalone shelf adds (owner confirm)
-- Idempotent by natural keys. Hosted push only. DML-only.

INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Michael', 'B.', 'Shepherd'),
	('Kevin', NULL, 'Vallier')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

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
		'How Did They Read the Prophets?: Early Jewish and Christian Interpretations',
		'Eerdmans', 'Grand Rapids, MI', 2025, NULL::int, '9780802885418',
		'Prophets', 'unread'
	),
	(
		'The Scandal of the Evangelical Mind',
		'Eerdmans', 'Grand Rapids, MI', 1994, NULL::int, '9780802837158',
		'Church History', 'unread'
	),
	(
		'All the Kingdoms of the World: On Radical Religious Alternatives to Liberalism',
		'Oxford University Press', 'Oxford', 2023, NULL::int, '9780197611371',
		'Politics and Policy', 'unread'
	)
) AS v(title, publisher, publisher_location, year, original_year, isbn, genre, reading_status)
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id IS NULL
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', v.sort_order
FROM (VALUES
	(
		'How Did They Read the Prophets?: Early Jewish and Christian Interpretations',
		'Michael', 'B.', 'Shepherd', 0
	),
	(
		'The Scandal of the Evangelical Mind',
		'Mark', 'A.', 'Noll', 0
	),
	(
		'All the Kingdoms of the World: On Radical Religious Alternatives to Liberalism',
		'Kevin', NULL, 'Vallier', 0
	)
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
