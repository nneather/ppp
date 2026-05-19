-- =============================================================================
-- Recovery: child publisher imprints (idempotent INSERT…SELECT per row).
-- Parent rows were seeded in 20260521120100; nested child_rows CTE did not persist.
-- =============================================================================

INSERT INTO public.publishers (canonical_name, parent_id, default_location, aliases)
SELECT
	'IVP Academic',
	pr.id,
	'Downers Grove, IL',
	ARRAY['InterVarsity Press Academic', 'IVP Academic Books']::text[]
FROM public.publishers pr
WHERE pr.canonical_name = 'IVP'
	AND pr.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM public.publishers p
		WHERE p.deleted_at IS NULL AND p.canonical_name = 'IVP Academic'
	);

INSERT INTO public.publishers (canonical_name, parent_id, default_location, aliases)
SELECT
	'Baker Academic',
	pr.id,
	'Grand Rapids, MI',
	ARRAY[
		'Baker Academic, a division of Baker Publishing Group',
		'Baker Academic Books'
	]::text[]
FROM public.publishers pr
WHERE pr.canonical_name = 'Baker Publishing Group'
	AND pr.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM public.publishers p
		WHERE p.deleted_at IS NULL AND p.canonical_name = 'Baker Academic'
	);

INSERT INTO public.publishers (canonical_name, parent_id, default_location, aliases)
SELECT
	'Baker Books',
	pr.id,
	'Grand Rapids, MI',
	ARRAY['Baker Books, a division of Baker Publishing Group']::text[]
FROM public.publishers pr
WHERE pr.canonical_name = 'Baker Publishing Group'
	AND pr.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM public.publishers p
		WHERE p.deleted_at IS NULL AND p.canonical_name = 'Baker Books'
	);

INSERT INTO public.publishers (canonical_name, parent_id, default_location, aliases)
SELECT
	'Brazos Press',
	pr.id,
	'Grand Rapids, MI',
	ARRAY['Brazos', 'Brazos Press, a division of Baker Publishing Group']::text[]
FROM public.publishers pr
WHERE pr.canonical_name = 'Baker Publishing Group'
	AND pr.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM public.publishers p
		WHERE p.deleted_at IS NULL AND p.canonical_name = 'Brazos Press'
	);

INSERT INTO public.publishers (canonical_name, parent_id, default_location, aliases)
SELECT
	'Zondervan Academic',
	pr.id,
	'Grand Rapids, MI',
	ARRAY['Zondervan Academic Books']::text[]
FROM public.publishers pr
WHERE pr.canonical_name = 'Zondervan'
	AND pr.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM public.publishers p
		WHERE p.deleted_at IS NULL AND p.canonical_name = 'Zondervan Academic'
	);

INSERT INTO public.publishers (canonical_name, parent_id, default_location, aliases)
SELECT
	'T&T Clark',
	pr.id,
	'London',
	ARRAY['T and T Clark', 'T & T Clark', 'T&T Clark International']::text[]
FROM public.publishers pr
WHERE pr.canonical_name = 'Bloomsbury'
	AND pr.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM public.publishers p
		WHERE p.deleted_at IS NULL AND p.canonical_name = 'T&T Clark'
	);

INSERT INTO public.publishers (canonical_name, parent_id, default_location, aliases)
SELECT
	'Logos / Faithlife',
	pr.id,
	'Bellingham, WA',
	ARRAY['Logos Bible Software', 'Faithlife Corporation']::text[]
FROM public.publishers pr
WHERE pr.canonical_name = 'Lexham Press'
	AND pr.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM public.publishers p
		WHERE p.deleted_at IS NULL AND p.canonical_name = 'Logos / Faithlife'
	);
