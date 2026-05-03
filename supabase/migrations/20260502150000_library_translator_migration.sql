-- =============================================================================
-- Session 7b — Translator migration: TDNT (Bromiley) + Joüon/Muraoka LHB #7
-- Idempotent: safe to re-run (skips when translator row already exists / notes clean).
-- =============================================================================

-- Geoffrey W. Bromiley (TDNT translator)
INSERT INTO public.people (last_name, first_name, created_by)
SELECT 'Bromiley', 'Geoffrey W.', NULL::uuid
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND lower(p.last_name) = 'bromiley'
		AND (p.first_name ILIKE 'geoffrey%' OR p.first_name ILIKE 'g.%' OR p.first_name = 'Geoffrey W.')
);

-- TDNT volumes: add translator row; strip translator sentence from personal_notes.
WITH brom AS (
	SELECT p.id
	FROM public.people p
	WHERE p.deleted_at IS NULL
		AND lower(p.last_name) = 'bromiley'
		AND (p.first_name ILIKE 'geoffrey%' OR p.first_name ILIKE 'g.%' OR p.first_name = 'Geoffrey W.')
	ORDER BY p.created_at
	LIMIT 1
),
tdnt_books AS (
	SELECT b.id AS book_id,
		(
			SELECT COALESCE(max(ba.sort_order), 0) + 1
			FROM public.book_authors ba
			WHERE ba.book_id = b.id
		) AS next_sort
	FROM public.books b
	INNER JOIN public.series s ON s.id = b.series_id AND s.deleted_at IS NULL
	WHERE b.deleted_at IS NULL
		AND (upper(trim(s.abbreviation)) = 'TDNT' OR s.name ILIKE '%TDNT%')
		AND b.personal_notes IS NOT NULL
		AND b.personal_notes ILIKE '%bromiley%'
		AND b.personal_notes ILIKE '%translated from german%'
)
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT tb.book_id, brom.id, 'translator', tb.next_sort
FROM tdnt_books tb
	CROSS JOIN brom
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors x
	WHERE x.book_id = tb.book_id AND x.person_id = brom.id AND x.role = 'translator'
);

UPDATE public.books b
SET personal_notes = trim(both E'\n \t' FROM regexp_replace(
	coalesce(b.personal_notes, ''),
	E'Translated from German by Geoffrey W\\. Bromiley\\.\\s*',
	'',
	'ni'
))
FROM public.series s
WHERE b.series_id = s.id
	AND s.deleted_at IS NULL
	AND b.deleted_at IS NULL
	AND (upper(trim(s.abbreviation)) = 'TDNT' OR s.name ILIKE '%TDNT%')
	AND b.personal_notes IS NOT NULL
	AND b.personal_notes ILIKE '%translated from german%'
	AND b.personal_notes ILIKE '%bromiley%';

-- Joüon / Muraoka (LHB): Muraoka → translator; strip workaround line from notes.
-- (Target alias `ba` must not appear inside FROM joins — use comma-FROM + WHERE.)
UPDATE public.book_authors ba
SET role = 'translator',
	sort_order = 2
FROM public.books b,
	public.people pm
WHERE ba.book_id = b.id
	AND ba.person_id = pm.id
	AND pm.deleted_at IS NULL
	AND b.deleted_at IS NULL
	AND b.personal_notes IS NOT NULL
	AND b.personal_notes ILIKE '%translator: t. muraoka%'
	AND lower(pm.last_name) = 'muraoka'
	AND pm.first_name IS NOT DISTINCT FROM 'T.'
	AND ba.role = 'author';

UPDATE public.book_authors ba
SET sort_order = 1
FROM public.books b,
	public.people pj
WHERE ba.book_id = b.id
	AND ba.person_id = pj.id
	AND pj.deleted_at IS NULL
	AND b.deleted_at IS NULL
	AND b.personal_notes IS NOT NULL
	AND b.personal_notes ILIKE '%translator: t. muraoka%'
	AND (
		lower(pj.last_name) = 'jouon'
		OR pj.last_name ILIKE 'joüon'
		OR pj.last_name ILIKE 'jo%on'
	)
	AND ba.role = 'author';

UPDATE public.books b
SET personal_notes = trim(both E'\n \t' FROM regexp_replace(
	coalesce(b.personal_notes, ''),
	E'\\s*Translator: T\\. Muraoka \\(per Library_Migration_Notes Pre-Trip translator workaround\\)\\.?\\s*',
	E'\n',
	'ni'
))
WHERE b.deleted_at IS NULL
	AND b.personal_notes IS NOT NULL
	AND b.personal_notes ILIKE '%translator: t. muraoka%';
