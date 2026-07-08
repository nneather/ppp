-- =============================================================================
-- Data cleanup (decision 070): re-tag the general-purpose reference works that
-- landed under 'Biblical Reference' during Pass-1 import as a compromise
-- ("Brockhaus is general reference; closest of the 12 closed genres at the
-- time" — scripts/library-import/migrationOverrides.ts) to the plain
-- 'Reference' genre that has existed since the taxonomy grew past 12.
--
-- Scope: the German Brockhaus encyclopedia/dictionary/yearbook set and two
-- general (non-biblical, non-theological) dictionaries — 33 rows. Everything
-- else under 'Biblical Reference' (Anchor Bible Dictionary, TDNT, TWOT,
-- Bible/theology dictionaries, etc.) stays — genuinely biblical/theological
-- reference. Idempotent: the genre = 'Biblical Reference' guard makes re-runs
-- a no-op.
-- =============================================================================

UPDATE public.books
SET genre = 'Reference'
WHERE deleted_at IS NULL
	AND genre = 'Biblical Reference'
	AND title IN (
		'Brockhaus Deutsches Wörterbuch',
		'Brockhaus Enzyklopädie',
		'Brockhaus Jahrbuch 1996',
		'New Universal Unabridged Dictionary',
		'The New Dictionary of Thoughts'
	);
