-- Batch 4a: bulk-accept clear genre proposals; hold boundary cases for Batch 4 Qs.

WITH accepted AS (
	UPDATE public.books b
	SET
		genre = p.fields->'genre'->>'proposed',
		needs_review = false,
		needs_review_note = NULL,
		updated_at = now()
	FROM public.book_metadata_proposals p
	WHERE p.book_id = b.id
		AND p.deleted_at IS NULL
		AND p.status = 'pending'
		AND b.deleted_at IS NULL
		AND b.needs_review
		AND (b.needs_review_note IS NULL OR b.needs_review_note NOT ILIKE '%shelf%')
		AND p.fields ? 'genre'
		AND p.fields->'genre'->>'proposed' IN (
			'Apologetics',
			'Church History',
			'Culture',
			'Philosophy',
			'Pastoral Ministry',
			'Christian Living',
			'Devotional',
			'Poetry',
			'Music',
			'Sports',
			'Biblical Theology',
			'Applied Theology'
		)
		AND b.id NOT IN (
			-- Christian Living boundaries
			'1a111969-c2a1-4317-80d5-bf213524a394', -- Screwtape
			'f06ea498-faff-4ff9-b316-a46e15f1a0ff', -- Nachfolge
			'1a886166-c957-4640-93c2-d03de79bc661', -- Cost of Discipleship
			'94a952ff-50a1-4f93-afc1-e852a66efb11', -- Cost of Discipleship dup
			'fdb6cb28-0134-4d93-9a6a-6db65f678004', -- Leading with a Limp
			'81de3be7-db83-496a-9f72-558dbc596df5', -- Gentle and Lowly
			-- Church History boundaries
			'be0aeb4e-ae9b-4bc4-be39-70503bb1a720', -- Book of Church Order
			'd518d527-416d-4913-ad69-12d4c6af9567', -- One Holy Catholic
			'2b91fad3-860a-4278-903a-9b583cb4bd15', -- Old Church Book
			'2c1c3a13-f095-4436-ab59-134e7118c901', -- On Being Presbyterian
			-- Culture → Politics?
			'5f8ca6ba-bf75-4c5a-81ab-e2b7697316b8',
			'690740e8-579c-49af-a09d-af27dac552a8',
			'c182dbee-c3d9-4cbf-9e80-ce275c1e64de',
			'5ef4cee6-935a-4bf8-9211-655e18082c8a',
			'ce1c7c3a-d936-4366-b0d6-102bd48af41a',
			'21130550-13b4-4633-8795-fd1e0c2c90b3',
			'cbe13715-345a-4c39-9a5d-e22f159ae4a8',
			-- Philosophy → Politics / Literary Criticism?
			'8911a777-5bf2-4420-85ff-c0c0ca30ee1c',
			'442d0c24-23e2-4152-b094-8ae7277665aa',
			'24539cc8-3aa7-4638-a629-e2492421313c',
			'fa36aa22-4f3c-44da-99dc-1d02b6ef17e6',
			'9bd85321-c646-4b4b-a25c-2b44d747aa9d',
			'9a2828fe-8f3e-4ff2-9963-073b2eedec55',
			'90003850-253d-4e18-b985-598d1a4496aa',
			'58557643-0d3c-45b6-9422-b1a2fbdae801', -- Poetik
			-- Pastoral
			'5980b0ec-4c8b-42e7-ac91-e487fbf4ec90', -- Brooks How to Know a Person
			'15e4e6e0-cf8e-4ecc-abbc-ecaebc9fcf80'  -- Niebuhr Purpose of Church
		)
		AND b.title <> 'The Church of Christ: A Biblical Ecclesiology for Today'
		AND b.title <> 'Defend Like Petrosian'
	RETURNING b.id
)
UPDATE public.book_metadata_proposals p
SET status = 'accepted', reviewed_at = now(), updated_at = now()
WHERE p.book_id IN (SELECT id FROM accepted)
	AND p.deleted_at IS NULL
	AND p.status = 'pending';

-- Chess → Hobbies
WITH hobbies AS (
	UPDATE public.books b
	SET
		genre = 'Hobbies',
		needs_review = false,
		needs_review_note = NULL,
		updated_at = now()
	FROM public.book_metadata_proposals p
	WHERE p.book_id = b.id
		AND p.deleted_at IS NULL
		AND p.status = 'pending'
		AND b.deleted_at IS NULL
		AND b.needs_review
		AND b.title IN (
			'Bobby Fischer Teaches Chess',
			'Chess Openings 1',
			'Defend Like Petrosian'
		)
	RETURNING b.id
)
UPDATE public.book_metadata_proposals p
SET status = 'accepted', reviewed_at = now(), updated_at = now()
WHERE p.book_id IN (SELECT id FROM hobbies)
	AND p.deleted_at IS NULL AND p.status = 'pending';

-- Remaining General → remapped
WITH gen AS (
	UPDATE public.books b
	SET
		genre = CASE b.title
			WHEN 'Indistractable' THEN 'Self-Help'
			WHEN 'The Checklist Manifesto' THEN 'Business'
			WHEN 'The Body Keeps the Score' THEN 'Science'
			WHEN 'Principles of Psychology' THEN 'Science'
			WHEN 'The Signal and the Noise' THEN 'Science'
			ELSE 'Other'
		END,
		needs_review = false,
		needs_review_note = NULL,
		updated_at = now()
	FROM public.book_metadata_proposals p
	WHERE p.book_id = b.id
		AND p.deleted_at IS NULL
		AND p.status = 'pending'
		AND b.deleted_at IS NULL
		AND b.needs_review
		AND p.fields->'genre'->>'proposed' = 'General'
	RETURNING b.id
)
UPDATE public.book_metadata_proposals p
SET status = 'accepted', reviewed_at = now(), updated_at = now()
WHERE p.book_id IN (SELECT id FROM gen)
	AND p.deleted_at IS NULL AND p.status = 'pending';
