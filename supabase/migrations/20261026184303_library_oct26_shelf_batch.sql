-- library_oct26_shelf_batch: Loftus, Chiang, Mouw, McLaughlin, Nelson's manual
-- (owner confirm 2026-10-26). Idempotent by natural keys. Hosted push only.
-- DML-only (no gen-types). No series. No new publishers-registry rows.
-- Vintage and The Gospel Coalition stay free-text. IVP, Eerdmans, and
-- Thomas Nelson link to existing publisher rows.
-- Nelson's Minister's Manual has no author (do not attach the Thomas Nelson person).
-- Matthew Loftus is a new person (do not reuse the last-name-only Loftus row).

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Matthew', NULL::text, 'Loftus'),
	('Ted', NULL::text, 'Chiang'),
	('Richard', 'J', 'Mouw')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- Standalone books
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, edition, publisher, publisher_id, publisher_location,
	year, original_year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.subtitle, v.edition, v.publisher, pub.id, v.publisher_location,
	v.year, v.original_year, v.isbn,
	v.genre, 'monograph', 'english', v.reading_status, false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'Resisting Therapy Culture',
		'The Dangers of Pop Psychology and How the Church Can Respond',
		NULL::text,
		'IVP',
		'Downers Grove, IL',
		2026,
		NULL::int,
		'9781514012680',
		'Culture',
		'unread'
	),
	(
		'Stories of Your Life and Others',
		NULL::text,
		NULL::text,
		'Vintage',
		'New York',
		2016,
		NULL::int,
		'9781101972120',
		'Literature',
		'unread'
	),
	(
		'When the Kings Come Marching In',
		'Isaiah and the New Jerusalem',
		'Revised',
		'Eerdmans',
		'Grand Rapids, MI',
		2002,
		1983,
		'9780802839961',
		'Culture',
		'unread'
	),
	(
		'Jesus Through the Eyes of Women',
		'How the First Female Disciples Help Us Know and Love the Lord',
		NULL::text,
		'The Gospel Coalition',
		'Indianapolis, IN',
		2022,
		NULL::int,
		'9781956593075',
		'Gospels and Jesus',
		'unread'
	),
	(
		'Nelson''s Minister''s Manual',
		NULL::text,
		'NKJV',
		'Thomas Nelson',
		'Nashville, TN',
		2003,
		NULL::int,
		'9780785250890',
		'Pastoral Ministry',
		'reference'
	)
) AS v(
	title, subtitle, edition, publisher, publisher_location,
	year, original_year, isbn, genre, reading_status
)
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.title = v.title
		AND b.series_id IS NULL
);

-- ---------------------------------------------------------------------------
-- Authors (manual is authorless)
-- ---------------------------------------------------------------------------
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM (VALUES
	('Resisting Therapy Culture', 'Matthew', NULL::text, 'Loftus'),
	('Stories of Your Life and Others', 'Ted', NULL::text, 'Chiang'),
	('When the Kings Come Marching In', 'Richard', 'J', 'Mouw'),
	('Jesus Through the Eyes of Women', 'Rebecca', NULL::text, 'McLaughlin')
) AS v(title, first_name, middle_name, last_name)
JOIN public.books b
	ON b.title = v.title AND b.series_id IS NULL AND b.deleted_at IS NULL
JOIN public.people p
	ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id
);
