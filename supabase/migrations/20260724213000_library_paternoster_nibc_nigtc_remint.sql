-- library_paternoster_nibc_nigtc_remint
-- Owner: NIBC vols free-text Paternoster → Hendrickson / Peabody;
-- Thiselton NIGTC 1 Cor → Eerdmans / Grand Rapids. Leave other Paternoster
-- monographs alone. Idempotent via id + IS DISTINCT FROM.

UPDATE public.books b
SET
	publisher_id = h.id,
	publisher = 'Hendrickson',
	publisher_location = 'Peabody, MA',
	updated_at = now()
FROM public.publishers h
WHERE b.deleted_at IS NULL
	AND h.deleted_at IS NULL
	AND h.canonical_name = 'Hendrickson'
	AND b.id IN (
		'e8cb4962-588c-455e-970a-3b6463c4b8a2', -- Galatians NIBC
		'0a1f0e02-be50-4827-86e2-078e825bb6aa', -- John NIBC
		'6d31efe1-14aa-44df-bb5f-7231445f91cb', -- Matthew NIBC
		'7a9061ba-9cdd-426c-bcec-5c672f39c9d6'  -- Philippians NIBC
	)
	AND (
		b.publisher_id IS DISTINCT FROM h.id
		OR b.publisher IS DISTINCT FROM 'Hendrickson'
		OR b.publisher_location IS DISTINCT FROM 'Peabody, MA'
	);

UPDATE public.books b
SET
	publisher_id = e.id,
	publisher = 'Eerdmans',
	publisher_location = 'Grand Rapids, MI',
	updated_at = now()
FROM public.publishers e
WHERE b.deleted_at IS NULL
	AND e.deleted_at IS NULL
	AND e.canonical_name = 'Eerdmans'
	AND b.id = 'd27e2f36-3d04-4356-9b19-4dbfa82c99be' -- Thiselton, First Epistle to the Corinthians NIGTC
	AND (
		b.publisher_id IS DISTINCT FROM e.id
		OR b.publisher IS DISTINCT FROM 'Eerdmans'
		OR b.publisher_location IS DISTINCT FROM 'Grand Rapids, MI'
	);
