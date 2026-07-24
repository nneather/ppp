-- library_publisher_link_batch2_create
-- Create + link: Banner of Truth, Moody Publishers, Word, Reformation
-- Heritage Books, Brill, Thomas Nelson.
-- Word is kept separate from Thomas Nelson / Zondervan Academic so WBC spine
-- imprints stay accurate (Word-era vs Nelson-era vs Zondervan-era vols).
-- Excludes Brilliance Audio co-labels. Idempotent.

-- ---------------------------------------------------------------------------
-- Ensure publisher rows
-- ---------------------------------------------------------------------------
INSERT INTO public.publishers (canonical_name, default_location, aliases)
SELECT
	'Banner of Truth',
	'Carlisle, PA',
	ARRAY['Banner of Truth Trust', 'The Banner of Truth Trust', 'Banner of Truth Trust Ltd']::text[]
WHERE NOT EXISTS (
	SELECT 1 FROM public.publishers p
	WHERE p.deleted_at IS NULL AND p.canonical_name = 'Banner of Truth'
);

INSERT INTO public.publishers (canonical_name, default_location, aliases)
SELECT
	'Moody Publishers',
	'Chicago, IL',
	ARRAY['Moody Press', 'The Moody Press', 'Moody Pr', 'Moody Publishing']::text[]
WHERE NOT EXISTS (
	SELECT 1 FROM public.publishers p
	WHERE p.deleted_at IS NULL AND p.canonical_name = 'Moody Publishers'
);

INSERT INTO public.publishers (canonical_name, default_location, aliases)
SELECT
	'Word',
	'Waco, TX',
	ARRAY['Word Books', 'Word Pub.', 'Word Publishing', 'Word Books Publisher']::text[]
WHERE NOT EXISTS (
	SELECT 1 FROM public.publishers p
	WHERE p.deleted_at IS NULL AND p.canonical_name = 'Word'
);

INSERT INTO public.publishers (canonical_name, default_location, aliases)
SELECT
	'Reformation Heritage Books',
	'Grand Rapids, MI',
	ARRAY['RHB', 'Reformation Heritage', 'Reformation Heritage Books Publishing']::text[]
WHERE NOT EXISTS (
	SELECT 1 FROM public.publishers p
	WHERE p.deleted_at IS NULL AND p.canonical_name = 'Reformation Heritage Books'
);

INSERT INTO public.publishers (canonical_name, default_location, aliases)
SELECT
	'Brill',
	'Leiden',
	ARRAY['E. J. Brill', 'E.J. Brill', 'Brill Academic Publishers', 'Brill Academic']::text[]
WHERE NOT EXISTS (
	SELECT 1 FROM public.publishers p
	WHERE p.deleted_at IS NULL AND p.canonical_name = 'Brill'
);

INSERT INTO public.publishers (canonical_name, default_location, aliases)
SELECT
	'Thomas Nelson',
	'Nashville, TN',
	ARRAY['Thomas Nelson Publishers', 'Thomas Nelson Inc.', 'Nelson']::text[]
WHERE NOT EXISTS (
	SELECT 1 FROM public.publishers p
	WHERE p.deleted_at IS NULL AND p.canonical_name = 'Thomas Nelson'
);

-- Expand aliases if rows already existed
UPDATE public.publishers p
SET
	default_location = COALESCE(NULLIF(trim(p.default_location), ''), 'Carlisle, PA'),
	aliases = (
		SELECT ARRAY(
			SELECT DISTINCT a
			FROM unnest(
				COALESCE(p.aliases, ARRAY[]::text[])
				|| ARRAY['Banner of Truth Trust', 'The Banner of Truth Trust', 'Banner of Truth Trust Ltd']::text[]
			) AS a
			ORDER BY a
		)
	),
	updated_at = now()
WHERE p.deleted_at IS NULL AND p.canonical_name = 'Banner of Truth';

UPDATE public.publishers p
SET
	default_location = COALESCE(NULLIF(trim(p.default_location), ''), 'Chicago, IL'),
	aliases = (
		SELECT ARRAY(
			SELECT DISTINCT a
			FROM unnest(
				COALESCE(p.aliases, ARRAY[]::text[])
				|| ARRAY['Moody Press', 'The Moody Press', 'Moody Pr', 'Moody Publishing']::text[]
			) AS a
			ORDER BY a
		)
	),
	updated_at = now()
WHERE p.deleted_at IS NULL AND p.canonical_name = 'Moody Publishers';

UPDATE public.publishers p
SET
	default_location = COALESCE(NULLIF(trim(p.default_location), ''), 'Waco, TX'),
	aliases = (
		SELECT ARRAY(
			SELECT DISTINCT a
			FROM unnest(
				COALESCE(p.aliases, ARRAY[]::text[])
				|| ARRAY['Word Books', 'Word Pub.', 'Word Publishing', 'Word Books Publisher']::text[]
			) AS a
			ORDER BY a
		)
	),
	updated_at = now()
WHERE p.deleted_at IS NULL AND p.canonical_name = 'Word';

UPDATE public.publishers p
SET
	default_location = COALESCE(NULLIF(trim(p.default_location), ''), 'Grand Rapids, MI'),
	aliases = (
		SELECT ARRAY(
			SELECT DISTINCT a
			FROM unnest(
				COALESCE(p.aliases, ARRAY[]::text[])
				|| ARRAY['RHB', 'Reformation Heritage', 'Reformation Heritage Books Publishing']::text[]
			) AS a
			ORDER BY a
		)
	),
	updated_at = now()
WHERE p.deleted_at IS NULL AND p.canonical_name = 'Reformation Heritage Books';

UPDATE public.publishers p
SET
	default_location = COALESCE(NULLIF(trim(p.default_location), ''), 'Leiden'),
	aliases = (
		SELECT ARRAY(
			SELECT DISTINCT a
			FROM unnest(
				COALESCE(p.aliases, ARRAY[]::text[])
				|| ARRAY['E. J. Brill', 'E.J. Brill', 'Brill Academic Publishers', 'Brill Academic']::text[]
			) AS a
			ORDER BY a
		)
	),
	updated_at = now()
WHERE p.deleted_at IS NULL AND p.canonical_name = 'Brill';

UPDATE public.publishers p
SET
	default_location = COALESCE(NULLIF(trim(p.default_location), ''), 'Nashville, TN'),
	aliases = (
		SELECT ARRAY(
			SELECT DISTINCT a
			FROM unnest(
				COALESCE(p.aliases, ARRAY[]::text[])
				|| ARRAY['Thomas Nelson Publishers', 'Thomas Nelson Inc.', 'Nelson']::text[]
			) AS a
			ORDER BY a
		)
	),
	updated_at = now()
WHERE p.deleted_at IS NULL AND p.canonical_name = 'Thomas Nelson';

-- ---------------------------------------------------------------------------
-- Link + normalize
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher_id = p.id,
	publisher = 'Banner of Truth',
	publisher_location = 'Carlisle, PA',
	updated_at = now()
FROM public.publishers p
WHERE b.deleted_at IS NULL
	AND p.deleted_at IS NULL
	AND p.canonical_name = 'Banner of Truth'
	AND (
		b.publisher_id = p.id
		OR b.publisher IN (
			'Banner of Truth',
			'Banner of Truth Trust',
			'The Banner of Truth Trust',
			'Banner of Truth Trust Ltd'
		)
	)
	AND (
		b.publisher_id IS DISTINCT FROM p.id
		OR b.publisher IS DISTINCT FROM 'Banner of Truth'
		OR b.publisher_location IS DISTINCT FROM 'Carlisle, PA'
	);

UPDATE public.books b
SET
	publisher_id = p.id,
	publisher = 'Moody Publishers',
	publisher_location = 'Chicago, IL',
	updated_at = now()
FROM public.publishers p
WHERE b.deleted_at IS NULL
	AND p.deleted_at IS NULL
	AND p.canonical_name = 'Moody Publishers'
	AND (
		b.publisher_id = p.id
		OR b.publisher IN (
			'Moody Publishers',
			'Moody Press',
			'The Moody Press',
			'Moody Pr',
			'Moody Publishing'
		)
	)
	AND (
		b.publisher_id IS DISTINCT FROM p.id
		OR b.publisher IS DISTINCT FROM 'Moody Publishers'
		OR b.publisher_location IS DISTINCT FROM 'Chicago, IL'
	);

-- Word only — do NOT pull Thomas Nelson or Zondervan Academic WBC vols
UPDATE public.books b
SET
	publisher_id = p.id,
	publisher = 'Word',
	publisher_location = 'Waco, TX',
	updated_at = now()
FROM public.publishers p
WHERE b.deleted_at IS NULL
	AND p.deleted_at IS NULL
	AND p.canonical_name = 'Word'
	AND (
		b.publisher_id = p.id
		OR b.publisher IN ('Word', 'Word Books', 'Word Pub.', 'Word Publishing', 'Word Books Publisher')
	)
	AND (
		b.publisher_id IS DISTINCT FROM p.id
		OR b.publisher IS DISTINCT FROM 'Word'
		OR b.publisher_location IS DISTINCT FROM 'Waco, TX'
	);

UPDATE public.books b
SET
	publisher_id = p.id,
	publisher = 'Reformation Heritage Books',
	publisher_location = 'Grand Rapids, MI',
	updated_at = now()
FROM public.publishers p
WHERE b.deleted_at IS NULL
	AND p.deleted_at IS NULL
	AND p.canonical_name = 'Reformation Heritage Books'
	AND (
		b.publisher_id = p.id
		OR b.publisher IN (
			'Reformation Heritage Books',
			'Reformation Heritage',
			'RHB',
			'Reformation Heritage Books Publishing'
		)
	)
	AND (
		b.publisher_id IS DISTINCT FROM p.id
		OR b.publisher IS DISTINCT FROM 'Reformation Heritage Books'
		OR b.publisher_location IS DISTINCT FROM 'Grand Rapids, MI'
	);

UPDATE public.books b
SET
	publisher_id = p.id,
	publisher = 'Brill',
	publisher_location = 'Leiden',
	updated_at = now()
FROM public.publishers p
WHERE b.deleted_at IS NULL
	AND p.deleted_at IS NULL
	AND p.canonical_name = 'Brill'
	AND (
		b.publisher_id = p.id
		OR b.publisher IN (
			'Brill',
			'E. J. Brill',
			'E.J. Brill',
			'Brill Academic Publishers',
			'Brill Academic'
		)
	)
	AND (
		b.publisher_id IS DISTINCT FROM p.id
		OR b.publisher IS DISTINCT FROM 'Brill'
		OR b.publisher_location IS DISTINCT FROM 'Leiden'
	);

-- Thomas Nelson print only — skip Brilliance Audio co-labels
UPDATE public.books b
SET
	publisher_id = p.id,
	publisher = 'Thomas Nelson',
	publisher_location = 'Nashville, TN',
	updated_at = now()
FROM public.publishers p
WHERE b.deleted_at IS NULL
	AND p.deleted_at IS NULL
	AND p.canonical_name = 'Thomas Nelson'
	AND (
		b.publisher_id = p.id
		OR b.publisher IN (
			'Thomas Nelson',
			'Thomas Nelson Publishers',
			'Thomas Nelson Inc.',
			'Nelson'
		)
	)
	AND (
		b.publisher_id IS DISTINCT FROM p.id
		OR b.publisher IS DISTINCT FROM 'Thomas Nelson'
		OR b.publisher_location IS DISTINCT FROM 'Nashville, TN'
	);
