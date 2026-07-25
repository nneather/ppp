-- library_hermeneia_abbr_full
-- Footnotes use series.abbreviation when set ([publication.ts] formatSeriesSegment).
-- Hermeneia cites as the full word, not "Herm". Idempotent.

UPDATE public.series
SET abbreviation = 'Hermeneia'
WHERE deleted_at IS NULL
	AND abbreviation = 'Herm'
	AND name = 'Hermeneia';
