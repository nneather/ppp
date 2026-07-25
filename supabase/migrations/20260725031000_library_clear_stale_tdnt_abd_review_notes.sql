-- Clear stale importer review notes on Track B–confirmed multi-vol dictionaries.
-- needs_review is already false; book detail still showed needs_review_note
-- ("OL match: title-only…", "Missing: publisher") after [160] remints.
-- HALAT ISBN shelf notes intentionally left alone.

UPDATE public.books b
SET
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
FROM public.series s
WHERE
	b.series_id = s.id
	AND b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation IN ('TDNT', 'ABD');
