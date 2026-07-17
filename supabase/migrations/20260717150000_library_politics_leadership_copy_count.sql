-- =============================================================================
-- Review-queue cleanup Batch 1 (2026-07-17):
-- - Add genres: Leadership, Politics and Policy
-- - Add books.copy_count (multi-copy ownership without duplicate rows)
-- - Apply owner-resolved metadata clears from the residual review set
-- =============================================================================

ALTER TABLE public.books
	ADD COLUMN IF NOT EXISTS copy_count integer NOT NULL DEFAULT 1;

ALTER TABLE public.books
	DROP CONSTRAINT IF EXISTS books_copy_count_check;

ALTER TABLE public.books
	ADD CONSTRAINT books_copy_count_check CHECK (copy_count >= 1 AND copy_count <= 99);

COMMENT ON COLUMN public.books.copy_count IS
	'Physical copies owned of this edition. Default 1; use instead of duplicate book rows for identical prints.';

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
				'Christology',
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

-- ---------------------------------------------------------------------------
-- Batch 1 data: work_type + clear stale "Missing: author" (editors present)
-- ---------------------------------------------------------------------------

UPDATE public.books
SET
	work_type = 'edited_volume',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id IN (
	'f0f413e1-be3b-42e7-8235-bbaee76d5df4', -- 1-2 Corinthians (Bray ACCS)
	'09696579-b466-4440-bcac-8fb0b757d85c', -- Dictionary of Jesus and the Gospels
	'c1d69b7a-4b80-41ae-afc4-cb500c567096', -- Dictionary of Paul and His Letters
	'241b0487-5b2e-4129-832e-47423f1d53e7', -- Dictionary of the OT Historical Books
	'2d7c0db2-fa01-44f3-bf72-b3abc5d069f7', -- Dictionary of the OT Wisdom, Poetry & Writings
	'bf3f62bb-3643-4a13-945c-d52c40cf0957', -- The New Bible Commentary
	'5c3ef86c-d2e2-47c3-882c-b6b195725415'  -- Oxford Dictionary of the Christian Church
)
AND deleted_at IS NULL;

UPDATE public.books
SET
	work_type = 'reference_work',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id IN (
	'e648af29-a761-4974-9ea2-719b7d45c0f7', -- Biblia Sacra Vulgata
	'9c97adae-44bb-4af6-8ec5-4ad8f3f2f197'  -- A Reader's Hebrew and Greek Bible
)
AND deleted_at IS NULL;

-- City of God: author present; genre already set
UPDATE public.books
SET
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '5d3b582f-8cf4-4450-b8f2-9f8846d7a600'
	AND deleted_at IS NULL;

-- Leviticus Sklar: keep, clear duplicate note
UPDATE public.books
SET
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '5efabe52-5fb9-40fb-8d65-3e5dc75ae5e2'
	AND deleted_at IS NULL;

-- Soft-delete junk null-title Stott row
UPDATE public.books
SET
	deleted_at = now(),
	updated_at = now()
WHERE id = 'db14f95c-5e25-43f9-871a-3cdf94d79319'
	AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Genre + metadata resolutions (owner Batch 1 answers)
-- ---------------------------------------------------------------------------

-- Weinschenk → Business; fix year/ISBN toward 2nd ed.
UPDATE public.books
SET
	genre = 'Business',
	title = '100 Things Every Designer Needs to Know About People',
	year = 2020,
	isbn = '9780136746911',
	publisher = 'New Riders',
	edition = '2nd ed.',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '332d3cdf-d0eb-42e3-868b-350a2ce4487f'
	AND deleted_at IS NULL;

-- Friedman → Politics and Policy
UPDATE public.books
SET
	genre = 'Politics and Policy',
	publisher = 'University of Chicago Press',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '7b865cfc-5afe-4fbf-87d6-cc0f090f1807'
	AND deleted_at IS NULL;

-- Clausewitz → Politics and Policy
UPDATE public.books
SET
	genre = 'Politics and Policy',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '7bf33b69-f1d8-458b-b4c6-6ea1140f4482'
	AND deleted_at IS NULL;

-- Declaration / Constitution → Politics and Policy
UPDATE public.books
SET
	genre = 'Politics and Policy',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = 'a4c84240-a8f1-4e83-9ae8-b696ea01bd7b'
	AND deleted_at IS NULL;

-- George Will → Culture
UPDATE public.books
SET
	genre = 'Culture',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '7d553cbc-9c4f-443f-8d95-045d56bd2c4f'
	AND deleted_at IS NULL;

-- Baxter → Devotional
UPDATE public.books
SET
	genre = 'Devotional',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '7dcd9cfd-43b7-4c56-b15f-654ef53e76a4'
	AND deleted_at IS NULL;

-- Willard → Christian Living
UPDATE public.books
SET
	genre = 'Christian Living',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '570ca264-4297-4278-b5ca-fa0d5712be00'
	AND deleted_at IS NULL;

-- Jobes/Silva Septuagint → Biblical Reference, 2nd ed.
UPDATE public.books
SET
	genre = 'Biblical Reference',
	isbn = '9780801036491',
	year = 2015,
	publisher = 'Baker Academic',
	edition = '2nd ed.',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '7e5680b7-5984-4ebe-a20a-1c27cecc1bce'
	AND deleted_at IS NULL;

-- Heifetz → Leadership
UPDATE public.books
SET
	genre = 'Leadership',
	isbn = '9781633692831',
	year = 2017,
	publisher = 'Harvard Business Review Press',
	edition = 'With a new preface',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '8957c738-5537-4a46-92d0-121829f57fe0'
	AND deleted_at IS NULL;

-- Place Matters → Pastoral Ministry; fix ISBN/year/publisher
UPDATE public.books
SET
	genre = 'Pastoral Ministry',
	isbn = '9781619582620',
	year = 2017,
	publisher = 'CLC Publications',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '794683cb-62e7-46d5-9764-e3252cffd7ac'
	AND deleted_at IS NULL;

-- Two Kingdoms → Church History; fix ISBN/year/publisher; add Yamauchi if missing later
UPDATE public.books
SET
	genre = 'Church History',
	isbn = '9780802485908',
	year = 1993,
	publisher = 'Moody Press',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = 'edb9fcbe-7ecb-4d6c-8438-87479693f506'
	AND deleted_at IS NULL;

-- Somehow I Manage → Other
UPDATE public.books
SET
	genre = 'Other',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = 'f72c1a98-4f4e-4b89-83e9-5b813c02ff1e'
	AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 7 Habits: merge duplicate rows → one edition with copy_count = 2
-- Both listed ISBNs were wrong for the same print; clear ISBN for shelf verify.
-- ---------------------------------------------------------------------------

UPDATE public.books
SET
	genre = 'Self-Help',
	publisher = 'Simon & Schuster',
	isbn = NULL,
	copy_count = 2,
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '6000cd3f-7f55-4ac8-9700-e709df02f1c2'
	AND deleted_at IS NULL;

UPDATE public.book_metadata_proposals
SET
	status = 'accepted',
	reviewed_at = now(),
	updated_at = now()
WHERE id = 'a7f93199-6e8e-4e22-a56c-8b4f55dfcc2d'
	AND deleted_at IS NULL
	AND status = 'pending';

UPDATE public.books
SET
	deleted_at = now(),
	updated_at = now()
WHERE id = '8031d7a8-5981-41a4-8ebe-063fd4633597'
	AND deleted_at IS NULL;
