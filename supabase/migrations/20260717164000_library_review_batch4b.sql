-- Batch 4b: owner-resolved genre boundaries from Batch 4 Qs.

WITH resolved AS (
	UPDATE public.books b
	SET
		genre = v.genre,
		needs_review = false,
		needs_review_note = NULL,
		updated_at = now()
	FROM (
		VALUES
			-- 1 Screwtape → Literature
			('1a111969-c2a1-4317-80d5-bf213524a394'::uuid, 'Literature'),
			-- 2 Bonhoeffer → Christian Living
			('f06ea498-faff-4ff9-b316-a46e15f1a0ff'::uuid, 'Christian Living'),
			('1a886166-c957-4640-93c2-d03de79bc661'::uuid, 'Christian Living'),
			('94a952ff-50a1-4f93-afc1-e852a66efb11'::uuid, 'Christian Living'),
			-- 3 Leading with a Limp → Leadership
			('fdb6cb28-0134-4d93-9a6a-6db65f678004'::uuid, 'Leadership'),
			-- 4 Gentle and Lowly → Christian Living
			('81de3be7-db83-496a-9f72-558dbc596df5'::uuid, 'Christian Living'),
			-- 5–9 Ecclesiology / Culture
			('be0aeb4e-ae9b-4bc4-be39-70503bb1a720'::uuid, 'Ecclesiology'), -- BCO
			('d518d527-416d-4913-ad69-12d4c6af9567'::uuid, 'Ecclesiology'), -- One Holy…
			('2b91fad3-860a-4278-903a-9b583cb4bd15'::uuid, 'Culture'), -- Old Church Book
			('2c1c3a13-f095-4436-ab59-134e7118c901'::uuid, 'Ecclesiology'), -- On Being Presbyterian
			('83c3abbf-3265-49b5-b2a7-deb020ce23bf'::uuid, 'Ecclesiology'), -- Church of Christ (Ferguson)
			-- 10 Culture → Politics and Policy
			('5f8ca6ba-bf75-4c5a-81ab-e2b7697316b8'::uuid, 'Politics and Policy'), -- Discrimination and Disparities
			('690740e8-579c-49af-a09d-af27dac552a8'::uuid, 'Politics and Policy'), -- New Jim Crow
			('c182dbee-c3d9-4cbf-9e80-ce275c1e64de'::uuid, 'Politics and Policy'), -- Tatum
			('5ef4cee6-935a-4bf8-9211-655e18082c8a'::uuid, 'Politics and Policy'), -- Divided We Fall
			('ce1c7c3a-d936-4366-b0d6-102bd48af41a'::uuid, 'Politics and Policy'), -- Naked Public Square
			('21130550-13b4-4633-8795-fd1e0c2c90b3'::uuid, 'Politics and Policy'), -- City of Man
			('cbe13715-345a-4c39-9a5d-e22f159ae4a8'::uuid, 'Politics and Policy'), -- Religion of American Greatness
			-- 11 Philosophy → Politics (except Plato Republic)
			('8911a777-5bf2-4420-85ff-c0c0ca30ee1c'::uuid, 'Politics and Policy'), -- On Liberty
			('442d0c24-23e2-4152-b094-8ae7277665aa'::uuid, 'Politics and Policy'), -- The Law
			('24539cc8-3aa7-4638-a629-e2492421313c'::uuid, 'Politics and Policy'), -- Limits of State Action
			('fa36aa22-4f3c-44da-99dc-1d02b6ef17e6'::uuid, 'Politics and Policy'), -- Two Treatises
			('9bd85321-c646-4b4b-a25c-2b44d747aa9d'::uuid, 'Politics and Policy'), -- Prince
			('90003850-253d-4e18-b985-598d1a4496aa'::uuid, 'Politics and Policy'), -- Voegelin New Science
			('9a2828fe-8f3e-4ff2-9963-073b2eedec55'::uuid, 'Philosophy'), -- Plato Republic
			-- 12 Poetik → Philosophy
			('58557643-0d3c-45b6-9422-b1a2fbdae801'::uuid, 'Philosophy'),
			-- 13 Brooks → Self-Help
			('5980b0ec-4c8b-42e7-ac91-e487fbf4ec90'::uuid, 'Self-Help'),
			-- 14 Niebuhr Purpose → Ecclesiology
			('15e4e6e0-cf8e-4ecc-abbc-ecaebc9fcf80'::uuid, 'Ecclesiology')
	) AS v(id, genre)
	WHERE b.id = v.id
		AND b.deleted_at IS NULL
	RETURNING b.id
)
UPDATE public.book_metadata_proposals p
SET status = 'accepted', reviewed_at = now(), updated_at = now()
WHERE p.book_id IN (SELECT id FROM resolved)
	AND p.deleted_at IS NULL
	AND p.status = 'pending';
