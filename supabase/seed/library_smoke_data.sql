-- =============================================================================
-- Library smoke-test data
-- Filed: 2026-04-25 (Session 1.5 follow-up — Track C)
--
-- 5 realistic books with full junctions, for owner-side smoke testing of the
-- list / detail / form-sheet flow. Each book exercises a different combination
-- of fields (multi-author, edited volume, reprint metadata, series + volume,
-- multi-category, etc.) so the BookFormSheet edit path is exercised end-to-end.
--
-- HOW TO APPLY (manual):
--   psql "$(supabase status --output env | grep DB_URL | cut -d= -f2)" \
--     -f supabase/seed/library_smoke_data.sql
--   OR paste into Studio SQL editor.
--
--   Idempotent. Re-running is safe — book inserts dedup on title + first
--   author last_name; people dedup on (first_name, last_name); junctions use
--   ON CONFLICT DO NOTHING.
--
-- DEPENDENCIES:
--   - 00000000000000_baseline.sql applied
--   - 20260425160000_library_delta_v1.sql applied  (uses needs_review_note,
--     people.middle_name, etc.)
--   - supabase/seed/library_seed.sql applied  (categories + series)
--
-- After applying, /library should show 5 books and /library/books/<id> should
-- render full detail with authors + categories + series for each.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- People (dedup on first_name + last_name)
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name)
SELECT v.first_name, v.middle_name, v.last_name
FROM (VALUES
	('Richard', NULL,         'Bauckham'),
	('N.',      'T.',         'Wright'),
	('Brevard', 'S.',         'Childs'),
	('Daniel',  'B.',         'Wallace'),
	('John',    NULL,         'Calvin'),
	('Ford',    'Lewis',      'Battles'),
	('John',    'T.',         'McNeill')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- Book 1: Bauckham, Jesus and the Eyewitnesses
-- ---------------------------------------------------------------------------
WITH cat_primary AS (SELECT id FROM public.categories WHERE slug = 'theology'),
	 cat_extra   AS (SELECT id FROM public.categories WHERE slug = 'biblical-studies'),
	 author      AS (SELECT id FROM public.people WHERE last_name = 'Bauckham' AND first_name = 'Richard'),
	 ins         AS (
		INSERT INTO public.books (
			title, subtitle, publisher, publisher_location, year,
			primary_category_id, genre, language, isbn,
			reading_status, needs_review
		)
		SELECT
			'Jesus and the Eyewitnesses',
			'The Gospels as Eyewitness Testimony',
			'Eerdmans', 'Grand Rapids', 2006,
			(SELECT id FROM cat_primary),
			'Theology', 'english',
			'9780802831620',
			'read', false
		WHERE NOT EXISTS (
			SELECT 1 FROM public.books b
			WHERE b.title = 'Jesus and the Eyewitnesses' AND b.deleted_at IS NULL
		)
		RETURNING id
	 )
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT ins.id, author.id, 'author', 0 FROM ins, author
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'Jesus and the Eyewitnesses' AND b.deleted_at IS NULL
	AND c.slug IN ('theology', 'biblical-studies')
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 2: Wright, The Resurrection of the Son of God
--   Multi-volume work without a seeded series; demonstrates volume_number on
--   a book that doesn't have series_id populated.
-- ---------------------------------------------------------------------------
WITH ins AS (
	INSERT INTO public.books (
		title, subtitle, publisher, publisher_location, year,
		volume_number, total_volumes,
		primary_category_id, genre, language, isbn,
		reading_status, needs_review, needs_review_note
	)
	SELECT
		'The Resurrection of the Son of God',
		NULL,
		'Fortress', 'Minneapolis', 2003,
		'III', 5,
		(SELECT id FROM public.categories WHERE slug = 'theology'),
		'Theology', 'english',
		'9780800626792',
		'in_progress', true,
		'Series (Christian Origins and the Question of God) not yet in series seed; revisit when COQG is added.'
	WHERE NOT EXISTS (
		SELECT 1 FROM public.books b
		WHERE b.title = 'The Resurrection of the Son of God' AND b.deleted_at IS NULL
	)
	RETURNING id
)
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT ins.id, p.id, 'author', 0
FROM ins, public.people p
WHERE p.last_name = 'Wright' AND p.first_name = 'N.'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'The Resurrection of the Son of God' AND b.deleted_at IS NULL
	AND c.slug = 'theology'
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 3: Childs, The Book of Exodus
--   Commentary in OTL series; primary = Biblical Studies, secondary = Commentary
--   wait — Commentary is a genre, not a category. Primary cat = Biblical Studies.
-- ---------------------------------------------------------------------------
WITH ins AS (
	INSERT INTO public.books (
		title, subtitle, publisher, publisher_location, year,
		series_id,
		primary_category_id, genre, language, isbn,
		reading_status, needs_review
	)
	SELECT
		'The Book of Exodus',
		'A Critical, Theological Commentary',
		'Westminster John Knox', 'Louisville', 1974,
		(SELECT id FROM public.series WHERE abbreviation = 'OTL'),
		(SELECT id FROM public.categories WHERE slug = 'biblical-studies'),
		'Commentary', 'english',
		'9780664229689',
		'reference', false
	WHERE NOT EXISTS (
		SELECT 1 FROM public.books b
		WHERE b.title = 'The Book of Exodus' AND b.deleted_at IS NULL
	)
	RETURNING id
)
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT ins.id, p.id, 'author', 0
FROM ins, public.people p
WHERE p.last_name = 'Childs' AND p.first_name = 'Brevard'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'The Book of Exodus' AND b.deleted_at IS NULL
	AND c.slug = 'biblical-studies'
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 4: Wallace, Greek Grammar Beyond the Basics
--   Greek Language Tools; primary = Languages & Reference.
-- ---------------------------------------------------------------------------
WITH ins AS (
	INSERT INTO public.books (
		title, subtitle, publisher, publisher_location, year,
		primary_category_id, genre, language, isbn, page_count,
		reading_status, needs_review
	)
	SELECT
		'Greek Grammar Beyond the Basics',
		'An Exegetical Syntax of the New Testament',
		'Zondervan', 'Grand Rapids', 1996,
		(SELECT id FROM public.categories WHERE slug = 'languages-reference'),
		'Greek Language Tools', 'english',
		'9780310218951', 832,
		'reference', false
	WHERE NOT EXISTS (
		SELECT 1 FROM public.books b
		WHERE b.title = 'Greek Grammar Beyond the Basics' AND b.deleted_at IS NULL
	)
	RETURNING id
)
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT ins.id, p.id, 'author', 0
FROM ins, public.people p
WHERE p.last_name = 'Wallace' AND p.first_name = 'Daniel'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'Greek Grammar Beyond the Basics' AND b.deleted_at IS NULL
	AND c.slug = 'languages-reference'
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 5: Calvin, Institutes of the Christian Religion
--   Reprint with editor + translator (exercises three book_authors roles).
-- ---------------------------------------------------------------------------
WITH ins AS (
	INSERT INTO public.books (
		title, subtitle, publisher, publisher_location, year, edition,
		original_year, reprint_publisher, reprint_location, reprint_year,
		total_volumes,
		primary_category_id, genre, language, isbn,
		reading_status, needs_review
	)
	SELECT
		'Institutes of the Christian Religion',
		NULL,
		'Westminster John Knox', 'Louisville', 1960, 'Library of Christian Classics',
		1559, 'Westminster John Knox', 'Louisville', 1960,
		2,
		(SELECT id FROM public.categories WHERE slug = 'theology'),
		'Theology', 'english',
		'9780664220280',
		'reference', false
	WHERE NOT EXISTS (
		SELECT 1 FROM public.books b
		WHERE b.title = 'Institutes of the Christian Religion' AND b.deleted_at IS NULL
	)
	RETURNING id
)
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT ins.id, r.person_id, r.role, r.sort_order
FROM ins
CROSS JOIN (VALUES
	((SELECT id FROM public.people WHERE last_name = 'Calvin'  AND first_name = 'John'), 'author'::TEXT,     0),
	((SELECT id FROM public.people WHERE last_name = 'McNeill' AND first_name = 'John'), 'editor'::TEXT,     0),
	((SELECT id FROM public.people WHERE last_name = 'Battles' AND first_name = 'Ford'), 'translator'::TEXT, 0)
) AS r(person_id, role, sort_order)
WHERE r.person_id IS NOT NULL
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'Institutes of the Christian Religion' AND b.deleted_at IS NULL
	AND c.slug IN ('theology', 'church-history')
ON CONFLICT (book_id, category_id) DO NOTHING;

-- =============================================================================
-- End of smoke data
-- Verify with:
--   SELECT title, genre, reading_status, needs_review FROM books WHERE deleted_at IS NULL ORDER BY title;
--   SELECT b.title, p.last_name, ba.role, ba.sort_order
--     FROM book_authors ba
--     JOIN books b ON b.id = ba.book_id
--     JOIN people p ON p.id = ba.person_id
--     ORDER BY b.title, ba.sort_order;
-- =============================================================================
