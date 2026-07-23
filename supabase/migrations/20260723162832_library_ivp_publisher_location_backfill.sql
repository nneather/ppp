-- library_ivp_publisher_location_backfill
-- Backfill books.publisher_location = 'Downers Grove, IL' for live US IVP /
-- IVP Academic rows (postal form per publisher-location.ts). Also link
-- high-confidence unlinked free-text IVP rows; fix B&H-via-wrong-publisher_id
-- (2 Corinthians) and Creation Regained (Eerdmans ISBN, not Inter-Varsity).
-- Idempotent: re-run safe via IS DISTINCT FROM / NOT EXISTS guards.
-- Excludes UK-ish Inter-Varsity* free-text (Creation Regained handled below;
-- Inter-Varsity Missions left alone).

-- ---------------------------------------------------------------------------
-- Ensure B&H Academic imprint exists (for 2 Corinthians unlink + cite)
-- ---------------------------------------------------------------------------
INSERT INTO public.publishers (canonical_name, default_location, aliases)
SELECT
	'B&H Academic',
	'Nashville, TN',
	ARRAY[
		'B&H Publishing Group',
		'B&H Academic Publishers',
		'Broadman & Holman Academic',
		'B and H Academic'
	]::text[]
WHERE NOT EXISTS (
	SELECT 1
	FROM public.publishers p
	WHERE p.deleted_at IS NULL
		AND p.canonical_name = 'B&H Academic'
);

-- ---------------------------------------------------------------------------
-- A. Linked IVP / IVP Academic — location only (exclude B&H free-text mislink)
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher_location = 'Downers Grove, IL',
	updated_at = now()
WHERE b.deleted_at IS NULL
	AND b.publisher_id IN (
		SELECT p.id
		FROM public.publishers p
		WHERE p.deleted_at IS NULL
			AND p.canonical_name IN ('IVP', 'IVP Academic')
	)
	AND b.publisher_location IS DISTINCT FROM 'Downers Grove, IL'
	AND b.publisher NOT ILIKE '%B&H%'
	AND b.publisher NOT ILIKE '%Broadman%'
	AND b.publisher NOT ILIKE '%Holman%';

-- ---------------------------------------------------------------------------
-- B. Unlinked US-IVP free-text → link + location
-- ---------------------------------------------------------------------------
-- IVP Academic free-text
UPDATE public.books b
SET
	publisher_id = pa.id,
	publisher_location = 'Downers Grove, IL',
	updated_at = now()
FROM public.publishers pa
WHERE b.deleted_at IS NULL
	AND b.publisher_id IS NULL
	AND pa.deleted_at IS NULL
	AND pa.canonical_name = 'IVP Academic'
	AND b.publisher = 'IVP Academic'
	AND (
		b.publisher_id IS DISTINCT FROM pa.id
		OR b.publisher_location IS DISTINCT FROM 'Downers Grove, IL'
	);

-- InterVarsity Press / IVP Books imprint / IVP Connect → parent IVP
UPDATE public.books b
SET
	publisher_id = pivp.id,
	publisher_location = 'Downers Grove, IL',
	updated_at = now()
FROM public.publishers pivp
WHERE b.deleted_at IS NULL
	AND b.publisher_id IS NULL
	AND pivp.deleted_at IS NULL
	AND pivp.canonical_name = 'IVP'
	AND (
		b.publisher = 'InterVarsity Press'
		OR b.publisher ILIKE 'IVP Books%'
		OR b.publisher = 'IVP Connect'
	)
	AND (
		b.publisher_id IS DISTINCT FROM pivp.id
		OR b.publisher_location IS DISTINCT FROM 'Downers Grove, IL'
	);

-- ---------------------------------------------------------------------------
-- C. Outliers
-- ---------------------------------------------------------------------------
-- 2 Corinthians: free-text B&H Academic, was mis-linked to IVP Academic
UPDATE public.books b
SET
	publisher_id = bh.id,
	publisher = 'B&H Academic',
	publisher_location = 'Nashville, TN',
	updated_at = now()
FROM public.publishers bh
WHERE b.deleted_at IS NULL
	AND b.id = 'f65e9c58-167b-4a67-ac1f-a9ac657f3cd7'
	AND bh.deleted_at IS NULL
	AND bh.canonical_name = 'B&H Academic'
	AND (
		b.publisher_id IS DISTINCT FROM bh.id
		OR b.publisher IS DISTINCT FROM 'B&H Academic'
		OR b.publisher_location IS DISTINCT FROM 'Nashville, TN'
	);

-- Creation Regained: ISBN 9780802800435 is Eerdmans; free-text was Inter-Varsity
UPDATE public.books b
SET
	publisher_id = e.id,
	publisher = 'Eerdmans',
	publisher_location = 'Grand Rapids, MI',
	updated_at = now()
FROM public.publishers e
WHERE b.deleted_at IS NULL
	AND b.id = '81766c3d-0cbf-4a82-844b-b1172279c03c'
	AND e.deleted_at IS NULL
	AND e.canonical_name = 'Eerdmans'
	AND (
		b.publisher_id IS DISTINCT FROM e.id
		OR b.publisher IS DISTINCT FROM 'Eerdmans'
		OR b.publisher_location IS DISTINCT FROM 'Grand Rapids, MI'
	);
