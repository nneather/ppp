-- library_commentary_consistency_batch3
-- Owner-confirmed: SP/ACCS vols; Sarna stays JPSTC with JPS imprint/ISBN;
-- NIB title ESVEC-style range; Berlin Esther title; Beale subtitle title case.

-- ---------------------------------------------------------------------------
-- Volume fills
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET volume_number = '3', updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'SP'
	AND b.series_id = s.id
	AND b.title = 'Luke'
	AND b.volume_number IS DISTINCT FROM '3';

UPDATE public.books b
SET volume_number = v.volume_number, updated_at = now()
FROM public.series s,
	(VALUES
		('Mark', '2'),
		('1-2 Corinthians', '7')
	) AS v(title, volume_number)
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'ACCS'
	AND b.series_id = s.id
	AND b.title = v.title
	AND b.volume_number IS DISTINCT FROM v.volume_number;

-- ---------------------------------------------------------------------------
-- Sarna Genesis: keep JPSTC; fix Schocken/1966 stub → JPS Torah imprint
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher = 'Jewish Publication Society',
	year = 2001,
	isbn = '9780827603264',
	updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'JPSTC'
	AND b.series_id = s.id
	AND b.title = 'Genesis'
	AND b.author_display ILIKE '%Sarna%';

-- ---------------------------------------------------------------------------
-- Title / subtitle cleanups
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	title = 'Esther',
	updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'JPSTC'
	AND b.series_id = s.id
	AND b.title = 'The JPS Commentary on Esther';

-- NIB Vol X: ESVEC-style content range (Acts; Romans; 1 Corinthians per 088)
UPDATE public.books b
SET
	title = 'Acts–1 Corinthians',
	updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'NIB'
	AND b.series_id = s.id
	AND b.volume_number = '10'
	AND b.title = 'New Interpreter''s Bible, The Vol X';

UPDATE public.books b
SET
	subtitle = 'A Commentary on the Greek Text',
	updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'NIGTC'
	AND b.series_id = s.id
	AND b.title = 'The Book of Revelation'
	AND b.subtitle IS DISTINCT FROM 'A Commentary on the Greek Text';
