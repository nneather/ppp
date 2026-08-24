-- library_aug24_shelf_batch: commentaries + LOA writings (owner confirm 2026-08-24)
-- WBC = original Word / Waco printings (Craigie 1983 only, not Tate-revised).
-- ACCS IX = 2005 hardcover. American Sermons = Homiletics + new LOA series vol 108.
-- Lincoln Speeches and Writings already exist — attach LOA, do not re-insert.
-- Idempotent by natural keys. Hosted push only. DML-only (no gen-types).

-- ---------------------------------------------------------------------------
-- Series: Library of America
-- ---------------------------------------------------------------------------
INSERT INTO public.series (name, abbreviation, created_by)
SELECT v.name, v.abbreviation, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Library of America', 'LOA')
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
	('Peter', 'C.', 'Craigie'),
	('Leslie', 'C.', 'Allen'),
	('Stephen', 'S.', 'Smalley'),
	('Ralph', 'P.', 'Martin'),
	('Roy', 'E.', 'Ciampa'),
	('Brian', 'S.', 'Rosner'),
	('J.', 'Robert', 'Wright'),
	('Michael', NULL, 'Warner'),
	('George', NULL, 'Washington'),
	('John', NULL, 'Marshall'),
	('John', 'H.', 'Rhodehamel'),
	('Merrill', 'D.', 'Peterson'),
	('Charles', 'F.', 'Hobson'),
	('Don', 'E.', 'Fehrenbacher')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- New books (commentaries + LOA except existing Lincoln vols)
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
	('1 Peter', 'P&R Publishing', 'Phillipsburg, NJ', 2014, NULL::int, '9781596384699', NULL::text, 'REC', 'Commentary', 'monograph', 'reference'),
	('Psalms 1-50', 'Word', 'Waco, TX', 1983, NULL::int, '9780849902185', '19', 'WBC', 'Commentary', 'monograph', 'reference'),
	('Psalms 101-150', 'Word', 'Waco, TX', 1983, NULL::int, '9780849902208', '21', 'WBC', 'Commentary', 'monograph', 'reference'),
	('1, 2, 3 John', 'Word', 'Waco, TX', 1984, NULL::int, '9780849902505', '51', 'WBC', 'Commentary', 'monograph', 'reference'),
	('James', 'Word', 'Waco, TX', 1988, NULL::int, '9780849902475', '48', 'WBC', 'Commentary', 'monograph', 'reference'),
	('Psalms', 'IVP Academic', 'Downers Grove, IL', 2014, NULL::int, '9780830842858', '15', 'TOTC', 'Commentary', 'monograph', 'reference'),
	('American Sermons: The Pilgrims to Martin Luther King Jr.', 'Library of America', 'New York', 1999, NULL::int, '9781883011659', '108', 'LOA', 'Homiletics', 'edited_volume', 'unread'),
	('Proverbs, Ecclesiastes, Song of Solomon', 'IVP', 'Downers Grove, IL', 2005, NULL::int, '9780830814794', '9', 'ACCS', 'Commentary', 'edited_volume', 'reference'),
	('The First Letter to the Corinthians', 'Eerdmans', 'Grand Rapids, MI', 2010, NULL::int, '9780802837325', NULL::text, 'PNTC', 'Commentary', 'monograph', 'reference'),
	('Galatians', 'Baker Academic', 'Grand Rapids, MI', 2013, NULL::int, '9780801027543', NULL::text, 'BECNT', 'Commentary', 'monograph', 'reference'),
	('John', 'Baker Academic', 'Grand Rapids, MI', 2004, NULL::int, '9780801026447', NULL::text, 'BECNT', 'Commentary', 'monograph', 'reference'),
	('George Washington: Writings', 'Library of America', 'New York', 1997, NULL::int, '9781883011239', '91', 'LOA', 'History', 'monograph', 'unread'),
	('Thomas Jefferson: Writings', 'Library of America', 'New York', 1984, NULL::int, '9780940450165', '17', 'LOA', 'History', 'monograph', 'unread'),
	('John Marshall: Writings', 'Library of America', 'New York', 2010, NULL::int, '9781598530643', '198', 'LOA', 'History', 'monograph', 'unread')
) AS v(title, publisher, publisher_location, year, original_year, isbn, volume_number, series_abbr, genre, work_type, reading_status)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
LEFT JOIN public.publishers pub ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id = s.id
);

-- ---------------------------------------------------------------------------
-- Existing Lincoln LOA vols: attach series, normalize imprint / ISBN-13
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	title = v.title,
	publisher = 'Library of America',
	publisher_location = 'New York',
	isbn = v.isbn,
	volume_number = v.volume_number,
	series_id = s.id,
	updated_at = now()
FROM public.series s,
(VALUES
	(
		'61975051-baf6-4a2d-9b79-1beeafabd26b'::uuid,
		'Abraham Lincoln: Speeches and Writings 1832-1858',
		'45',
		'9780940450431'
	),
	(
		'66cad930-dbde-4b20-b21f-7c9a6f92ef04'::uuid,
		'Abraham Lincoln: Speeches and Writings 1859-1865',
		'46',
		'9780940450639'
	)
) AS v(id, title, volume_number, isbn)
WHERE s.abbreviation = 'LOA' AND s.deleted_at IS NULL
	AND b.id = v.id
	AND b.deleted_at IS NULL
	AND (
		b.title IS DISTINCT FROM v.title
		OR b.publisher IS DISTINCT FROM 'Library of America'
		OR b.publisher_location IS DISTINCT FROM 'New York'
		OR b.isbn IS DISTINCT FROM v.isbn
		OR b.volume_number IS DISTINCT FROM v.volume_number
		OR b.series_id IS DISTINCT FROM s.id
	);

-- ---------------------------------------------------------------------------
-- Authors / editors
-- ---------------------------------------------------------------------------
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('1 Peter', 'REC', 'Daniel', NULL, 'Doriani', 'author', 0),
	('Psalms 1-50', 'WBC', 'Peter', 'C.', 'Craigie', 'author', 0),
	('Psalms 101-150', 'WBC', 'Leslie', 'C.', 'Allen', 'author', 0),
	('1, 2, 3 John', 'WBC', 'Stephen', 'S.', 'Smalley', 'author', 0),
	('James', 'WBC', 'Ralph', 'P.', 'Martin', 'author', 0),
	('Psalms', 'TOTC', 'Tremper', NULL, 'Longman', 'author', 0),
	('American Sermons: The Pilgrims to Martin Luther King Jr.', 'LOA', 'Michael', NULL, 'Warner', 'editor', 0),
	('Proverbs, Ecclesiastes, Song of Solomon', 'ACCS', 'J.', 'Robert', 'Wright', 'editor', 0),
	('The First Letter to the Corinthians', 'PNTC', 'Roy', 'E.', 'Ciampa', 'author', 0),
	('The First Letter to the Corinthians', 'PNTC', 'Brian', 'S.', 'Rosner', 'author', 1),
	('Galatians', 'BECNT', 'Douglas', 'J.', 'Moo', 'author', 0),
	('John', 'BECNT', 'Andreas', 'J.', 'Köstenberger', 'author', 0),
	('George Washington: Writings', 'LOA', 'George', NULL, 'Washington', 'author', 0),
	('George Washington: Writings', 'LOA', 'John', 'H.', 'Rhodehamel', 'editor', 1),
	('Thomas Jefferson: Writings', 'LOA', 'Thomas', NULL, 'Jefferson', 'author', 0),
	('Thomas Jefferson: Writings', 'LOA', 'Merrill', 'D.', 'Peterson', 'editor', 1),
	('John Marshall: Writings', 'LOA', 'John', NULL, 'Marshall', 'author', 0),
	('John Marshall: Writings', 'LOA', 'Charles', 'F.', 'Hobson', 'editor', 1),
	('Abraham Lincoln: Speeches and Writings 1832-1858', 'LOA', 'Abraham', NULL, 'Lincoln', 'author', 0),
	('Abraham Lincoln: Speeches and Writings 1832-1858', 'LOA', 'Don', 'E.', 'Fehrenbacher', 'editor', 2),
	('Abraham Lincoln: Speeches and Writings 1859-1865', 'LOA', 'Abraham', NULL, 'Lincoln', 'author', 0),
	('Abraham Lincoln: Speeches and Writings 1859-1865', 'LOA', 'Don', 'E.', 'Fehrenbacher', 'editor', 1)
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

-- ---------------------------------------------------------------------------
-- Bible coverage (Commentaries only)
-- ---------------------------------------------------------------------------
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('1 Peter', 'REC', '1 Peter'),
	('Psalms 1-50', 'WBC', 'Psalms'),
	('Psalms 101-150', 'WBC', 'Psalms'),
	('1, 2, 3 John', 'WBC', '1 John'),
	('1, 2, 3 John', 'WBC', '2 John'),
	('1, 2, 3 John', 'WBC', '3 John'),
	('James', 'WBC', 'James'),
	('Psalms', 'TOTC', 'Psalms'),
	('Proverbs, Ecclesiastes, Song of Solomon', 'ACCS', 'Proverbs'),
	('Proverbs, Ecclesiastes, Song of Solomon', 'ACCS', 'Ecclesiastes'),
	('Proverbs, Ecclesiastes, Song of Solomon', 'ACCS', 'Song of Songs'),
	('The First Letter to the Corinthians', 'PNTC', '1 Corinthians'),
	('Galatians', 'BECNT', 'Galatians'),
	('John', 'BECNT', 'John')
) AS v(title, series_abbr, bible_book)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);
