-- library_cost_of_discipleship_scribner_1995
-- Remint Cost of Discipleship to Scribner 1995 (ISBN 9780684815008),
-- consolidate import duplicate into copy_count=2. Idempotent.

-- Keeper (older row): edition remint + two physical copies
UPDATE public.books
SET
	publisher = 'Scribner',
	publisher_location = 'New York',
	publisher_id = NULL,
	year = 1995,
	original_year = 1937,
	isbn = '9780684815008',
	page_count = 320,
	copy_count = 2,
	updated_at = now()
WHERE id = '1a886166-c957-4640-93c2-d03de79bc661'
	AND deleted_at IS NULL
	AND title = 'The Cost of Discipleship'
	AND (
		publisher IS DISTINCT FROM 'Scribner'
		OR publisher_location IS DISTINCT FROM 'New York'
		OR publisher_id IS DISTINCT FROM NULL
		OR year IS DISTINCT FROM 1995
		OR original_year IS DISTINCT FROM 1937
		OR isbn IS DISTINCT FROM '9780684815008'
		OR page_count IS DISTINCT FROM 320
		OR copy_count IS DISTINCT FROM 2
	);

-- Soft-delete Goodreads/import twin (same old ISBN metadata)
UPDATE public.books
SET
	deleted_at = now(),
	updated_at = now()
WHERE id = '94a952ff-50a1-4f93-afc1-e852a66efb11'
	AND deleted_at IS NULL
	AND title = 'The Cost of Discipleship';
