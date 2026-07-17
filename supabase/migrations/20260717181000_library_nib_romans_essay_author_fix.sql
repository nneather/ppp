-- Fix NIB Vol X Romans essay author (088 follow-up).
-- Migration 20260717180000 set people.first_name = 'N. T.' but the existing
-- row already had middle_name = 'T.', so the essay_authors JOIN
-- (middle_name = '') matched zero rows.

UPDATE public.people
SET
	first_name = 'N. T.',
	middle_name = NULL,
	updated_at = now()
WHERE id = 'e4982542-dabb-4673-b705-404e68cb12ab'
	AND deleted_at IS NULL;

INSERT INTO public.essay_authors (essay_id, person_id, role, sort_order)
SELECT e.id, p.id, 'author', 0
FROM public.essays e
JOIN public.people p ON p.id = 'e4982542-dabb-4673-b705-404e68cb12ab'
WHERE e.id = 'a3c5259c-cd4f-4003-8ab8-ed8c48f5e004'
	AND e.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.essay_authors ea
		WHERE ea.essay_id = e.id AND ea.person_id = p.id
	);

INSERT INTO public.book_bible_coverage (essay_id, bible_book, created_by)
SELECT e.id, 'Romans', 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM public.essays e
WHERE e.id = 'a3c5259c-cd4f-4003-8ab8-ed8c48f5e004'
	AND e.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.book_bible_coverage bbc
		WHERE bbc.essay_id = e.id AND bbc.bible_book = 'Romans'
	);
