-- library_nov14_shelf_batch: Goldingay BCOTWP Psalms (3 vols), Firth ApOTC 14,
-- Webb NSBT 10, Lloyd-Jones Life in the Spirit, Elliot Shadow of the Almighty.
-- Owner confirm 2026-11-14. Idempotent by natural keys. Hosted push only. DML-only.
--
-- Lloyd-Jones matches Carson Showing the Spirit: one monograph (not an essay),
-- the passage in the title, Ephesians coverage, and one passage section for
-- the span the whole volume expounds. Page span is the 1975 catalog extent
-- (371 pages). The public contents list has no page numbers, and the Banner
-- reprint's pages belong to a different setting.

INSERT INTO public.series (name, abbreviation, created_by)
SELECT
	'Baker Commentary on the Old Testament Wisdom and Psalms',
	'BCOTWP',
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = 'BCOTWP'
);

INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Barry', 'G', 'Webb')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- Series volumes. Webb is Biblical Theology; the Psalms volumes are Commentary.
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_id, publisher_location,
	year, original_year, isbn, volume_number, series_id,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.subtitle, v.publisher, pub.id, v.publisher_location,
	v.year, v.original_year, v.isbn, v.volume_number, s.id,
	v.genre, 'monograph', 'english', v.reading_status, false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'Psalms 1–41',
		NULL::text,
		'Baker Academic',
		'Grand Rapids, MI',
		2006,
		NULL::int,
		'9780801027031',
		'1',
		'BCOTWP',
		'Commentary',
		'reference'
	),
	(
		'Psalms 42–89',
		NULL::text,
		'Baker Academic',
		'Grand Rapids, MI',
		2007,
		NULL::int,
		'9780801027048',
		'2',
		'BCOTWP',
		'Commentary',
		'reference'
	),
	(
		'Psalms 90–150',
		NULL::text,
		'Baker Academic',
		'Grand Rapids, MI',
		2008,
		NULL::int,
		'9780801031434',
		'3',
		'BCOTWP',
		'Commentary',
		'reference'
	),
	(
		'Psalms',
		NULL::text,
		'Apollos',
		'London',
		2025,
		NULL::int,
		'9781789744859',
		'14',
		'ApOTC',
		'Commentary',
		'reference'
	),
	(
		'Five Festal Garments',
		'Christian Reflections on the Song of Songs, Ruth, Lamentations, Ecclesiastes and Esther',
		'IVP Academic',
		'Downers Grove, IL',
		2001,
		NULL::int,
		'9780830826100',
		'10',
		'NSBT',
		'Biblical Theology',
		'unread'
	)
) AS v(
	title, subtitle, publisher, publisher_location,
	year, original_year, isbn, volume_number, series_abbr,
	genre, reading_status
)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.title = v.title
		AND b.series_id = s.id
);

-- ---------------------------------------------------------------------------
-- Standalone. Lloyd-Jones passage stays in the title (Carson shape).
-- Elliot is the 1978 Harper & Row printing of the 1958 book.
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_location,
	year, original_year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.subtitle, v.publisher, v.publisher_location,
	v.year, v.original_year, v.isbn,
	v.genre, 'monograph', 'english', v.reading_status, false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'Life in the Spirit in Marriage, Home & Work: An Exposition of Ephesians 5:18–6:9',
		NULL::text,
		'Baker Book House',
		'Grand Rapids, MI',
		1975,
		1973,
		'9780801055508',
		'Homiletics',
		'unread'
	),
	(
		'Shadow of the Almighty',
		'The Life and Testament of Jim Elliot',
		'Harper & Row',
		'New York, NY',
		1978,
		1958,
		'9780060622114',
		'Biography',
		'unread'
	)
) AS v(
	title, subtitle, publisher, publisher_location,
	year, original_year, isbn, genre, reading_status
)
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.title = v.title
		AND b.series_id IS NULL
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM (VALUES
	('Psalms 1–41', 'BCOTWP', 'John', NULL::text, 'Goldingay'),
	('Psalms 42–89', 'BCOTWP', 'John', NULL::text, 'Goldingay'),
	('Psalms 90–150', 'BCOTWP', 'John', NULL::text, 'Goldingay'),
	('Psalms', 'ApOTC', 'David', 'G', 'Firth'),
	('Five Festal Garments', 'NSBT', 'Barry', 'G', 'Webb')
) AS v(title, series_abbr, first_name, middle_name, last_name)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b
	ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
JOIN public.people p
	ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM (VALUES
	(
		'Life in the Spirit in Marriage, Home & Work: An Exposition of Ephesians 5:18–6:9',
		'D.', 'M.', 'Lloyd-Jones'
	),
	(
		'Shadow of the Almighty',
		'Elisabeth', NULL::text, 'Elliot'
	)
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

INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Psalms 1–41', 'BCOTWP', 'Psalms'),
	('Psalms 42–89', 'BCOTWP', 'Psalms'),
	('Psalms 90–150', 'BCOTWP', 'Psalms'),
	('Psalms', 'ApOTC', 'Psalms')
) AS v(title, series_abbr, bible_book)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b
	ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);

-- Homiletics, so this stays off Commentaries: Ephesians. Same shape as
-- Carson Showing the Spirit: coverage lands on Also on the shelf.
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, 'Ephesians', 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM public.books b
WHERE b.deleted_at IS NULL
	AND b.series_id IS NULL
	AND b.title = 'Life in the Spirit in Marriage, Home & Work: An Exposition of Ephesians 5:18–6:9'
	AND NOT EXISTS (
		SELECT 1 FROM public.book_bible_coverage c
		WHERE c.book_id = b.id AND c.bible_book = 'Ephesians'
	);

-- Whole volume expounds Ephesians 5:18–6:9. verse_*_abs is trigger-filled.
INSERT INTO public.book_passage_sections (
	book_id, label, bible_book,
	chapter_start, verse_start, chapter_end, verse_end,
	page_start, page_end, created_by
)
SELECT
	b.id,
	'Life in the Spirit',
	'Ephesians',
	5, 18, 6, 9,
	'1', '371',
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM public.books b
WHERE b.deleted_at IS NULL
	AND b.series_id IS NULL
	AND b.title = 'Life in the Spirit in Marriage, Home & Work: An Exposition of Ephesians 5:18–6:9'
	AND NOT EXISTS (
		SELECT 1 FROM public.book_passage_sections s
		WHERE s.book_id = b.id
			AND s.deleted_at IS NULL
			AND s.bible_book = 'Ephesians'
			AND s.chapter_start = 5
			AND s.verse_start = 18
	);
