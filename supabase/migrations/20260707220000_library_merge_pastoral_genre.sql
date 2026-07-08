-- =============================================================================
-- Merge the legacy 'Pastoral' genre into 'Pastoral Ministry'.
--
-- 'Pastoral' was a legacy import-era short-code label (decision 018) kept in
-- the closed vocabulary pending an owner decision. The 2026-07-07 taxonomy
-- audit (decision 069) confirmed every sampled 'Pastoral' book is the same
-- subject matter as 'Pastoral Ministry' — this migration closes that out.
--
-- Order matters: backfill data under the OLD constraint (which already
-- allows 'Pastoral Ministry') before tightening the CHECK to drop 'Pastoral'.
-- =============================================================================

-- 1. Backfill live book rows.
UPDATE public.books
SET genre = 'Pastoral Ministry'
WHERE deleted_at IS NULL
	AND genre = 'Pastoral';

-- 2. Backfill any pending AI research proposals suggesting 'Pastoral' so the
--    Research deck never surfaces a value the CHECK constraint will reject.
UPDATE public.book_metadata_proposals
SET fields = jsonb_set(fields, '{genre,proposed}', '"Pastoral Ministry"'::jsonb)
WHERE status = 'pending'
	AND fields -> 'genre' ->> 'proposed' = 'Pastoral';

-- 3. Tighten books_genre_check — drop 'Pastoral' (mirrors GENRES in
--    src/lib/types/library.ts).
ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_genre_check;

ALTER TABLE public.books
	ADD CONSTRAINT books_genre_check CHECK (
		genre IS NULL
			OR genre IN (
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
				'Other',
				'Other Religions',
				'Pastoral Ministry',
				'Philosophy',
				'Poetry',
				'Reference',
				'Science',
				'Sports',
				'Systematic Theology',
				'Theology'
			)
	) NOT VALID;

ALTER TABLE public.books VALIDATE CONSTRAINT books_genre_check;
