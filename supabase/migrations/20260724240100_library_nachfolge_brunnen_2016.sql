-- library_nachfolge_brunnen_2016
-- Remint Bonhoeffer Nachfolge from incorrect Kaiser/1928/english metadata
-- to the Brunnen 2016 hardcover (ISBN 9783765509483). Idempotent.

UPDATE public.books
SET
	publisher = 'Brunnen Verlag',
	publisher_location = 'Gießen',
	publisher_id = NULL,
	year = 2016,
	original_year = 1937,
	isbn = '9783765509483',
	language = 'german',
	page_count = 320,
	updated_at = now()
WHERE id = 'f06ea498-faff-4ff9-b316-a46e15f1a0ff'
	AND deleted_at IS NULL
	AND title = 'Nachfolge'
	AND (
		publisher IS DISTINCT FROM 'Brunnen Verlag'
		OR publisher_location IS DISTINCT FROM 'Gießen'
		OR publisher_id IS DISTINCT FROM NULL
		OR year IS DISTINCT FROM 2016
		OR original_year IS DISTINCT FROM 1937
		OR isbn IS DISTINCT FROM '9783765509483'
		OR language IS DISTINCT FROM 'german'
		OR page_count IS DISTINCT FROM 320
	);
