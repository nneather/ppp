-- =============================================================================
-- Add 'Drama' for stage plays and play collections (decision 073, 2026-07-08):
-- Shakespeare editions, Greek drama anthologies, *A Raisin in the Sun*, etc.
-- Mirrors the existing Poetry split from Literature (~14 books in scope).
-- =============================================================================

ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_genre_check;

ALTER TABLE public.books
	ADD CONSTRAINT books_genre_check CHECK (
		genre IS NULL
			OR genre IN (
				'Acts and Paul',
				'Apologetics',
				'Apostolic Fathers and Ancient Sources',
				'Applied Theology',
				'Bibles',
				'Biblical Reference',
				'Biblical Theology',
				'Biography',
				'Business',
				'Chinese Language Tools',
				'Christian Living',
				'Church History',
				'Commentary',
				'Culture',
				'Devotional',
				'Drama',
				'Ethics',
				'General',
				'General Epistles',
				'German Language Tools',
				'Gospels and Jesus',
				'Greek Language Tools',
				'Hebrew Language Tools',
				'Historical Theology',
				'History',
				'Homiletics',
				'Hymnals and Liturgy',
				'Language',
				'Latin Language Tools',
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
				'Poetry',
				'Prophets',
				'Psalms and Wisdom Literature',
				'Reference',
				'Science',
				'Sports',
				'Systematic Theology',
				'Theology'
			)
	) NOT VALID;

ALTER TABLE public.books VALIDATE CONSTRAINT books_genre_check;

-- Backfill live Literature rows that are play/drama primary texts.
UPDATE public.books
SET genre = 'Drama'
WHERE deleted_at IS NULL
	AND id IN (
		'a315be6d-2a00-4b3d-9b3e-d8ea1adf6c0f', -- Annotated Shakespeare, The vol I
		'dcfa8cf7-131b-4661-98e3-e4551f37e7c1', -- Annotated Shakespeare, The vol II
		'd89bf8e4-d5f4-44fa-8eb1-3b54333594ae', -- Annotated Shakespeare, The vol III
		'9e842fde-bb11-4bc5-a46e-0c436c0b0bb6', -- Christopher Marlowe Four Plays
		'06e55dc0-4e88-44fa-b8b4-8e8b58081401', -- Continental Drama
		'2ac8780a-62d5-452c-ad62-f780f0b44a93', -- Elizabethan Drama 1
		'f526753a-f823-4b1a-827d-124e95fb107d', -- Elizabethan Drama 2
		'53b40ec7-13d9-4507-bc66-82aa23afecc5', -- Faust Egmont Etc. Doctor Faustus Goethe Marlowe
		'ac37d2e1-bee7-46a1-9fad-0095efcd81ac', -- Modern English Drama
		'39fde4c4-e7c8-402d-a234-fb25ee42cdd4', -- Nine Greek Dramas
		'cd71c8d2-67d7-410c-86b6-55f8278cafdf'  -- The Reichard Collection of Early Pennsylvania German Plays
	);

-- Pending Research proposals: Literature → Drama for play texts (exclude leadership
-- books *about* Shakespeare, e.g. The Hollow Crown).
UPDATE public.book_metadata_proposals
SET fields = jsonb_set(fields, '{genre,proposed}', '"Drama"'::jsonb)
WHERE status = 'pending'
	AND deleted_at IS NULL
	AND fields -> 'genre' ->> 'proposed' = 'Literature'
	AND book_id IN (
		'0ffa7d21-b4f5-4e78-84a9-9ac54cf51c81', -- A Raisin in the Sun
		'72e8a88d-a2d4-489b-8275-684c7959806d', -- Lysistrata and Other Plays
		'cf53a0f5-a363-4da5-9758-c693eb9ef3bf'  -- Three Theban Plays
	);
