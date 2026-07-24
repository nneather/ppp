-- library_lsj_edition_clarendon_fix
-- LSJ: edition pass-through (avoid "…supplement ed.") + Clarendon free-text
-- (unlink OUP so Turabian doesn't prefer registry canonical_name). Idempotent.

UPDATE public.books b
SET
	edition = '9th edition with revised supplement',
	publisher = 'Clarendon Press',
	publisher_location = 'Oxford',
	publisher_id = NULL,
	updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND s.id = b.series_id
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'LSJ'
	AND b.title = 'A Greek-English Lexicon'
	AND (
		b.edition IS DISTINCT FROM '9th edition with revised supplement'
		OR b.publisher IS DISTINCT FROM 'Clarendon Press'
		OR b.publisher_location IS DISTINCT FROM 'Oxford'
		OR b.publisher_id IS DISTINCT FROM NULL
	);
