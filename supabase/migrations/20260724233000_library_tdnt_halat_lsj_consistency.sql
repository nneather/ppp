-- library_tdnt_halat_lsj_consistency
-- Remint TDNT (Eerdmans years, publisher, total_volumes, series omit);
-- remint German HAL → HALAT (clean titles, abbr rename); add LSJ;
-- fix abridged Liddell & Scott people + review flag.
-- Owner confirm 2026-07-24 (1A/2A/3B/4A-no-vol5/5A/6/7). Idempotent. Hosted push only.

-- ---------------------------------------------------------------------------
-- People (LSJ reviser + fix null Liddell/Scott used by abridged)
-- ---------------------------------------------------------------------------
UPDATE public.people p
SET
	first_name = 'Henry',
	middle_name = 'George',
	updated_at = now()
WHERE p.id = 'ffa74efb-7708-4ba5-8c42-33ee6aa8ccd0'::uuid
	AND p.deleted_at IS NULL
	AND (
		p.first_name IS DISTINCT FROM 'Henry'
		OR p.middle_name IS DISTINCT FROM 'George'
	);

UPDATE public.people p
SET
	first_name = 'Robert',
	updated_at = now()
WHERE p.id = '75d314cf-4869-4cf4-9e5b-4a6c288156b3'::uuid
	AND p.deleted_at IS NULL
	AND p.first_name IS DISTINCT FROM 'Robert';

INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Henry', 'Stuart', 'Jones')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- Series: TDNT omit self-named; HALOT → HALAT (German set)
-- ---------------------------------------------------------------------------
UPDATE public.series s
SET
	include_in_citation = false,
	updated_at = now()
WHERE s.deleted_at IS NULL
	AND s.abbreviation = 'TDNT'
	AND s.include_in_citation IS DISTINCT FROM false;

UPDATE public.series s
SET
	name = 'Hebräisches und Aramäisches Lexikon zum Alten Testament',
	abbreviation = 'HALAT',
	include_in_citation = false,
	updated_at = now()
WHERE s.deleted_at IS NULL
	AND s.abbreviation = 'HALOT'
	AND (
		s.name IS DISTINCT FROM 'Hebräisches und Aramäisches Lexikon zum Alten Testament'
		OR s.abbreviation IS DISTINCT FROM 'HALAT'
		OR s.include_in_citation IS DISTINCT FROM false
	);

INSERT INTO public.series (name, abbreviation, include_in_citation, created_by)
SELECT 'A Greek-English Lexicon', 'LSJ', false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = 'LSJ'
);

-- ---------------------------------------------------------------------------
-- TDNT vols 1–10 — Eerdmans English print years; clear junk publisher/ISBN
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher_id = e.id,
	publisher = 'Eerdmans',
	publisher_location = 'Grand Rapids, MI',
	year = v.year,
	isbn = NULL,
	total_volumes = 10,
	work_type = 'reference_work',
	updated_at = now()
FROM public.publishers e,
	(VALUES
		('daa28d71-cba5-482a-8c92-c85a4c7875d0'::uuid, 1964), -- vol 1
		('da33c11a-63e3-4ae2-9584-55c8aff8ce9c'::uuid, 1964), -- vol 2
		('8aeb538d-d92b-4b30-a533-b8bd11f4075c'::uuid, 1966), -- vol 3
		('d0c4159a-a2a3-4d49-97d4-7c3422ffb088'::uuid, 1967), -- vol 4
		('1d958290-9a2b-4bd2-a363-09389d8ab411'::uuid, 1968), -- vol 5
		('fbb9bd5d-3191-4280-b5ae-8eccb8a3aed6'::uuid, 1969), -- vol 6
		('7fd168bb-b908-4e8a-a0b9-b057faea5ebd'::uuid, 1971), -- vol 7
		('edbfc574-e5d8-4809-9076-2e9f48933440'::uuid, 1972), -- vol 8
		('61e3edc8-b374-4bce-ade0-0a2951e31975'::uuid, 1974), -- vol 9
		('4ea50b6b-4552-488e-859c-ba11b3af965b'::uuid, 1976)  -- vol 10
	) AS v(id, year)
WHERE b.id = v.id
	AND b.deleted_at IS NULL
	AND e.deleted_at IS NULL
	AND e.canonical_name = 'Eerdmans'
	AND (
		b.publisher_id IS DISTINCT FROM e.id
		OR b.publisher IS DISTINCT FROM 'Eerdmans'
		OR b.publisher_location IS DISTINCT FROM 'Grand Rapids, MI'
		OR b.year IS DISTINCT FROM v.year
		OR b.isbn IS DISTINCT FROM NULL
		OR b.total_volumes IS DISTINCT FROM 10
		OR b.work_type IS DISTINCT FROM 'reference_work'
	);

-- ---------------------------------------------------------------------------
-- HALAT vols 1–4 — clean German title; set completeness = 5; clear review
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	title = 'Hebräisches und Aramäisches Lexikon zum Alten Testament',
	total_volumes = 5,
	publisher_id = br.id,
	publisher = 'Brill',
	publisher_location = 'Leiden',
	work_type = 'reference_work',
	language = 'german',
	needs_review = false,
	needs_review_note = CASE
		WHEN b.needs_review_note ~* '^Missing:\s' THEN NULL
		ELSE b.needs_review_note
	END,
	updated_at = now()
FROM public.publishers br
WHERE b.deleted_at IS NULL
	AND br.deleted_at IS NULL
	AND br.canonical_name = 'Brill'
	AND b.id IN (
		'62ca97ed-000b-4c95-b303-5b97e2e1f263'::uuid, -- 1
		'bd4d6b52-b867-41f7-9a4f-d19bbd1ab3ec'::uuid, -- 2
		'e60bc2f5-7243-43e5-980c-1e2b06397543'::uuid, -- 3
		'da3f4e7d-c4fe-45d5-b406-87e34d68682d'::uuid  -- 4
	)
	AND (
		b.title IS DISTINCT FROM 'Hebräisches und Aramäisches Lexikon zum Alten Testament'
		OR b.total_volumes IS DISTINCT FROM 5
		OR b.publisher_id IS DISTINCT FROM br.id
		OR b.publisher IS DISTINCT FROM 'Brill'
		OR b.publisher_location IS DISTINCT FROM 'Leiden'
		OR b.work_type IS DISTINCT FROM 'reference_work'
		OR b.language IS DISTINCT FROM 'german'
		OR b.needs_review IS DISTINCT FROM false
	);

-- ---------------------------------------------------------------------------
-- Abridged Liddell & Scott — work_type + clear review (people fixed above)
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	title = 'A Lexicon Abridged from Liddell and Scott''s Greek-English Lexicon',
	work_type = 'reference_work',
	publisher_id = o.id,
	publisher = 'Oxford University Press',
	publisher_location = 'Oxford',
	needs_review = false,
	needs_review_note = CASE
		WHEN b.needs_review_note ~* '^Missing:\s' THEN NULL
		ELSE b.needs_review_note
	END,
	updated_at = now()
FROM public.publishers o
WHERE b.id = '637a57cb-aa6a-4d88-867e-f69bd8ff1fca'::uuid
	AND b.deleted_at IS NULL
	AND o.deleted_at IS NULL
	AND o.canonical_name = 'Oxford University Press'
	AND (
		b.title IS DISTINCT FROM 'A Lexicon Abridged from Liddell and Scott''s Greek-English Lexicon'
		OR b.work_type IS DISTINCT FROM 'reference_work'
		OR b.publisher_id IS DISTINCT FROM o.id
		OR b.publisher IS DISTINCT FROM 'Oxford University Press'
		OR b.publisher_location IS DISTINCT FROM 'Oxford'
		OR b.needs_review IS DISTINCT FROM false
	);

-- ---------------------------------------------------------------------------
-- LSJ — full 9th ed. with revised supplement (1996)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, edition, publisher, publisher_location, publisher_id,
	year, series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	'A Greek-English Lexicon',
	'9th ed. with revised supplement',
	'Clarendon Press',
	'Oxford',
	o.id,
	1996,
	s.id,
	'Greek Language Tools',
	'reference_work',
	'english',
	'reference',
	false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM public.series s
JOIN public.publishers o ON o.deleted_at IS NULL AND o.canonical_name = 'Oxford University Press'
WHERE s.deleted_at IS NULL
	AND s.abbreviation = 'LSJ'
	AND NOT EXISTS (
		SELECT 1 FROM public.books b
		WHERE b.deleted_at IS NULL
			AND b.title = 'A Greek-English Lexicon'
			AND b.series_id = s.id
	);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('Henry', 'George', 'Liddell', 'author', 0),
	('Robert', NULL::text, 'Scott', 'author', 1),
	('Henry', 'Stuart', 'Jones', 'editor', 2)
) AS v(first_name, middle_name, last_name, role, sort_order)
JOIN public.series s ON s.abbreviation = 'LSJ' AND s.deleted_at IS NULL
JOIN public.books b ON b.title = 'A Greek-English Lexicon'
	AND b.series_id = s.id
	AND b.deleted_at IS NULL
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id AND ba.role = v.role
);
