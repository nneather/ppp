-- Per-series Turabian include flag: when false, Copy Footnote/Bibliography omit the
-- series segment (catalog series_id + name/abbr stay). Default true so commentary
-- series (WBC/NICNT/ESVEC/…) keep current cites with zero backfill.
-- Opt-outs: trade/popular/fiction/classics + optional biblical-theology series
-- (SSBT/NSBT/NSD) that Covenant treats as optional in notes.

ALTER TABLE public.series
	ADD COLUMN IF NOT EXISTS include_in_citation BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.series.include_in_citation IS
	'When false, Turabian formatters omit the series segment even if name/abbreviation are set. Catalog linkage (books.series_id) is unchanged.';

UPDATE public.series
SET include_in_citation = false
WHERE deleted_at IS NULL
	AND name IN (
		'Short Studies in Biblical Theology',
		'New Studies in Biblical Theology',
		'New Studies in Dogmatics',
		'Harvard Classics',
		'Barnes and Noble Classics',
		'Penguin Classics',
		'Redwall',
		'The Chronicles of Narnia',
		'The Wingfeather Saga',
		'The Story of Civilization',
		'Annotated Shakespeare',
		'Goethes sämtliche Werke',
		'Hyperion Cantos',
		'The Foundation Trilogy',
		'A History of the English Speaking Peoples',
		'The Second World War',
		'John Marshall Biography',
		'Works of John Bunyan'
	);
