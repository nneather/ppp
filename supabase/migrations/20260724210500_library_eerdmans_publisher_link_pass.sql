-- library_eerdmans_publisher_link_pass
-- Standardize Eerdmans free-text variants → publishers.Eerdmans /
-- Grand Rapids, MI. Expand aliases for OL / future matching. Normalize
-- free-text to canonical "Eerdmans" (same imprint family; not historically
-- distinct like Broadman vs B&H). Idempotent via IS DISTINCT FROM.

-- ---------------------------------------------------------------------------
-- Expand aliases for free-text / OL matching
-- ---------------------------------------------------------------------------
UPDATE public.publishers p
SET
	default_location = COALESCE(NULLIF(trim(p.default_location), ''), 'Grand Rapids, MI'),
	aliases = (
		SELECT ARRAY(
			SELECT DISTINCT a
			FROM unnest(
				COALESCE(p.aliases, ARRAY[]::text[])
				|| ARRAY[
					'William B. Eerdmans',
					'Wm. B. Eerdmans',
					'Wm. B. Eerdmans Pub. Co.',
					'W. B. Eerdmans',
					'W.B. Eerdmans',
					'W. B. Eerdmans Pub. Co.',
					'W.B. Eerdmans Pub. Co.',
					'Eerdmans Pub. Co',
					'Eerdmans Pub. Co.',
					'Eerdmans Publishing Company, William B.'
				]::text[]
			) AS a
			ORDER BY a
		)
	),
	updated_at = now()
WHERE p.deleted_at IS NULL
	AND p.canonical_name = 'Eerdmans';

-- ---------------------------------------------------------------------------
-- Link + normalize all Eerdmans-ish free-text (and already-linked rows)
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher_id = e.id,
	publisher = 'Eerdmans',
	publisher_location = 'Grand Rapids, MI',
	updated_at = now()
FROM public.publishers e
WHERE b.deleted_at IS NULL
	AND e.deleted_at IS NULL
	AND e.canonical_name = 'Eerdmans'
	AND (
		b.publisher_id = e.id
		OR b.publisher IN (
			'Eerdmans',
			'Eerdmans Pub. Co',
			'Eerdmans Pub. Co.',
			'Eerdmans Publishing Company, William B.',
			'W. B. Eerdmans Pub. Co.',
			'W.B. Eerdmans',
			'W.B. Eerdmans Pub. Co.',
			'Wm. B. Eerdmans Pub. Co.',
			'William B. Eerdmans',
			'Wm. B. Eerdmans',
			'W. B. Eerdmans'
		)
	)
	AND (
		b.publisher_id IS DISTINCT FROM e.id
		OR b.publisher IS DISTINCT FROM 'Eerdmans'
		OR b.publisher_location IS DISTINCT FROM 'Grand Rapids, MI'
	);
