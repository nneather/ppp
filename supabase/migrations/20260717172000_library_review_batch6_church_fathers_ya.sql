-- Batch 6 + taxonomy: Church Fathers (merge Ancient Sources), Children's and Young Adult.

-- 1) Open CHECK with new labels (keep old temporarily).
ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_genre_check;

ALTER TABLE public.books
	ADD CONSTRAINT books_genre_check CHECK (
		genre IS NULL
			OR genre IN (
				'Acts and Paul',
				'Ancient Biblical Sources',
				'Ancient Sources',
				'Apologetics',
				'Apostolic Fathers',
				'Applied Theology',
				'Bibles',
				'Biblical Reference',
				'Biblical Theology',
				'Biography',
				'Business',
				'Children''s and Young Adult',
				'Chinese Language Tools',
				'Christian Living',
				'Christology',
				'Church Fathers',
				'Church History',
				'Commentary',
				'Culture',
				'Devotional',
				'Drama',
				'Ecclesiology',
				'Ethics',
				'General',
				'General Epistles',
				'German Language Tools',
				'Gospels and Jesus',
				'Greek Language Tools',
				'Hebrew Language Tools',
				'Historical Theology',
				'History',
				'Hobbies',
				'Homiletics',
				'Hymnals and Liturgy',
				'Language',
				'Latin Language Tools',
				'Leadership',
				'Literary Criticism',
				'Literature',
				'Music',
				'New Testament',
				'Old Testament',
				'Old Testament Historical Books',
				'Other',
				'Other Religions',
				'Pastoral Ministry',
				'Pentateuch',
				'Philosophy',
				'Pneumatology',
				'Poetry',
				'Politics and Policy',
				'Prophets',
				'Psalms and Wisdom Literature',
				'Reference',
				'Science',
				'Self-Help',
				'Sports',
				'Systematic Theology',
				'Theology'
			)
	) NOT VALID;

ALTER TABLE public.books VALIDATE CONSTRAINT books_genre_check;

-- 2) Apostolic Fathers + Ancient Sources → Church Fathers
UPDATE public.books
SET genre = 'Church Fathers', updated_at = now()
WHERE deleted_at IS NULL
	AND genre IN ('Apostolic Fathers', 'Ancient Sources');

UPDATE public.book_metadata_proposals
SET
	fields = jsonb_set(fields, '{genre,proposed}', '"Church Fathers"'),
	updated_at = now()
WHERE deleted_at IS NULL
	AND status = 'pending'
	AND fields->'genre'->>'proposed' IN ('Apostolic Fathers', 'Ancient Sources', 'Apostolic Fathers and Ancient Sources');

-- 3) Drop retired labels from CHECK.
ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_genre_check;

ALTER TABLE public.books
	ADD CONSTRAINT books_genre_check CHECK (
		genre IS NULL
			OR genre IN (
				'Acts and Paul',
				'Ancient Biblical Sources',
				'Apologetics',
				'Applied Theology',
				'Bibles',
				'Biblical Reference',
				'Biblical Theology',
				'Biography',
				'Business',
				'Children''s and Young Adult',
				'Chinese Language Tools',
				'Christian Living',
				'Christology',
				'Church Fathers',
				'Church History',
				'Commentary',
				'Culture',
				'Devotional',
				'Drama',
				'Ecclesiology',
				'Ethics',
				'General',
				'General Epistles',
				'German Language Tools',
				'Gospels and Jesus',
				'Greek Language Tools',
				'Hebrew Language Tools',
				'Historical Theology',
				'History',
				'Hobbies',
				'Homiletics',
				'Hymnals and Liturgy',
				'Language',
				'Latin Language Tools',
				'Leadership',
				'Literary Criticism',
				'Literature',
				'Music',
				'New Testament',
				'Old Testament',
				'Old Testament Historical Books',
				'Other',
				'Other Religions',
				'Pastoral Ministry',
				'Pentateuch',
				'Philosophy',
				'Pneumatology',
				'Poetry',
				'Politics and Policy',
				'Prophets',
				'Psalms and Wisdom Literature',
				'Reference',
				'Science',
				'Self-Help',
				'Sports',
				'Systematic Theology',
				'Theology'
			)
	) NOT VALID;

ALTER TABLE public.books VALIDATE CONSTRAINT books_genre_check;

-- 4) Batch 6 residual genre clears.
WITH resolved AS (
	UPDATE public.books b
	SET
		genre = v.genre,
		needs_review = false,
		needs_review_note = NULL,
		updated_at = now()
	FROM (
		VALUES
			('7b68f1a9-1145-4e9c-805c-b3a9bda14453'::uuid, 'History'), -- Zinn
			('19881cae-6898-4083-8e24-b7fcb077a258'::uuid, 'Hobbies'), -- Backyard Ballistics
			('18878ac9-c496-4f7e-bb3e-ce9c56753311'::uuid, 'Science'), -- Being Mortal
			('24cb37d5-91d2-4421-b4eb-a415c88f088d'::uuid, 'History'), -- WWII Day by Day
			('7d237304-e1ab-4e87-b319-9f1978d77076'::uuid, 'Ecclesiology'), -- Congregational Communion
			('12c3d4bc-3361-4a4b-81ab-cc25bdedb372'::uuid, 'Literature'), -- Crime and Punishment
			('17ef6203-9cd9-4eea-a572-4709ef6d7808'::uuid, 'Politics and Policy'), -- Tocqueville
			('2143a416-f4d8-4fcf-a9da-633965884c93'::uuid, 'General Epistles'), -- Hengel Petrus
			('21a9972f-997f-4b44-8612-097cc5768d3b'::uuid, 'Literature'), -- Sebald
			('23caf746-6c38-45e0-99ad-6a9a20a14ec5'::uuid, 'Literary Criticism'), -- Friedrich Lyrik
			('107bf888-f3b6-4e4a-b77b-d6cf13589e88'::uuid, 'Pneumatology'), -- Empowered Evangelicals
			('77c982a5-6990-469e-b309-5b9dd641397f'::uuid, 'Christian Living'), -- Faithful Witness
			('08cc8c60-a27c-4c57-bf16-9e6f4966736a'::uuid, 'Politics and Policy'), -- Just Mercy
			('1d6c48e3-95cc-4b67-a7d3-f5ba57c61bfe'::uuid, 'Biography'), -- Letters & Papers
			('0bb2c16c-b4ad-4285-9270-ab487c873340'::uuid, 'Drama'), -- Mutter Courage
			('32085af8-82b0-402a-b7f1-c8de76165dcb'::uuid, 'Literature'), -- Parzival
			('13cbd958-93c2-4e69-8bba-bcc6650e7763'::uuid, 'Biography'), -- Pilgrim's Regress
			('21f3a56f-0977-4b4c-a7ac-e7daa76f693e'::uuid, 'Poetry'), -- Yeats
			('7a120740-2383-4ca7-a2ac-f4928add3853'::uuid, 'Music'), -- Teaching Music
			('bcc1bf86-88c9-4a01-9705-2e204d1c3b00'::uuid, 'Bibles'), -- The Bible
			('045d91df-22ed-4122-a5a0-dd1e8f47ddc5'::uuid, 'Pneumatology'), -- Final Quest
			('7bb2a339-70be-491c-8df7-c7af81989df0'::uuid, 'Christian Living'), -- Hole in the Gospel
			('660cf33d-f1fb-4e08-84c2-93ecc2bafad2'::uuid, 'Bibles'), -- Jewish Study Bible
			('a703acaa-92d8-4846-87e0-10ae1d5a910f'::uuid, 'Children''s and Young Adult'), -- Long Patrol
			('290057c6-6a45-4e93-bfc2-bb5c9c2b51b3'::uuid, 'Literature'), -- Steinbeck Winter
			('6e2955c9-e49a-4e7a-b22a-f7c75c88b285'::uuid, 'Self-Help'), -- Think for Yourself
			('1eeab344-174a-49d7-84f1-a0565c239bae'::uuid, 'History'), -- Churchill
			('09fe42af-27f9-43dc-99b1-0bd737213106'::uuid, 'Christian Living') -- Showers
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
