-- library_becnt_bock_synopsis_batch: Brill Leiden Synopsis (3) + Bock BECNT Luke/Acts + Marshall TNTC Acts + Schreiner ZECNT Galatians
-- Idempotent by natural keys. Hosted push only. Owner confirm 2026-07-24.

-- Series: Synopsis of a Purer Theology (SPT)
INSERT INTO public.series (name, abbreviation, created_by)
SELECT v.name, v.abbreviation, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Synopsis of a Purer Theology', 'SPT')
) AS v(name, abbreviation)
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = v.abbreviation
);

-- People (Leiden authors + modern editors/translator; Bock/Marshall/Schreiner already exist)
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Johannes', NULL, 'Polyander'),
	('Andreas', NULL, 'Rivetus'),
	('Antonius', NULL, 'Walaeus'),
	('Anthonius', NULL, 'Thysius'),
	('Roelf', 'T.', 'te Velde'),
	('Henk', NULL, 'van den Belt'),
	('Harm', NULL, 'Goris'),
	('Riemer', 'A.', 'Faber')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- Books: Leiden Synopsis (Systematic Theology / edited_volume)
INSERT INTO public.books (
	title, publisher, publisher_location, year, original_year, isbn,
	volume_number, series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, v.publisher_location, v.year, v.original_year, v.isbn,
	v.volume_number, s.id, 'Systematic Theology', 'edited_volume', 'english',
	'reference', false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Synopsis of a Purer Theology, Volume 1: Disputations 1–23', 'Brill', 'Leiden', 2014, 1625, '9789004192188', '1', 'SPT'),
	('Synopsis of a Purer Theology, Volume 2: Disputations 24–42', 'Brill', 'Leiden', 2016, 1625, '9789004324213', '2', 'SPT'),
	('Synopsis of a Purer Theology, Volume 3: Disputations 43–52', 'Brill', 'Leiden', 2020, 1625, '9789004329966', '3', 'SPT')
) AS v(title, publisher, publisher_location, year, original_year, isbn, volume_number, series_abbr)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id = s.id
);

-- Books: Bock BECNT + Marshall TNTC + Schreiner ZECNT (Commentary)
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
	('Luke 1:1–9:50', 'Baker Academic', 'Grand Rapids, MI', 1994, NULL::int, '9780801010538', NULL, 'BECNT'),
	('Luke 9:51–24:53', 'Baker Academic', 'Grand Rapids, MI', 1996, NULL::int, '9780801010521', NULL, 'BECNT'),
	('Acts', 'Baker Academic', 'Grand Rapids, MI', 2007, NULL::int, '9780801026683', NULL, 'BECNT'),
	('Acts', 'IVP Academic', 'Downers Grove, IL', 2008, 1980, '9780830842353', '5', 'TNTC'),
	('Galatians', 'Zondervan', 'Grand Rapids, MI', 2010, NULL::int, '9780310243724', NULL, 'ZECNT')
) AS v(title, publisher, publisher_location, year, original_year, isbn, volume_number, series_abbr)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id = s.id
);

-- Authors: Leiden professors (all three SPT volumes)
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', v.sort_order
FROM (VALUES
	('Synopsis of a Purer Theology, Volume 1: Disputations 1–23', 'SPT', 'Johannes', NULL, 'Polyander', 0),
	('Synopsis of a Purer Theology, Volume 1: Disputations 1–23', 'SPT', 'Andreas', NULL, 'Rivetus', 1),
	('Synopsis of a Purer Theology, Volume 1: Disputations 1–23', 'SPT', 'Antonius', NULL, 'Walaeus', 2),
	('Synopsis of a Purer Theology, Volume 1: Disputations 1–23', 'SPT', 'Anthonius', NULL, 'Thysius', 3),
	('Synopsis of a Purer Theology, Volume 2: Disputations 24–42', 'SPT', 'Johannes', NULL, 'Polyander', 0),
	('Synopsis of a Purer Theology, Volume 2: Disputations 24–42', 'SPT', 'Andreas', NULL, 'Rivetus', 1),
	('Synopsis of a Purer Theology, Volume 2: Disputations 24–42', 'SPT', 'Antonius', NULL, 'Walaeus', 2),
	('Synopsis of a Purer Theology, Volume 2: Disputations 24–42', 'SPT', 'Anthonius', NULL, 'Thysius', 3),
	('Synopsis of a Purer Theology, Volume 3: Disputations 43–52', 'SPT', 'Johannes', NULL, 'Polyander', 0),
	('Synopsis of a Purer Theology, Volume 3: Disputations 43–52', 'SPT', 'Andreas', NULL, 'Rivetus', 1),
	('Synopsis of a Purer Theology, Volume 3: Disputations 43–52', 'SPT', 'Antonius', NULL, 'Walaeus', 2),
	('Synopsis of a Purer Theology, Volume 3: Disputations 43–52', 'SPT', 'Anthonius', NULL, 'Thysius', 3)
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

-- Volume editors + Faber translator
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('Synopsis of a Purer Theology, Volume 1: Disputations 1–23', 'SPT', 'Roelf', 'T.', 'te Velde', 'editor', 4),
	('Synopsis of a Purer Theology, Volume 1: Disputations 1–23', 'SPT', 'Riemer', 'A.', 'Faber', 'translator', 5),
	('Synopsis of a Purer Theology, Volume 2: Disputations 24–42', 'SPT', 'Henk', NULL, 'van den Belt', 'editor', 4),
	('Synopsis of a Purer Theology, Volume 2: Disputations 24–42', 'SPT', 'Riemer', 'A.', 'Faber', 'translator', 5),
	('Synopsis of a Purer Theology, Volume 3: Disputations 43–52', 'SPT', 'Harm', NULL, 'Goris', 'editor', 4),
	('Synopsis of a Purer Theology, Volume 3: Disputations 43–52', 'SPT', 'Riemer', 'A.', 'Faber', 'translator', 5)
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

-- Commentary authors
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', v.sort_order
FROM (VALUES
	('Luke 1:1–9:50', 'BECNT', 'Darrell', 'L.', 'Bock', 0),
	('Luke 9:51–24:53', 'BECNT', 'Darrell', 'L.', 'Bock', 0),
	('Acts', 'BECNT', 'Darrell', 'L.', 'Bock', 0),
	('Acts', 'TNTC', 'I.', 'Howard', 'Marshall', 0),
	('Galatians', 'ZECNT', 'Thomas', 'R.', 'Schreiner', 0)
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

-- Bible coverage (commentaries only)
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Luke 1:1–9:50', 'BECNT', 'Luke'),
	('Luke 9:51–24:53', 'BECNT', 'Luke'),
	('Acts', 'BECNT', 'Acts'),
	('Acts', 'TNTC', 'Acts'),
	('Galatians', 'ZECNT', 'Galatians')
) AS v(title, series_abbr, bible_book)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);
