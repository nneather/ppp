-- library_commentary_consistency_batch4
-- Owner-confirmed: EGGNT imprint fixes; Jobes BECNT 2nd ed Baker Academic.

-- ---------------------------------------------------------------------------
-- Jobes 1 Peter BECNT: replace POD stub with 2nd ed imprint
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher = 'Baker Academic',
	year = 2022,
	isbn = '9781540965783',
	edition = '2nd ed',
	updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'BECNT'
	AND b.series_id = s.id
	AND b.title = '1 Peter'
	AND b.author_display ILIKE '%Jobes%';

-- ---------------------------------------------------------------------------
-- EGGNT: Kruse 2 Corinthians (ISBN already EGGNT; fix wrong IVP/2008)
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher = 'B&H Academic',
	year = 2020,
	updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'EGGNT'
	AND b.series_id = s.id
	AND b.title = '2 Corinthians'
	AND b.isbn = '9781462743971';

-- ---------------------------------------------------------------------------
-- EGGNT: Harris Colossians & Philemon → B&H 2010 edition
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher = 'B&H Academic',
	year = 2010,
	isbn = '9780805448498',
	updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'EGGNT'
	AND b.series_id = s.id
	AND b.title = 'Colossians and Philemon'
	AND b.author_display ILIKE '%Harris%';

-- ---------------------------------------------------------------------------
-- EGGNT: publisher string normalization
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher = 'B&H Academic',
	updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'EGGNT'
	AND b.series_id = s.id
	AND b.publisher IN (
		'B & H Academic',
		'Lifeway Christian Resources',
		'B&H Publishing Group'
	);
