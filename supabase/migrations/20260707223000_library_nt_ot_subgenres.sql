-- =============================================================================
-- Extend the NT/OT genre taxonomy with canonical-division sub-genres
-- (decision 070 follow-up, 2026-07-07): 'Acts and Paul' joins the existing
-- 'Gospels and Jesus' / 'General Epistles' NT sub-genres; Old Testament gets
-- matching granularity with 'Pentateuch', 'Old Testament Historical Books',
-- 'Psalms and Wisdom Literature', 'Prophets'.
--
-- No data backfill: these are net-new categories, no live book currently
-- needs one (mirrors GENRES in src/lib/types/library.ts).
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
