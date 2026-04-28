-- =============================================================================
-- Library smoke-test data
-- Filed: 2026-04-25 (Session 1.5)
-- Updated: 2026-04-28 (Session 1.5b — re-runnable junctions + 10 more books)
--
-- 15 realistic books with full junctions, for owner-side smoke testing of the
-- list / detail / form-sheet flow. Each book exercises a different combination
-- of fields (multi-author, edited volume, reprint metadata, series + volume,
-- multi-category, etc.) so the BookFormSheet edit path is exercised end-to-end.
--
-- HOW TO APPLY (manual):
--   psql "$(supabase status --output env | grep DB_URL | cut -d= -f2)" \
--     -f supabase/seed/library_smoke_data.sql
--   OR paste into Studio SQL editor.
--
--   Idempotent + RE-RUNNABLE.
--   - Book INSERTs dedup by title via WHERE NOT EXISTS.
--   - Author / category junction INSERTs look the book up by title each run
--     (instead of relying on a same-statement RETURNING), so re-running the
--     file silently re-attaches any missing junctions on existing books.
--   - People dedup on (first_name, last_name); junctions use ON CONFLICT
--     against their composite primary keys.
--
-- DEPENDENCIES:
--   - 00000000000000_baseline.sql applied
--   - 20260425160000_library_delta_v1.sql applied  (uses needs_review_note,
--     people.middle_name, etc.)
--   - supabase/seed/library_seed.sql applied  (categories + series)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- People (dedup on first_name + last_name)
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name)
SELECT v.first_name, v.middle_name, v.last_name
FROM (VALUES
	-- Original 7
	('Richard', NULL,         'Bauckham'),
	('N.',      'T.',         'Wright'),
	('Brevard', 'S.',         'Childs'),
	('Daniel',  'B.',         'Wallace'),
	('John',    NULL,         'Calvin'),
	('Ford',    'Lewis',      'Battles'),
	('John',    'T.',         'McNeill'),
	-- 6 new for the expansion
	('D.',      'A.',         'Carson'),
	('Thomas',  'R.',         'Schreiner'),
	('Darrell', 'L.',         'Bock'),
	('Douglas', 'J.',         'Moo'),
	('Larry',   'W.',         'Hurtado'),
	('Gregory', 'K.',         'Beale')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- Book 1: Bauckham, Jesus and the Eyewitnesses
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_location, year,
	primary_category_id, genre, language, isbn,
	reading_status, needs_review
)
SELECT
	'Jesus and the Eyewitnesses',
	'The Gospels as Eyewitness Testimony',
	'Eerdmans', 'Grand Rapids', 2006,
	(SELECT id FROM public.categories WHERE slug = 'theology'),
	'Theology', 'english',
	'9780802831620',
	'read', false
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.title = 'Jesus and the Eyewitnesses' AND b.deleted_at IS NULL
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.books b, public.people p
WHERE b.title = 'Jesus and the Eyewitnesses' AND b.deleted_at IS NULL
	AND p.last_name = 'Bauckham' AND COALESCE(p.first_name, '') = 'Richard'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'Jesus and the Eyewitnesses' AND b.deleted_at IS NULL
	AND c.slug IN ('theology', 'biblical-studies')
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 2: Wright, The Resurrection of the Son of God (COQG vol III)
-- ---------------------------------------------------------------------------
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
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.books b, public.people p
WHERE b.title = 'The Resurrection of the Son of God' AND b.deleted_at IS NULL
	AND p.last_name = 'Wright' AND COALESCE(p.first_name, '') = 'N.'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'The Resurrection of the Son of God' AND b.deleted_at IS NULL
	AND c.slug = 'theology'
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 3: Childs, The Book of Exodus (OTL series)
-- ---------------------------------------------------------------------------
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
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.books b, public.people p
WHERE b.title = 'The Book of Exodus' AND b.deleted_at IS NULL
	AND p.last_name = 'Childs' AND COALESCE(p.first_name, '') = 'Brevard'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'The Book of Exodus' AND b.deleted_at IS NULL
	AND c.slug = 'biblical-studies'
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 4: Wallace, Greek Grammar Beyond the Basics
-- ---------------------------------------------------------------------------
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
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.books b, public.people p
WHERE b.title = 'Greek Grammar Beyond the Basics' AND b.deleted_at IS NULL
	AND p.last_name = 'Wallace' AND COALESCE(p.first_name, '') = 'Daniel'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'Greek Grammar Beyond the Basics' AND b.deleted_at IS NULL
	AND c.slug = 'languages-reference'
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 5: Calvin, Institutes (with editor + translator)
-- ---------------------------------------------------------------------------
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
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.books b, public.people p
WHERE b.title = 'Institutes of the Christian Religion' AND b.deleted_at IS NULL
	AND p.last_name = 'Calvin' AND COALESCE(p.first_name, '') = 'John'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'editor', 0
FROM public.books b, public.people p
WHERE b.title = 'Institutes of the Christian Religion' AND b.deleted_at IS NULL
	AND p.last_name = 'McNeill' AND COALESCE(p.first_name, '') = 'John'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'translator', 0
FROM public.books b, public.people p
WHERE b.title = 'Institutes of the Christian Religion' AND b.deleted_at IS NULL
	AND p.last_name = 'Battles' AND COALESCE(p.first_name, '') = 'Ford'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'Institutes of the Christian Religion' AND b.deleted_at IS NULL
	AND c.slug IN ('theology', 'church-history')
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 6: Carson, The Gospel According to John (PNTC, not in seed)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_location, year,
	primary_category_id, genre, language, isbn, page_count,
	reading_status, needs_review
)
SELECT
	'The Gospel According to John',
	NULL,
	'Eerdmans', 'Grand Rapids', 1991,
	(SELECT id FROM public.categories WHERE slug = 'biblical-studies'),
	'Commentary', 'english',
	'9780802836830', 715,
	'reference', false
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.title = 'The Gospel According to John' AND b.deleted_at IS NULL
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.books b, public.people p
WHERE b.title = 'The Gospel According to John' AND b.deleted_at IS NULL
	AND p.last_name = 'Carson' AND COALESCE(p.first_name, '') = 'D.'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'The Gospel According to John' AND b.deleted_at IS NULL
	AND c.slug = 'biblical-studies'
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 7: Schreiner, Romans (BECNT, not in seed; 2nd ed)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_location, year, edition,
	primary_category_id, genre, language, isbn, page_count,
	reading_status, needs_review
)
SELECT
	'Romans',
	NULL,
	'Baker Academic', 'Grand Rapids', 2018, '2nd',
	(SELECT id FROM public.categories WHERE slug = 'biblical-studies'),
	'Commentary', 'english',
	'9780801097447', 928,
	'reference', false
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.title = 'Romans' AND b.deleted_at IS NULL
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.books b, public.people p
WHERE b.title = 'Romans' AND b.deleted_at IS NULL
	AND p.last_name = 'Schreiner' AND COALESCE(p.first_name, '') = 'Thomas'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'Romans' AND b.deleted_at IS NULL
	AND c.slug = 'biblical-studies'
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 8: Bock, Luke 1:1–9:50 (BECNT vol 1)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_location, year,
	volume_number, total_volumes,
	primary_category_id, genre, language, isbn, page_count,
	reading_status, needs_review
)
SELECT
	'Luke 1:1–9:50',
	NULL,
	'Baker Academic', 'Grand Rapids', 1994,
	'1', 2,
	(SELECT id FROM public.categories WHERE slug = 'biblical-studies'),
	'Commentary', 'english',
	'9780801010538', 960,
	'reference', false
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.title = 'Luke 1:1–9:50' AND b.deleted_at IS NULL
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.books b, public.people p
WHERE b.title = 'Luke 1:1–9:50' AND b.deleted_at IS NULL
	AND p.last_name = 'Bock' AND COALESCE(p.first_name, '') = 'Darrell'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'Luke 1:1–9:50' AND b.deleted_at IS NULL
	AND c.slug = 'biblical-studies'
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 9: Bock, Luke 9:51–24:53 (BECNT vol 2)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_location, year,
	volume_number, total_volumes,
	primary_category_id, genre, language, isbn, page_count,
	reading_status, needs_review
)
SELECT
	'Luke 9:51–24:53',
	NULL,
	'Baker Academic', 'Grand Rapids', 1996,
	'2', 2,
	(SELECT id FROM public.categories WHERE slug = 'biblical-studies'),
	'Commentary', 'english',
	'9780801010545', 1106,
	'reference', false
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.title = 'Luke 9:51–24:53' AND b.deleted_at IS NULL
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.books b, public.people p
WHERE b.title = 'Luke 9:51–24:53' AND b.deleted_at IS NULL
	AND p.last_name = 'Bock' AND COALESCE(p.first_name, '') = 'Darrell'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'Luke 9:51–24:53' AND b.deleted_at IS NULL
	AND c.slug = 'biblical-studies'
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 10: Carson + Moo, An Introduction to the New Testament (multi-author, 2nd ed)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_location, year, edition,
	primary_category_id, genre, language, isbn, page_count,
	reading_status, needs_review
)
SELECT
	'An Introduction to the New Testament',
	NULL,
	'Zondervan', 'Grand Rapids', 2005, '2nd',
	(SELECT id FROM public.categories WHERE slug = 'biblical-studies'),
	'Biblical Reference', 'english',
	'9780310238591', 781,
	'read', false
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.title = 'An Introduction to the New Testament' AND b.deleted_at IS NULL
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.books b, public.people p
WHERE b.title = 'An Introduction to the New Testament' AND b.deleted_at IS NULL
	AND p.last_name = 'Carson' AND COALESCE(p.first_name, '') = 'D.'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 1
FROM public.books b, public.people p
WHERE b.title = 'An Introduction to the New Testament' AND b.deleted_at IS NULL
	AND p.last_name = 'Moo' AND COALESCE(p.first_name, '') = 'Douglas'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'An Introduction to the New Testament' AND b.deleted_at IS NULL
	AND c.slug = 'biblical-studies'
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 11: Childs, Biblical Theology of the Old and New Testaments
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_location, year,
	primary_category_id, genre, language, isbn, page_count,
	reading_status, needs_review
)
SELECT
	'Biblical Theology of the Old and New Testaments',
	'Theological Reflection on the Christian Bible',
	'Fortress', 'Minneapolis', 1992,
	(SELECT id FROM public.categories WHERE slug = 'theology'),
	'Theology', 'english',
	'9780800627218', 745,
	'in_progress', false
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.title = 'Biblical Theology of the Old and New Testaments' AND b.deleted_at IS NULL
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.books b, public.people p
WHERE b.title = 'Biblical Theology of the Old and New Testaments' AND b.deleted_at IS NULL
	AND p.last_name = 'Childs' AND COALESCE(p.first_name, '') = 'Brevard'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'Biblical Theology of the Old and New Testaments' AND b.deleted_at IS NULL
	AND c.slug IN ('theology', 'biblical-studies')
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 12: Hurtado, Lord Jesus Christ
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_location, year,
	primary_category_id, genre, language, isbn, page_count,
	reading_status, needs_review
)
SELECT
	'Lord Jesus Christ',
	'Devotion to Jesus in Earliest Christianity',
	'Eerdmans', 'Grand Rapids', 2003,
	(SELECT id FROM public.categories WHERE slug = 'theology'),
	'Theology', 'english',
	'9780802831675', 746,
	'unread', false
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.title = 'Lord Jesus Christ' AND b.deleted_at IS NULL
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.books b, public.people p
WHERE b.title = 'Lord Jesus Christ' AND b.deleted_at IS NULL
	AND p.last_name = 'Hurtado' AND COALESCE(p.first_name, '') = 'Larry'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'Lord Jesus Christ' AND b.deleted_at IS NULL
	AND c.slug = 'theology'
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 13: Wright, The New Testament and the People of God (COQG vol I)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_location, year,
	volume_number, total_volumes,
	primary_category_id, genre, language, isbn, page_count,
	reading_status, needs_review
)
SELECT
	'The New Testament and the People of God',
	NULL,
	'Fortress', 'Minneapolis', 1992,
	'I', 5,
	(SELECT id FROM public.categories WHERE slug = 'theology'),
	'Theology', 'english',
	'9780800626815', 535,
	'read', false
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.title = 'The New Testament and the People of God' AND b.deleted_at IS NULL
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.books b, public.people p
WHERE b.title = 'The New Testament and the People of God' AND b.deleted_at IS NULL
	AND p.last_name = 'Wright' AND COALESCE(p.first_name, '') = 'N.'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'The New Testament and the People of God' AND b.deleted_at IS NULL
	AND c.slug = 'theology'
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 14: Wright, Jesus and the Victory of God (COQG vol II)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_location, year,
	volume_number, total_volumes,
	primary_category_id, genre, language, isbn, page_count,
	reading_status, needs_review
)
SELECT
	'Jesus and the Victory of God',
	NULL,
	'Fortress', 'Minneapolis', 1996,
	'II', 5,
	(SELECT id FROM public.categories WHERE slug = 'theology'),
	'Theology', 'english',
	'9780800626822', 741,
	'read', false
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.title = 'Jesus and the Victory of God' AND b.deleted_at IS NULL
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.books b, public.people p
WHERE b.title = 'Jesus and the Victory of God' AND b.deleted_at IS NULL
	AND p.last_name = 'Wright' AND COALESCE(p.first_name, '') = 'N.'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'Jesus and the Victory of God' AND b.deleted_at IS NULL
	AND c.slug = 'theology'
ON CONFLICT (book_id, category_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Book 15: Beale, A New Testament Biblical Theology
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, publisher, publisher_location, year,
	primary_category_id, genre, language, isbn, page_count,
	reading_status, needs_review
)
SELECT
	'A New Testament Biblical Theology',
	'The Unfolding of the Old Testament in the New',
	'Baker Academic', 'Grand Rapids', 2011,
	(SELECT id FROM public.categories WHERE slug = 'theology'),
	'Theology', 'english',
	'9780801026973', 1072,
	'unread', false
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.title = 'A New Testament Biblical Theology' AND b.deleted_at IS NULL
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.books b, public.people p
WHERE b.title = 'A New Testament Biblical Theology' AND b.deleted_at IS NULL
	AND p.last_name = 'Beale' AND COALESCE(p.first_name, '') = 'Gregory'
ON CONFLICT (book_id, person_id, role) DO NOTHING;

INSERT INTO public.book_categories (book_id, category_id)
SELECT b.id, c.id FROM public.books b, public.categories c
WHERE b.title = 'A New Testament Biblical Theology' AND b.deleted_at IS NULL
	AND c.slug IN ('theology', 'biblical-studies')
ON CONFLICT (book_id, category_id) DO NOTHING;

-- =============================================================================
-- End of smoke data
-- Verify with:
--   SELECT title, genre, reading_status, needs_review FROM books WHERE deleted_at IS NULL ORDER BY title;
--   -- expect 15 books
--
--   SELECT b.title, p.last_name, ba.role, ba.sort_order
--     FROM book_authors ba
--     JOIN books b ON b.id = ba.book_id
--     JOIN people p ON p.id = ba.person_id
--     WHERE b.deleted_at IS NULL
--     ORDER BY b.title, ba.sort_order;
--   -- expect ~17 author rows (15 books, +2 extra for Calvin's editor + translator,
--   --                          +1 extra for the Carson+Moo NT Intro second author)
-- =============================================================================
