-- =============================================================================
-- books.genre — closed vocabulary CHECK (aligned with src/lib/types/library.ts)
--
-- Prior state: genre was unconstrained TEXT (app-only GENRES list).
-- Adds CHECK so imports and ad-hoc SQL cannot drift from the vocabulary.
--
-- Stale-label audit (run before renaming rows in Studio):
--   supabase/scripts/library_genre_stale_candidates.sql
-- =============================================================================

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
				'Pastoral',
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
