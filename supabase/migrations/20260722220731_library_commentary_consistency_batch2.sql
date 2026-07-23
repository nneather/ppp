-- library_commentary_consistency_batch2
-- Owner-confirmed: series creates/attaches, TOTC/TNTC vols, metadata fixes,
-- Beale title "The Book of Revelation", Milgrom name typo.

-- ---------------------------------------------------------------------------
-- Series (new)
-- ---------------------------------------------------------------------------
INSERT INTO public.series (name, abbreviation, created_by)
SELECT v.name, v.abbreviation, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Christian Standard Commentary', 'CSC'),
	('The Bible Speaks Today', 'BST'),
	('NIV Application Commentary', 'NIVAC'),
	('Cornerstone Biblical Commentary', 'CBC')
) AS v(name, abbreviation)
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = v.abbreviation
);

-- ---------------------------------------------------------------------------
-- Attach standalones to series
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET series_id = s.id, updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND b.series_id IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'BECNT'
	AND b.title = '2 Corinthians'
	AND b.isbn = '9780801026737';

UPDATE public.books b
SET
	series_id = s.id,
	subtitle = NULL,
	updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND b.series_id IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'CSC'
	AND b.title = '2 Corinthians'
	AND b.isbn = '9781535924894';

UPDATE public.books b
SET series_id = s.id, updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND b.series_id IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'BST'
	AND (
		(b.title = 'Romans' AND b.isbn IN ('0830816925', '9780830816925'))
		OR b.title = 'The Message of Esther'
	);

UPDATE public.books b
SET series_id = s.id, updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND b.series_id IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'NIVAC'
	AND b.title = 'Esther'
	AND b.isbn IN ('0310206723', '9780310206723');

UPDATE public.books b
SET series_id = s.id, updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND b.series_id IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'CBC'
	AND b.title = '1-2 Chronicles'
	AND b.isbn = '9780842334310';

UPDATE public.books b
SET
	series_id = s.id,
	title = 'The Book of Revelation',
	updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND b.series_id IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'NIGTC'
	AND b.title = 'The book of Revelation'
	AND b.isbn IN ('080282174X', '9780802821744');

UPDATE public.books b
SET series_id = s.id, updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND b.series_id IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'NIGTC'
	AND b.title = 'Second Epistle To The Corinthians'
	AND b.isbn = '9780802823939';

UPDATE public.books b
SET series_id = s.id, updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND b.series_id IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'ACCS'
	AND (
		(b.title = '1-2 Corinthians' AND b.isbn = '9780830814923')
		OR (b.title = 'Mark' AND b.isbn IN ('0830814876', '9780830814875'))
	);

-- ---------------------------------------------------------------------------
-- TOTC / TNTC volume fills
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET volume_number = v.volume_number, updated_at = now()
FROM public.series s,
	(VALUES
		('Joshua', '6'),
		('Leviticus', '3'),
		('Numbers', '4')
	) AS v(title, volume_number)
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'TOTC'
	AND b.series_id = s.id
	AND b.title = v.title
	AND b.volume_number IS DISTINCT FROM v.volume_number;

UPDATE public.books b
SET volume_number = v.volume_number, updated_at = now()
FROM public.series s,
	(VALUES
		('John', '4'),
		('1 Corinthians', '7')
	) AS v(title, volume_number)
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'TNTC'
	AND b.series_id = s.id
	AND b.title = v.title
	AND b.volume_number IS DISTINCT FROM v.volume_number;

-- ---------------------------------------------------------------------------
-- Metadata corrections
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher = 'Zondervan',
	year = 2010,
	isbn = '9780310243731',
	updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'ZECNT'
	AND b.series_id = s.id
	AND b.title = 'Ephesians'
	AND b.author_display ILIKE '%Arnold%';

UPDATE public.books b
SET
	publisher = 'Zondervan',
	year = 2016,
	isbn = '9780310496076',
	updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'SGBC'
	AND b.series_id = s.id
	AND b.title = 'Genesis'
	AND b.author_display ILIKE '%Longman%';

UPDATE public.books b
SET
	publisher = 'Paternoster Press',
	updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'NIBC'
	AND b.series_id = s.id
	AND b.title = 'Philippians'
	AND b.publisher = 'Paternoster PressaPeabody, MA';

UPDATE public.people
SET
	last_name = 'Milgrom',
	updated_at = now()
WHERE deleted_at IS NULL
	AND id = 'dd56c8e6-07f3-4330-847c-9c00bc29feb5'::uuid
	AND last_name = 'Milgron';
