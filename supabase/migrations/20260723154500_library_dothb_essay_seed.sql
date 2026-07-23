-- DOTHB essay smoke seed + parent polish
-- Owner: Canaan (Tsumura) + Judges, Book of (Stone); keep IVP dictionaries
-- grouped on one series; do NOT store DOTHB as series.abbreviation (that abbr
-- belongs in a future per-work citation field — SBLHS2 lists DOTHB/DJG/DPL,
-- but series.abbreviation='IVP' would poison article footnotes as "in IVP").

-- ---------------------------------------------------------------------------
-- Series: keep dictionaries together; clear non-citation "IVP" abbreviation
-- ---------------------------------------------------------------------------
UPDATE public.series
SET
	name = 'IVP Bible Dictionary Series',
	abbreviation = NULL,
	updated_at = now()
WHERE id = '2bf4717c-3a94-4a6b-a636-cdbadb2e3db3'
	AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Parent book: reference_work + Turabian place
-- Editors already on book_authors — computeMissingImportant needs editor, not
-- author, for non-monographs; no_attributed_author stays false.
-- ---------------------------------------------------------------------------
UPDATE public.books
SET
	work_type = 'reference_work',
	publisher_location = 'Downers Grove, IL',
	updated_at = now()
WHERE id = '241b0487-5b2e-4129-832e-47423f1d53e7'
	AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- People (article authors)
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name)
SELECT v.first_name, v.middle_name, v.last_name
FROM (VALUES
	('David', 'Toshio', 'Tsumura'),
	('L.', 'G.', 'Stone')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
		AND p.deleted_at IS NULL
);

-- ---------------------------------------------------------------------------
-- Essay 1: Canaan, Canaanites (Tsumura) pp. 122–132
-- ---------------------------------------------------------------------------
INSERT INTO public.essays (essay_title, parent_book_id, page_start, page_end)
SELECT
	'Canaan, Canaanites',
	'241b0487-5b2e-4129-832e-47423f1d53e7'::uuid,
	122,
	132
WHERE NOT EXISTS (
	SELECT 1 FROM public.essays e
	WHERE e.parent_book_id = '241b0487-5b2e-4129-832e-47423f1d53e7'
		AND e.essay_title = 'Canaan, Canaanites'
		AND e.deleted_at IS NULL
);

INSERT INTO public.essay_authors (essay_id, person_id, role, sort_order)
SELECT e.id, p.id, 'author', 0
FROM public.essays e
JOIN public.people p
	ON p.last_name = 'Tsumura'
	AND p.first_name = 'David'
	AND COALESCE(p.middle_name, '') = 'Toshio'
	AND p.deleted_at IS NULL
WHERE e.deleted_at IS NULL
	AND e.essay_title = 'Canaan, Canaanites'
	AND e.parent_book_id = '241b0487-5b2e-4129-832e-47423f1d53e7'
ON CONFLICT (essay_id, person_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Essay 2: Judges, Book of (Stone) pp. 592–606
-- ---------------------------------------------------------------------------
INSERT INTO public.essays (essay_title, parent_book_id, page_start, page_end)
SELECT
	'Judges, Book of',
	'241b0487-5b2e-4129-832e-47423f1d53e7'::uuid,
	592,
	606
WHERE NOT EXISTS (
	SELECT 1 FROM public.essays e
	WHERE e.parent_book_id = '241b0487-5b2e-4129-832e-47423f1d53e7'
		AND e.essay_title = 'Judges, Book of'
		AND e.deleted_at IS NULL
);

INSERT INTO public.essay_authors (essay_id, person_id, role, sort_order)
SELECT e.id, p.id, 'author', 0
FROM public.essays e
JOIN public.people p
	ON p.last_name = 'Stone'
	AND p.first_name = 'L.'
	AND COALESCE(p.middle_name, '') = 'G.'
	AND p.deleted_at IS NULL
WHERE e.deleted_at IS NULL
	AND e.essay_title = 'Judges, Book of'
	AND e.parent_book_id = '241b0487-5b2e-4129-832e-47423f1d53e7'
ON CONFLICT (essay_id, person_id) DO NOTHING;
