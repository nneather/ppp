-- Per-book citation abbreviation (overrides series.abbreviation for Turabian).
-- IVP Black Dictionaries share one series; each work has its own SBL abbr.

ALTER TABLE public.books
	ADD COLUMN IF NOT EXISTS citation_abbreviation text;

ALTER TABLE public.books
	DROP CONSTRAINT IF EXISTS books_citation_abbreviation_len_check;

ALTER TABLE public.books
	ADD CONSTRAINT books_citation_abbreviation_len_check
	CHECK (
		citation_abbreviation IS NULL
		OR (
			char_length(trim(citation_abbreviation)) BETWEEN 1 AND 32
			AND citation_abbreviation = trim(citation_abbreviation)
		)
	);

COMMENT ON COLUMN public.books.citation_abbreviation IS
	'SBL/Turabian work abbreviation for article footnotes; when set, overrides series.abbreviation.';

-- Historical Books → IVP Bible Dictionary Series + DOTHB override
UPDATE public.books
SET
	series_id = '2bf4717c-3a94-4a6b-a636-cdbadb2e3db3',
	citation_abbreviation = 'DOTHB',
	updated_at = now()
WHERE id = '241b0487-5b2e-4129-832e-47423f1d53e7'
	AND deleted_at IS NULL;

-- Sibling IVP Black Dictionaries (already on IVP series)
UPDATE public.books
SET
	citation_abbreviation = v.abbr,
	updated_at = now()
FROM (
	VALUES
		('09696579-b466-4440-bcac-8fb0b757d85c'::uuid, 'DJG'),
		('c1d69b7a-4b80-41ae-afc4-cb500c567096'::uuid, 'DPL'),
		('2d7c0db2-fa01-44f3-bf72-b3abc5d069f7'::uuid, 'DOTWPW')
) AS v(id, abbr)
WHERE books.id = v.id
	AND books.deleted_at IS NULL;

-- Soft-delete one-off DOTHB series (no remaining live books)
UPDATE public.series
SET
	deleted_at = now(),
	updated_at = now()
WHERE id = 'c27b0df5-f81a-417b-bdec-a5189fe87b99'
	AND deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.books b
		WHERE b.series_id = 'c27b0df5-f81a-417b-bdec-a5189fe87b99'
			AND b.deleted_at IS NULL
	);
