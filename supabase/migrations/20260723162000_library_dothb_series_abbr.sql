-- Attach DOTHB SBL abbreviation for citation without poisoning sibling IVP dictionaries.
-- Historical Books moves to its own series row (abbr DOTHB); other Black Dictionaries
-- stay on "IVP Bible Dictionary Series" (abbreviation NULL) for grouping.

INSERT INTO public.series (name, abbreviation)
SELECT 'Dictionary of the Old Testament: Historical Books', 'DOTHB'
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.abbreviation = 'DOTHB' AND s.deleted_at IS NULL
);

UPDATE public.books b
SET
	series_id = (
		SELECT s.id FROM public.series s
		WHERE s.abbreviation = 'DOTHB' AND s.deleted_at IS NULL
		LIMIT 1
	),
	updated_at = now()
WHERE b.id = '241b0487-5b2e-4129-832e-47423f1d53e7'
	AND b.deleted_at IS NULL;
