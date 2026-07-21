-- SBL series abbreviation cleanup ([104]):
-- 1. Apollos OT Commentary: AOTC → ApOTC (AOTC is Abingdon in SBLHS)
-- 2. Keil & Delitzsch: off Continental Commentary (COT) onto K&D
-- 3. Matthew Henry: off Moffatt NT Commentary (MH) onto MHC; Moffatt → MNTC

-- ---------------------------------------------------------------------------
-- Apollos
-- ---------------------------------------------------------------------------
UPDATE public.series
SET abbreviation = 'ApOTC', updated_at = now()
WHERE deleted_at IS NULL
  AND name = 'Apollos Old Testament Commentary'
  AND abbreviation IS DISTINCT FROM 'ApOTC';

-- ---------------------------------------------------------------------------
-- Keil & Delitzsch (K&D)
-- ---------------------------------------------------------------------------
INSERT INTO public.series (name, abbreviation)
SELECT 'Keil and Delitzsch Commentary', 'K&D'
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL
	  AND (s.abbreviation = 'K&D' OR s.name = 'Keil and Delitzsch Commentary')
);

UPDATE public.books b
SET
	series_id = (
		SELECT s.id FROM public.series s
		WHERE s.deleted_at IS NULL
		  AND s.abbreviation = 'K&D'
		LIMIT 1
	),
	updated_at = now()
WHERE b.deleted_at IS NULL
  AND b.series_id = (
		SELECT s.id FROM public.series s
		WHERE s.deleted_at IS NULL
		  AND s.name = 'Continental Commentary'
		  AND s.abbreviation = 'COT'
		LIMIT 1
  )
  AND EXISTS (
		SELECT 1
		FROM public.book_authors ba
		JOIN public.people p ON p.id = ba.person_id
		WHERE ba.book_id = b.id
		  AND p.deleted_at IS NULL
		  AND p.last_name IN ('Keil', 'Delitzsch')
  );

-- ---------------------------------------------------------------------------
-- Matthew Henry (MHC) + Moffatt abbr fix (MNTC)
-- ---------------------------------------------------------------------------
INSERT INTO public.series (name, abbreviation)
SELECT 'Matthew Henry Commentary', 'MHC'
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL
	  AND (s.abbreviation = 'MHC' OR s.name = 'Matthew Henry Commentary')
);

UPDATE public.books b
SET
	series_id = (
		SELECT s.id FROM public.series s
		WHERE s.deleted_at IS NULL
		  AND s.abbreviation = 'MHC'
		LIMIT 1
	),
	updated_at = now()
WHERE b.deleted_at IS NULL
  AND b.series_id = (
		SELECT s.id FROM public.series s
		WHERE s.deleted_at IS NULL
		  AND s.name = 'Moffatt New Testament Commentary'
		LIMIT 1
  )
  AND EXISTS (
		SELECT 1
		FROM public.book_authors ba
		JOIN public.people p ON p.id = ba.person_id
		WHERE ba.book_id = b.id
		  AND p.deleted_at IS NULL
		  AND p.last_name = 'Henry'
  );

UPDATE public.series
SET abbreviation = 'MNTC', updated_at = now()
WHERE deleted_at IS NULL
  AND name = 'Moffatt New Testament Commentary'
  AND abbreviation IS DISTINCT FROM 'MNTC';
