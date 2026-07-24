-- library_publisher_link_batch1_registry
-- Fastest-win pass for already-registered imprints: Hendrickson, Crossway,
-- Zondervan (+ Academic), P&R Publishing, Westminster John Knox.
-- Expand aliases, link leftovers, normalize free-text + location.
-- Idempotent via IS DISTINCT FROM / NOT EXISTS.

-- ---------------------------------------------------------------------------
-- Aliases
-- ---------------------------------------------------------------------------
UPDATE public.publishers p
SET
	default_location = COALESCE(NULLIF(trim(p.default_location), ''), 'Peabody, MA'),
	aliases = (
		SELECT ARRAY(
			SELECT DISTINCT a
			FROM unnest(
				COALESCE(p.aliases, ARRAY[]::text[])
				|| ARRAY[
					'Hendrickson Publishers',
					'Hendrickson Publishing',
					'Hendrickson Publisher''s Inc.',
					'Hendrickson Publishers Marketing, LLC',
					'Hendrickson Publishers / Deutsche Bibelgesellschaft'
				]::text[]
			) AS a
			ORDER BY a
		)
	),
	updated_at = now()
WHERE p.deleted_at IS NULL
	AND p.canonical_name = 'Hendrickson';

UPDATE public.publishers p
SET
	default_location = COALESCE(NULLIF(trim(p.default_location), ''), 'Wheaton, IL'),
	aliases = (
		SELECT ARRAY(
			SELECT DISTINCT a
			FROM unnest(
				COALESCE(p.aliases, ARRAY[]::text[])
				|| ARRAY['Crossway Books', 'Good News Publishers']::text[]
			) AS a
			ORDER BY a
		)
	),
	updated_at = now()
WHERE p.deleted_at IS NULL
	AND p.canonical_name = 'Crossway';

UPDATE public.publishers p
SET
	default_location = COALESCE(NULLIF(trim(p.default_location), ''), 'Grand Rapids, MI'),
	aliases = (
		SELECT ARRAY(
			SELECT DISTINCT a
			FROM unnest(
				COALESCE(p.aliases, ARRAY[]::text[])
				|| ARRAY[
					'Zondervan Publishing',
					'Zondervan Publishing House',
					'Zondervan Pub. House',
					'Zondervan/Youth Specialties'
				]::text[]
			) AS a
			ORDER BY a
		)
	),
	updated_at = now()
WHERE p.deleted_at IS NULL
	AND p.canonical_name = 'Zondervan';

UPDATE public.publishers p
SET
	default_location = COALESCE(NULLIF(trim(p.default_location), ''), 'Grand Rapids, MI'),
	updated_at = now()
WHERE p.deleted_at IS NULL
	AND p.canonical_name = 'Zondervan Academic';

UPDATE public.publishers p
SET
	default_location = COALESCE(NULLIF(trim(p.default_location), ''), 'Phillipsburg, NJ'),
	aliases = (
		SELECT ARRAY(
			SELECT DISTINCT a
			FROM unnest(
				COALESCE(p.aliases, ARRAY[]::text[])
				|| ARRAY[
					'P&R Pub.',
					'P & R Publishing',
					'P and R Publishing',
					'Presbyterian and Reformed',
					'Presbyterian and Reformed Pub. Co.'
				]::text[]
			) AS a
			ORDER BY a
		)
	),
	updated_at = now()
WHERE p.deleted_at IS NULL
	AND p.canonical_name = 'P&R Publishing';

UPDATE public.publishers p
SET
	default_location = COALESCE(NULLIF(trim(p.default_location), ''), 'Louisville, KY'),
	aliases = (
		SELECT ARRAY(
			SELECT DISTINCT a
			FROM unnest(
				COALESCE(p.aliases, ARRAY[]::text[])
				|| ARRAY[
					'WJK',
					'Westminster John Knox Press',
					'Westminster/John Knox',
					'Westminster Press',
					'John Knox Press'
				]::text[]
			) AS a
			ORDER BY a
		)
	),
	updated_at = now()
WHERE p.deleted_at IS NULL
	AND p.canonical_name = 'Westminster John Knox';

-- ---------------------------------------------------------------------------
-- Hendrickson
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher_id = h.id,
	publisher = 'Hendrickson',
	publisher_location = 'Peabody, MA',
	updated_at = now()
FROM public.publishers h
WHERE b.deleted_at IS NULL
	AND h.deleted_at IS NULL
	AND h.canonical_name = 'Hendrickson'
	AND (
		b.publisher_id = h.id
		OR b.publisher IN (
			'Hendrickson',
			'Hendrickson Publishers',
			'Hendrickson Publishing',
			'Hendrickson Publisher''s Inc.',
			'Hendrickson Publishers Marketing, LLC',
			'Hendrickson Publishers / Deutsche Bibelgesellschaft'
		)
	)
	AND (
		b.publisher_id IS DISTINCT FROM h.id
		OR b.publisher IS DISTINCT FROM 'Hendrickson'
		OR b.publisher_location IS DISTINCT FROM 'Peabody, MA'
	);

-- ---------------------------------------------------------------------------
-- Crossway
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher_id = c.id,
	publisher = 'Crossway',
	publisher_location = 'Wheaton, IL',
	updated_at = now()
FROM public.publishers c
WHERE b.deleted_at IS NULL
	AND c.deleted_at IS NULL
	AND c.canonical_name = 'Crossway'
	AND (
		b.publisher_id = c.id
		OR b.publisher IN ('Crossway', 'Crossway Books', 'Good News Publishers')
	)
	AND (
		b.publisher_id IS DISTINCT FROM c.id
		OR b.publisher IS DISTINCT FROM 'Crossway'
		OR b.publisher_location IS DISTINCT FROM 'Wheaton, IL'
	);

-- ---------------------------------------------------------------------------
-- Zondervan (trade) — exclude Academic + Brilliance Audio co-labels
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher_id = z.id,
	publisher = 'Zondervan',
	publisher_location = 'Grand Rapids, MI',
	updated_at = now()
FROM public.publishers z
WHERE b.deleted_at IS NULL
	AND z.deleted_at IS NULL
	AND z.canonical_name = 'Zondervan'
	AND (
		b.publisher_id = z.id
		OR b.publisher IN (
			'Zondervan',
			'Zondervan Publishing',
			'Zondervan Publishing House',
			'Zondervan Pub. House',
			'Zondervan/Youth Specialties'
		)
	)
	AND (
		b.publisher_id IS DISTINCT FROM z.id
		OR b.publisher IS DISTINCT FROM 'Zondervan'
		OR b.publisher_location IS DISTINCT FROM 'Grand Rapids, MI'
	);

-- ---------------------------------------------------------------------------
-- Zondervan Academic — location only (+ normalize free-text if already linked)
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher_id = za.id,
	publisher = 'Zondervan Academic',
	publisher_location = 'Grand Rapids, MI',
	updated_at = now()
FROM public.publishers za
WHERE b.deleted_at IS NULL
	AND za.deleted_at IS NULL
	AND za.canonical_name = 'Zondervan Academic'
	AND (
		b.publisher_id = za.id
		OR b.publisher IN ('Zondervan Academic', 'Zondervan Academic Books')
	)
	AND (
		b.publisher_id IS DISTINCT FROM za.id
		OR b.publisher IS DISTINCT FROM 'Zondervan Academic'
		OR b.publisher_location IS DISTINCT FROM 'Grand Rapids, MI'
	);

-- ---------------------------------------------------------------------------
-- P&R Publishing
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher_id = pr.id,
	publisher = 'P&R Publishing',
	publisher_location = 'Phillipsburg, NJ',
	updated_at = now()
FROM public.publishers pr
WHERE b.deleted_at IS NULL
	AND pr.deleted_at IS NULL
	AND pr.canonical_name = 'P&R Publishing'
	AND (
		b.publisher_id = pr.id
		OR b.publisher IN (
			'P&R Publishing',
			'P&R Pub.',
			'P & R Publishing',
			'P and R Publishing',
			'Presbyterian and Reformed',
			'Presbyterian and Reformed Pub. Co.'
		)
	)
	AND (
		b.publisher_id IS DISTINCT FROM pr.id
		OR b.publisher IS DISTINCT FROM 'P&R Publishing'
		OR b.publisher_location IS DISTINCT FROM 'Phillipsburg, NJ'
	);

-- ---------------------------------------------------------------------------
-- Westminster John Knox (incl. historical Westminster Press / John Knox Press)
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher_id = w.id,
	publisher = 'Westminster John Knox',
	publisher_location = 'Louisville, KY',
	updated_at = now()
FROM public.publishers w
WHERE b.deleted_at IS NULL
	AND w.deleted_at IS NULL
	AND w.canonical_name = 'Westminster John Knox'
	AND (
		b.publisher_id = w.id
		OR b.publisher IN (
			'Westminster John Knox',
			'Westminster John Knox Press',
			'Westminster/John Knox',
			'WJK',
			'Westminster Press',
			'John Knox Press'
		)
	)
	AND (
		b.publisher_id IS DISTINCT FROM w.id
		OR b.publisher IS DISTINCT FROM 'Westminster John Knox'
		OR b.publisher_location IS DISTINCT FROM 'Louisville, KY'
	);
