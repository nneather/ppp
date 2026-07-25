-- library_catalog_consistency_177
-- Apply owner MC from docs/decisions/177-catalog-consistency-audit-track-b.md
-- (2026-07-24): Q1A Q2A Q3A Q4A Q5A Q6A Q7I Q8A.
-- Idempotent. Hosted push only. No schema / type regen.

-- Owner profile for created_by on new series rows
-- a14833c9-459e-4667-aef3-dae698734f6d

-- ---------------------------------------------------------------------------
-- Q1A — Alter Norton Hebrew Bible ×3
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	genre = 'Old Testament',
	total_volumes = 3,
	publisher_location = 'New York',
	updated_at = now()
WHERE b.deleted_at IS NULL
	AND b.id IN (
		'e61c137d-b502-48f6-86dc-dfc9973fb328'::uuid, -- vol 1
		'43914f5b-18ee-4758-8dfc-e0b4074c8a8c'::uuid, -- vol 2
		'36840b3e-2d42-4ccb-9df4-ffb9d615facf'::uuid  -- vol 3
	)
	AND (
		b.genre IS DISTINCT FROM 'Old Testament'
		OR b.total_volumes IS DISTINCT FROM 3
		OR b.publisher_location IS DISTINCT FROM 'New York'
	);

-- ---------------------------------------------------------------------------
-- Q2A — ABD: omit series segment; set imprint + total_volumes
-- ---------------------------------------------------------------------------
UPDATE public.series s
SET
	include_in_citation = false,
	updated_at = now()
WHERE s.id = 'f9888772-a7d8-4841-90ca-46c7de73a395'::uuid
	AND s.deleted_at IS NULL
	AND s.include_in_citation IS DISTINCT FROM false;

UPDATE public.books b
SET
	publisher = 'Doubleday',
	publisher_location = 'New York',
	year = 1992,
	total_volumes = 6,
	work_type = 'reference_work',
	updated_at = now()
WHERE b.deleted_at IS NULL
	AND b.series_id = 'f9888772-a7d8-4841-90ca-46c7de73a395'::uuid
	AND b.id IN (
		'96027142-d8fc-4d27-bf0e-8df7cc48cb8e'::uuid,
		'35acfe37-9ca7-4dd6-a193-55632a0f2a2f'::uuid,
		'1df466cb-6ce7-424c-8ff9-c8fe24259f71'::uuid,
		'6347dff7-9efd-4985-9fbd-eb4a6c11b44a'::uuid,
		'035fe18a-e02b-4702-87a6-fa8eeb5faf01'::uuid,
		'7ead2a71-f664-4d9d-b59a-8a1946d91249'::uuid
	)
	AND (
		b.publisher IS DISTINCT FROM 'Doubleday'
		OR b.publisher_location IS DISTINCT FROM 'New York'
		OR b.year IS DISTINCT FROM 1992
		OR b.total_volumes IS DISTINCT FROM 6
	);

-- ---------------------------------------------------------------------------
-- Q3A — TWOT: omit series segment; Moody imprint + total_volumes
-- ---------------------------------------------------------------------------
UPDATE public.series s
SET
	include_in_citation = false,
	updated_at = now()
WHERE s.id = 'de134e87-1a4c-431f-9a37-51d2d98874fb'::uuid
	AND s.deleted_at IS NULL
	AND s.include_in_citation IS DISTINCT FROM false;

UPDATE public.books b
SET
	publisher_id = m.id,
	publisher = 'Moody Press',
	publisher_location = 'Chicago',
	year = 1980,
	total_volumes = 2,
	work_type = 'reference_work',
	updated_at = now()
FROM public.publishers m
WHERE m.id = '57fe6db3-3f80-42b5-9214-9479901703b6'::uuid
	AND m.deleted_at IS NULL
	AND b.deleted_at IS NULL
	AND b.series_id = 'de134e87-1a4c-431f-9a37-51d2d98874fb'::uuid
	AND b.id IN (
		'1aa2e6f8-d4f3-4796-b74e-f71432a3ae6c'::uuid,
		'a027e4e5-42fb-4113-8e7e-71acfcdff72e'::uuid
	)
	AND (
		b.publisher_id IS DISTINCT FROM m.id
		OR b.publisher IS DISTINCT FROM 'Moody Press'
		OR b.publisher_location IS DISTINCT FROM 'Chicago'
		OR b.year IS DISTINCT FROM 1980
		OR b.total_volumes IS DISTINCT FROM 2
	);

-- ---------------------------------------------------------------------------
-- Q4A — BDAG include_in_citation = false (match LSJ / HALAT)
-- ---------------------------------------------------------------------------
UPDATE public.series s
SET
	include_in_citation = false,
	updated_at = now()
WHERE s.id = '86ef98b1-d265-421e-b0c3-3d7f270288f9'::uuid
	AND s.deleted_at IS NULL
	AND s.include_in_citation IS DISTINCT FROM false;

-- ---------------------------------------------------------------------------
-- Q5A — BDB series carrier + attach Brown-Driver-Briggs
-- ---------------------------------------------------------------------------
INSERT INTO public.series (name, abbreviation, include_in_citation, created_by)
SELECT
	'Brown-Driver-Briggs Hebrew and English Lexicon',
	'BDB',
	false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = 'BDB'
);

UPDATE public.books b
SET
	series_id = s.id,
	work_type = 'reference_work',
	updated_at = now()
FROM public.series s
WHERE s.deleted_at IS NULL
	AND s.abbreviation = 'BDB'
	AND b.id = '6d98701d-370f-4885-9c6c-41f741c20012'::uuid
	AND b.deleted_at IS NULL
	AND (
		b.series_id IS DISTINCT FROM s.id
		OR b.work_type IS DISTINCT FROM 'reference_work'
	);

-- ---------------------------------------------------------------------------
-- Q6A — IVP Bible Dictionary Series: omit branding from volume cites
-- ---------------------------------------------------------------------------
UPDATE public.series s
SET
	include_in_citation = false,
	updated_at = now()
WHERE s.id = '2bf4717c-3a94-4a6b-a636-cdbadb2e3db3'::uuid
	AND s.deleted_at IS NULL
	AND s.include_in_citation IS DISTINCT FROM false;

-- ---------------------------------------------------------------------------
-- Q8A — Vermes DSS: fix given name + add author (keep translator)
-- ---------------------------------------------------------------------------
UPDATE public.people p
SET
	first_name = 'Geza',
	updated_at = now()
WHERE p.id = '99fd7301-3c17-4e38-9243-f30399ca301c'::uuid
	AND p.deleted_at IS NULL
	AND p.first_name IS DISTINCT FROM 'Geza';

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT
	'bdab4316-a922-49d9-862d-0ec4ab42444d'::uuid,
	'99fd7301-3c17-4e38-9243-f30399ca301c'::uuid,
	'author',
	0
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = 'bdab4316-a922-49d9-862d-0ec4ab42444d'::uuid
		AND ba.person_id = '99fd7301-3c17-4e38-9243-f30399ca301c'::uuid
		AND ba.role = 'author'
);

-- Keep translator credit after author in sort order
UPDATE public.book_authors ba
SET sort_order = 1
WHERE ba.book_id = 'bdab4316-a922-49d9-862d-0ec4ab42444d'::uuid
	AND ba.person_id = '99fd7301-3c17-4e38-9243-f30399ca301c'::uuid
	AND ba.role = 'translator'
	AND ba.sort_order IS DISTINCT FROM 1;
