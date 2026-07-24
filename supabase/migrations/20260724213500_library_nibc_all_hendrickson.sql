-- library_nibc_all_hendrickson
-- Owner: every NIBC vol → Hendrickson / Peabody (overrides prior Baker /
-- Harper / Paternoster free-text). Idempotent via series abbreviation +
-- IS DISTINCT FROM.

UPDATE public.books b
SET
	publisher_id = h.id,
	publisher = 'Hendrickson',
	publisher_location = 'Peabody, MA',
	updated_at = now()
FROM public.publishers h,
	public.series s
WHERE b.deleted_at IS NULL
	AND h.deleted_at IS NULL
	AND h.canonical_name = 'Hendrickson'
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'NIBC'
	AND s.id = b.series_id
	AND (
		b.publisher_id IS DISTINCT FROM h.id
		OR b.publisher IS DISTINCT FROM 'Hendrickson'
		OR b.publisher_location IS DISTINCT FROM 'Peabody, MA'
	);
