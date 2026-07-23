-- library_baker_publisher_link_pass
-- Link remaining Baker Academic / Baker Books free-text; remint Praying with
-- Paul (was Lifeway) → Baker Academic; repair clear mislinks (BECNT Romans +
-- Beale NTBT → Academic; ZECNT Ephesians → Zondervan; Calvin Psalms 93–150
-- still on Eerdmans after 122 free-text fix; NIBC Psalms "BakerBooks" typo →
-- Hendrickson; Litfin Church Fathers ISBN → Brazos). Backfill Grand Rapids, MI.
-- Idempotent via IS DISTINCT FROM / id guards.

-- ---------------------------------------------------------------------------
-- Aliases for free-text / OL matching
-- ---------------------------------------------------------------------------
UPDATE public.publishers p
SET
	aliases = (
		SELECT ARRAY(
			SELECT DISTINCT a
			FROM unnest(
				COALESCE(p.aliases, ARRAY[]::text[])
				|| ARRAY['BakerBooks', 'Baker Book House Company']::text[]
			) AS a
			ORDER BY a
		)
	),
	updated_at = now()
WHERE p.deleted_at IS NULL
	AND p.canonical_name = 'Baker Books';

-- ---------------------------------------------------------------------------
-- A. Unlinked free-text → matching imprint + Grand Rapids
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher_id = ba.id,
	publisher_location = 'Grand Rapids, MI',
	updated_at = now()
FROM public.publishers ba
WHERE b.deleted_at IS NULL
	AND b.publisher_id IS NULL
	AND ba.deleted_at IS NULL
	AND ba.canonical_name = 'Baker Academic'
	AND b.publisher = 'Baker Academic'
	AND (
		b.publisher_id IS DISTINCT FROM ba.id
		OR b.publisher_location IS DISTINCT FROM 'Grand Rapids, MI'
	);

UPDATE public.books b
SET
	publisher_id = bb.id,
	publisher_location = 'Grand Rapids, MI',
	updated_at = now()
FROM public.publishers bb
WHERE b.deleted_at IS NULL
	AND b.publisher_id IS NULL
	AND bb.deleted_at IS NULL
	AND bb.canonical_name = 'Baker Books'
	AND b.publisher = 'Baker Books'
	AND (
		b.publisher_id IS DISTINCT FROM bb.id
		OR b.publisher_location IS DISTINCT FROM 'Grand Rapids, MI'
	);

-- ---------------------------------------------------------------------------
-- B. Praying with Paul — owner-confirmed Baker Academic (was Lifeway)
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher_id = ba.id,
	publisher = 'Baker Academic',
	publisher_location = 'Grand Rapids, MI',
	updated_at = now()
FROM public.publishers ba
WHERE b.deleted_at IS NULL
	AND b.id = '93bb0031-4adf-4187-bf1e-3f3e19be5e23'
	AND ba.deleted_at IS NULL
	AND ba.canonical_name = 'Baker Academic'
	AND (
		b.publisher_id IS DISTINCT FROM ba.id
		OR b.publisher IS DISTINCT FROM 'Baker Academic'
		OR b.publisher_location IS DISTINCT FROM 'Grand Rapids, MI'
	);

-- ---------------------------------------------------------------------------
-- C. Clear imprint moves / mislink repairs
-- ---------------------------------------------------------------------------
-- Beale NTBT: academic monograph, ISBN 9780801026973
UPDATE public.books b
SET
	publisher_id = ba.id,
	publisher = 'Baker Academic',
	publisher_location = 'Grand Rapids, MI',
	updated_at = now()
FROM public.publishers ba
WHERE b.deleted_at IS NULL
	AND b.id = 'd3ce37c3-54e3-4acf-a64d-fa5bbbecc6a4'
	AND ba.deleted_at IS NULL
	AND ba.canonical_name = 'Baker Academic'
	AND (
		b.publisher_id IS DISTINCT FROM ba.id
		OR b.publisher IS DISTINCT FROM 'Baker Academic'
		OR b.publisher_location IS DISTINCT FROM 'Grand Rapids, MI'
	);

-- Schreiner Romans BECNT: series is Baker Exegetical
UPDATE public.books b
SET
	publisher_id = ba.id,
	publisher = 'Baker Academic',
	publisher_location = 'Grand Rapids, MI',
	updated_at = now()
FROM public.publishers ba
WHERE b.deleted_at IS NULL
	AND b.id = 'd20bdc92-23fb-4d28-8790-c4a6141f760b'
	AND ba.deleted_at IS NULL
	AND ba.canonical_name = 'Baker Academic'
	AND (
		b.publisher_id IS DISTINCT FROM ba.id
		OR b.publisher IS DISTINCT FROM 'Baker Academic'
		OR b.publisher_location IS DISTINCT FROM 'Grand Rapids, MI'
	);

-- Arnold Ephesians ZECNT: free-text Zondervan, wrongly FK'd to Baker Books
UPDATE public.books b
SET
	publisher_id = z.id,
	publisher_location = 'Grand Rapids, MI',
	updated_at = now()
FROM public.publishers z
WHERE b.deleted_at IS NULL
	AND b.id = 'dccd6f17-6e4f-41cc-a8f5-b6de5ec1879e'
	AND z.deleted_at IS NULL
	AND z.canonical_name = 'Zondervan'
	AND (
		b.publisher_id IS DISTINCT FROM z.id
		OR b.publisher_location IS DISTINCT FROM 'Grand Rapids, MI'
	);

-- Calvin CC Psalms 93–150: free-text Baker Books after 122, FK still Eerdmans
UPDATE public.books b
SET
	publisher_id = bb.id,
	publisher_location = 'Grand Rapids, MI',
	updated_at = now()
FROM public.publishers bb
WHERE b.deleted_at IS NULL
	AND b.id = 'b82e4d27-8ee8-447a-85bd-7632b08d5476'
	AND bb.deleted_at IS NULL
	AND bb.canonical_name = 'Baker Books'
	AND (
		b.publisher_id IS DISTINCT FROM bb.id
		OR b.publisher_location IS DISTINCT FROM 'Grand Rapids, MI'
	);

-- NIBC Psalms: "BakerBooks" typo; ISBN 9781565635357 is Hendrickson
UPDATE public.books b
SET
	publisher_id = h.id,
	publisher = 'Hendrickson',
	publisher_location = 'Peabody, MA',
	updated_at = now()
FROM public.publishers h
WHERE b.deleted_at IS NULL
	AND b.id = 'f38957cd-06af-48ff-9d94-ac8aec38699c'
	AND h.deleted_at IS NULL
	AND h.canonical_name = 'Hendrickson'
	AND (
		b.publisher_id IS DISTINCT FROM h.id
		OR b.publisher IS DISTINCT FROM 'Hendrickson'
		OR b.publisher_location IS DISTINCT FROM 'Peabody, MA'
	);

-- Litfin Getting to Know the Church Fathers: ISBN 9781587431968 is Brazos
UPDATE public.books b
SET
	publisher_id = br.id,
	publisher = 'Brazos Press',
	publisher_location = 'Grand Rapids, MI',
	updated_at = now()
FROM public.publishers br
WHERE b.deleted_at IS NULL
	AND b.id = '552120ea-ba18-444c-aff4-6b781c0853f1'
	AND br.deleted_at IS NULL
	AND br.canonical_name = 'Brazos Press'
	AND (
		b.publisher_id IS DISTINCT FROM br.id
		OR b.publisher IS DISTINCT FROM 'Brazos Press'
		OR b.publisher_location IS DISTINCT FROM 'Grand Rapids, MI'
	);

-- ---------------------------------------------------------------------------
-- D. Location backfill for already-linked Baker Academic / Baker Books
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	publisher_location = 'Grand Rapids, MI',
	updated_at = now()
WHERE b.deleted_at IS NULL
	AND b.publisher_location IS DISTINCT FROM 'Grand Rapids, MI'
	AND b.publisher_id IN (
		SELECT p.id
		FROM public.publishers p
		WHERE p.deleted_at IS NULL
			AND p.canonical_name IN ('Baker Academic', 'Baker Books')
	);
