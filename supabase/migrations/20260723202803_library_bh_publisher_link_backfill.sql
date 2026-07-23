-- library_bh_publisher_link_backfill
-- Link remaining B&H / Broadman / Holman free-text books → publishers.B&H Academic
-- (Nashville, TN). Also fix free-text B&H Academic rows mis-linked to Logos /
-- Faithlife (EGGNT Ephesians + Matthew). Idempotent via IS DISTINCT FROM.
-- Excludes Lifeway Christian Resources (Praying with Paul ISBN looks Baker).

-- ---------------------------------------------------------------------------
-- Ensure imprint + expand aliases for OL / future free-text matching
-- ---------------------------------------------------------------------------
INSERT INTO public.publishers (canonical_name, default_location, aliases)
SELECT
	'B&H Academic',
	'Nashville, TN',
	ARRAY[
		'B&H Publishing Group',
		'B&H Academic Publishers',
		'Broadman & Holman Academic',
		'B and H Academic',
		'Broadman & Holman Publishers',
		'Broadman Press',
		'Holman Reference',
		'B & H Academic'
	]::text[]
WHERE NOT EXISTS (
	SELECT 1
	FROM public.publishers p
	WHERE p.deleted_at IS NULL
		AND p.canonical_name = 'B&H Academic'
);

UPDATE public.publishers p
SET
	default_location = COALESCE(NULLIF(trim(p.default_location), ''), 'Nashville, TN'),
	aliases = (
		SELECT ARRAY(
			SELECT DISTINCT a
			FROM unnest(
				COALESCE(p.aliases, ARRAY[]::text[])
				|| ARRAY[
					'B&H Publishing Group',
					'B&H Academic Publishers',
					'Broadman & Holman Academic',
					'B and H Academic',
					'Broadman & Holman Publishers',
					'Broadman Press',
					'Holman Reference',
					'B & H Academic'
				]::text[]
			) AS a
			ORDER BY a
		)
	),
	updated_at = now()
WHERE p.deleted_at IS NULL
	AND p.canonical_name = 'B&H Academic';

-- ---------------------------------------------------------------------------
-- Unlinked free-text → link + Nashville, TN
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher_id = bh.id,
	publisher_location = 'Nashville, TN',
	updated_at = now()
FROM public.publishers bh
WHERE b.deleted_at IS NULL
	AND b.publisher_id IS NULL
	AND bh.deleted_at IS NULL
	AND bh.canonical_name = 'B&H Academic'
	AND b.publisher IN (
		'B&H Academic',
		'B&H Publishing Group',
		'Broadman & Holman Publishers',
		'Broadman Press',
		'Holman Reference',
		'B & H Academic',
		'B and H Academic'
	)
	AND (
		b.publisher_id IS DISTINCT FROM bh.id
		OR b.publisher_location IS DISTINCT FROM 'Nashville, TN'
	);

-- ---------------------------------------------------------------------------
-- Free-text B&H Academic but wrong publisher_id (Logos / Faithlife mislinks)
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher_id = bh.id,
	publisher_location = 'Nashville, TN',
	updated_at = now()
FROM public.publishers bh
WHERE b.deleted_at IS NULL
	AND bh.deleted_at IS NULL
	AND bh.canonical_name = 'B&H Academic'
	AND b.publisher = 'B&H Academic'
	AND b.publisher_id IS DISTINCT FROM bh.id
	AND (
		b.publisher_id IS NULL
		OR EXISTS (
			SELECT 1
			FROM public.publishers wrong
			WHERE wrong.id = b.publisher_id
				AND wrong.deleted_at IS NULL
				AND wrong.canonical_name = 'Logos / Faithlife'
		)
	);
