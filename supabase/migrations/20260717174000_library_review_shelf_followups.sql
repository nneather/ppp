-- Shelf-bound follow-ups: genre for Start Something New; confirmed ISBNs clear two books.

UPDATE public.books
SET
	genre = 'Christian Living',
	updated_at = now()
WHERE id = '3e83a2c9-1408-4c31-9725-2536182b4984'
	AND deleted_at IS NULL;

-- Siebenthal Ancient Greek Grammar — owner-confirmed ISBN
UPDATE public.books
SET
	isbn = '9781789975864',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = 'd5bb4a1f-e634-4fa8-8017-a83d449e2c6a'
	AND deleted_at IS NULL;

-- Casto Deuteronomy (REC) — owner-corrected ISBN
UPDATE public.books
SET
	isbn = '9781629959726',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '9a301dff-111c-459c-a9e7-d419fba08c5f'
	AND deleted_at IS NULL;
