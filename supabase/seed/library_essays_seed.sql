-- =============================================================================
-- Library Wave 2 Session 1 — essay seed for citation QA
-- Filed: 2026-07-06
--
-- ~5 sample essays against existing parent books (ABD, TDNT, BDAG).
-- Idempotent: parent books looked up by title (+ volume where needed);
-- essays deduped by (parent_book_id, essay_title).
--
-- HOW TO APPLY (hosted prod):
--   Paste into Supabase Dashboard → SQL editor, or psql with direct URI.
--
-- DEPENDENCIES:
--   Parent books must already exist (Pass 1 import). Rows whose parent is
--   missing are skipped silently via WHERE NOT EXISTS guards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- BDAG series carrier (unsigned s.v. uses series.abbreviation)
-- ---------------------------------------------------------------------------
INSERT INTO public.series (name, abbreviation)
SELECT 'BDAG', 'BDAG'
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.abbreviation = 'BDAG' AND s.deleted_at IS NULL
);

UPDATE public.books b
SET
	series_id = (SELECT s.id FROM public.series s WHERE s.abbreviation = 'BDAG' AND s.deleted_at IS NULL LIMIT 1),
	work_type = 'reference_work'
WHERE b.deleted_at IS NULL
	AND b.title = 'A Greek-English Lexicon of the New Testament and Other Early Christian Literature';

UPDATE public.books b
SET work_type = 'reference_work'
WHERE b.deleted_at IS NULL
	AND b.title = 'The Anchor Bible Dictionary';

UPDATE public.books b
SET work_type = 'reference_work'
WHERE b.deleted_at IS NULL
	AND b.title = 'Theological Dictionary of the New Testament';

-- ---------------------------------------------------------------------------
-- People (article authors)
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name)
SELECT v.first_name, v.middle_name, v.last_name
FROM (VALUES
	('James', 'A.', 'Sanders'),
	('Gerhard', NULL, 'Kittel')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND p.last_name = v.last_name
		AND p.deleted_at IS NULL
);

-- ---------------------------------------------------------------------------
-- Essay 1: BDAG ἀγάπη (unsigned s.v.)
-- ---------------------------------------------------------------------------
INSERT INTO public.essays (essay_title, parent_book_id, page_start, page_end)
SELECT
	'ἀγάπη',
	b.id,
	12,
	NULL
FROM public.books b
WHERE b.deleted_at IS NULL
	AND b.title = 'A Greek-English Lexicon of the New Testament and Other Early Christian Literature'
	AND NOT EXISTS (
		SELECT 1 FROM public.essays e
		WHERE e.parent_book_id = b.id
			AND e.essay_title = 'ἀγάπη'
			AND e.deleted_at IS NULL
	);

-- ---------------------------------------------------------------------------
-- Essay 2: ABD Canon (signed — Sanders)
-- ---------------------------------------------------------------------------
INSERT INTO public.essays (essay_title, parent_book_id, page_start, page_end)
SELECT
	'Canon',
	b.id,
	835,
	NULL
FROM public.books b
WHERE b.deleted_at IS NULL
	AND b.title = 'The Anchor Bible Dictionary'
	AND b.volume_number = '1'
	AND NOT EXISTS (
		SELECT 1 FROM public.essays e
		WHERE e.parent_book_id = b.id
			AND e.essay_title = 'Canon'
			AND e.deleted_at IS NULL
	);

INSERT INTO public.essay_authors (essay_id, person_id, role, sort_order)
SELECT e.id, p.id, 'author', 0
FROM public.essays e
JOIN public.books b ON b.id = e.parent_book_id AND b.deleted_at IS NULL
JOIN public.people p ON p.last_name = 'Sanders' AND p.first_name = 'James' AND p.deleted_at IS NULL
WHERE e.deleted_at IS NULL
	AND e.essay_title = 'Canon'
	AND b.title = 'The Anchor Bible Dictionary'
	AND b.volume_number = '1'
ON CONFLICT (essay_id, person_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Essay 3: ABD Abraham (unsigned s.v. on ABD abbreviation)
-- ---------------------------------------------------------------------------
INSERT INTO public.essays (essay_title, parent_book_id, page_start, page_end)
SELECT
	'Abraham',
	b.id,
	35,
	NULL
FROM public.books b
WHERE b.deleted_at IS NULL
	AND b.title = 'The Anchor Bible Dictionary'
	AND b.volume_number = '1'
	AND NOT EXISTS (
		SELECT 1 FROM public.essays e
		WHERE e.parent_book_id = b.id
			AND e.essay_title = 'Abraham'
			AND e.deleted_at IS NULL
	);

-- ---------------------------------------------------------------------------
-- Essay 4: TDNT λέγω (signed — Kittel)
-- ---------------------------------------------------------------------------
INSERT INTO public.essays (essay_title, parent_book_id, page_start, page_end)
SELECT
	'λέγω',
	b.id,
	100,
	NULL
FROM public.books b
WHERE b.deleted_at IS NULL
	AND b.title = 'Theological Dictionary of the New Testament'
	AND b.volume_number = '4'
	AND NOT EXISTS (
		SELECT 1 FROM public.essays e
		WHERE e.parent_book_id = b.id
			AND e.essay_title = 'λέγω'
			AND e.deleted_at IS NULL
	);

INSERT INTO public.essay_authors (essay_id, person_id, role, sort_order)
SELECT e.id, p.id, 'author', 0
FROM public.essays e
JOIN public.books b ON b.id = e.parent_book_id AND b.deleted_at IS NULL
JOIN public.people p ON p.last_name = 'Kittel' AND p.first_name = 'Gerhard' AND p.deleted_at IS NULL
WHERE e.deleted_at IS NULL
	AND e.essay_title = 'λέγω'
	AND b.title = 'Theological Dictionary of the New Testament'
	AND b.volume_number = '4'
ON CONFLICT (essay_id, person_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Essay 5: ABD Covenant (unsigned — second dictionary lemma)
-- ---------------------------------------------------------------------------
INSERT INTO public.essays (essay_title, parent_book_id, page_start, page_end)
SELECT
	'Covenant',
	b.id,
	1120,
	NULL
FROM public.books b
WHERE b.deleted_at IS NULL
	AND b.title = 'The Anchor Bible Dictionary'
	AND b.volume_number = '1'
	AND NOT EXISTS (
		SELECT 1 FROM public.essays e
		WHERE e.parent_book_id = b.id
			AND e.essay_title = 'Covenant'
			AND e.deleted_at IS NULL
	);
