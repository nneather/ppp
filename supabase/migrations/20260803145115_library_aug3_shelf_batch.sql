-- library_aug3_shelf_batch: August shelf adds (commentaries + pastoral/preaching).
-- Owner-confirmed 2026-08-03. Soft-deletes accidental Loeb Odyssey Vol I.
-- Idempotent by natural keys. Hosted push only. DML-only (no gen-types).

-- ---------------------------------------------------------------------------
-- Soft-delete accidental Loeb Odyssey Vol I (owner has only Vol II)
-- ---------------------------------------------------------------------------
UPDATE public.books
SET deleted_at = now(), updated_at = now()
WHERE id = '7edb1110-4dac-4554-94aa-13a3b3bcf774'
	AND deleted_at IS NULL
	AND title = 'Ὀδύσσεια';

-- ---------------------------------------------------------------------------
-- Series (new): Kidner Classic Commentaries
-- ---------------------------------------------------------------------------
INSERT INTO public.series (name, abbreviation, created_by)
SELECT v.name, v.abbreviation, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Kidner Classic Commentaries', 'KCC')
) AS v(name, abbreviation)
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = v.abbreviation
);

-- ---------------------------------------------------------------------------
-- People (new authors / translators only)
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('John', NULL, 'Pollack'),
	('Charles', NULL, 'Bigg'),
	('Ernest', 'C.', 'Lucas'),
	('Hans', 'Dieter', 'Betz'),
	('Derek', NULL, 'Kidner'),
	('Mark', 'Lau', 'Branson'),
	('Juan', 'F.', 'Martinez'),
	('Richard', NULL, 'Winter'),
	('Sam', NULL, 'Chan'),
	('Malcolm', NULL, 'Gill'),
	('Sidney', NULL, 'Greidanus'),
	('Michael', 'R.', 'Emlet'),
	('David', 'G.', 'Benner')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- Books with series
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_location, year, original_year, isbn,
	volume_number, series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, v.publisher_location, v.year, v.original_year, v.isbn,
	v.volume_number, s.id, v.genre, 'monograph', 'english',
	v.reading_status, false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'Odyssey, Volume II: Books 13–24',
		'Harvard University Press',
		'Cambridge, MA',
		1995,
		1919,
		'9780674995628',
		'105',
		'LCL',
		'Greek Language Tools',
		'reference'
	),
	(
		'The Epistles of St. Peter and St. Jude',
		'T&T Clark',
		'Edinburgh',
		1902,
		NULL::int,
		NULL,
		NULL,
		'ICC',
		'Commentary',
		'reference'
	),
	(
		'The Book of Exodus',
		'Westminster John Knox',
		'Louisville, KY',
		1974,
		NULL,
		'9780664209858',
		NULL,
		'OTL',
		'Commentary',
		'reference'
	),
	(
		'Daniel',
		'IVP Academic',
		'Downers Grove, IL',
		2002,
		NULL,
		'9780830825196',
		'20',
		'ApOTC',
		'Commentary',
		'reference'
	),
	(
		'Galatians',
		'Fortress Press',
		'Philadelphia',
		1979,
		NULL,
		'9780800660093',
		NULL,
		'Hermeneia',
		'Commentary',
		'reference'
	),
	(
		'Proverbs',
		'IVP Academic',
		'Downers Grove, IL',
		2018,
		NULL,
		'9780830829392',
		NULL,
		'KCC',
		'Commentary',
		'reference'
	),
	(
		'Psalms 1–72',
		'IVP Academic',
		'Downers Grove, IL',
		2014,
		NULL,
		'9780830829378',
		NULL,
		'KCC',
		'Commentary',
		'reference'
	),
	(
		'Psalms 73–150',
		'IVP Academic',
		'Downers Grove, IL',
		2014,
		NULL,
		'9780830829385',
		NULL,
		'KCC',
		'Commentary',
		'reference'
	),
	(
		'The Book of Proverbs, Chapters 1–15',
		'Eerdmans',
		'Grand Rapids, MI',
		2004,
		NULL,
		'9780802825452',
		NULL,
		'NICOT',
		'Commentary',
		'reference'
	),
	(
		'The Book of Proverbs, Chapters 15–31',
		'Eerdmans',
		'Grand Rapids, MI',
		2005,
		NULL,
		'9780802827760',
		NULL,
		'NICOT',
		'Commentary',
		'reference'
	)
) AS v(
	title, publisher, publisher_location, year, original_year, isbn,
	volume_number, series_abbr, genre, reading_status
)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id = s.id
);

-- ---------------------------------------------------------------------------
-- Standalone books (no series)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_location, year, original_year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, v.publisher_location, v.year, v.original_year, v.isbn,
	v.genre, 'monograph', 'english', v.reading_status, false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'The Pun Also Rises',
		'Gotham Books',
		'New York, NY',
		2011,
		NULL::int,
		'9781592406753',
		'Language',
		'unread'
	),
	(
		'The Emotionally Healthy Church, Expanded Edition',
		'Zondervan',
		'Grand Rapids, MI',
		2015,
		NULL,
		'9780310526353',
		'Pastoral Ministry',
		'unread'
	),
	(
		'The Wisdom of Proverbs, Job and Ecclesiastes',
		'InterVarsity Press',
		'Downers Grove, IL',
		1985,
		NULL,
		'9780877844051',
		'Psalms and Wisdom Literature',
		'unread'
	),
	(
		'The Cry of the Soul',
		'NavPress',
		'Colorado Springs, CO',
		2015,
		1994,
		'9781576831809',
		'Christian Living',
		'unread'
	),
	(
		'Emotionally Healthy Discipleship',
		'Zondervan',
		'Grand Rapids, MI',
		2021,
		NULL,
		'9780310109488',
		'Pastoral Ministry',
		'unread'
	),
	(
		'Churches, Cultures, and Leadership',
		'IVP Academic',
		'Downers Grove, IL',
		2023,
		2011,
		'9781514002872',
		'Leadership',
		'unread'
	),
	(
		'When Life Goes Dark',
		'IVP',
		'Downers Grove, IL',
		2012,
		NULL,
		'9780830834686',
		'Pastoral Ministry',
		'unread'
	),
	(
		'Reading Genesis Well',
		'Zondervan Academic',
		'Grand Rapids, MI',
		2018,
		NULL,
		'9780310598572',
		'Old Testament',
		'unread'
	),
	(
		'Topical Preaching in a Complex World',
		'Zondervan Academic',
		'Grand Rapids, MI',
		2021,
		NULL,
		'9780310108870',
		'Homiletics',
		'unread'
	),
	(
		'Strategic Pastoral Counseling',
		'Baker Academic',
		'Grand Rapids, MI',
		2003,
		NULL,
		'9780801026317',
		'Pastoral Ministry',
		'unread'
	),
	(
		'Descriptions and Prescriptions',
		'New Growth Press',
		'Greensboro, NC',
		2017,
		NULL,
		'9781945270116',
		'Pastoral Ministry',
		'unread'
	),
	(
		'Preaching Christ from Ecclesiastes',
		'Eerdmans',
		'Grand Rapids, MI',
		2010,
		NULL,
		'9780802865359',
		'Homiletics',
		'unread'
	)
) AS v(
	title, publisher, publisher_location, year, original_year, isbn,
	genre, reading_status
)
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id IS NULL
);

-- ---------------------------------------------------------------------------
-- Authors / translators (series books)
-- ---------------------------------------------------------------------------
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('Odyssey, Volume II: Books 13–24', 'LCL', 'author', NULL, NULL, 'Homer', 0),
	('Odyssey, Volume II: Books 13–24', 'LCL', 'translator', 'A.', 'T', 'Murray', 1),
	('The Epistles of St. Peter and St. Jude', 'ICC', 'author', 'Charles', NULL, 'Bigg', 0),
	('The Book of Exodus', 'OTL', 'author', 'Brevard', 'S.', 'Childs', 0),
	('Daniel', 'ApOTC', 'author', 'Ernest', 'C.', 'Lucas', 0),
	('Galatians', 'Hermeneia', 'author', 'Hans', 'Dieter', 'Betz', 0),
	('Proverbs', 'KCC', 'author', 'Derek', NULL, 'Kidner', 0),
	('Psalms 1–72', 'KCC', 'author', 'Derek', NULL, 'Kidner', 0),
	('Psalms 73–150', 'KCC', 'author', 'Derek', NULL, 'Kidner', 0),
	('The Book of Proverbs, Chapters 1–15', 'NICOT', 'author', 'Bruce', 'K.', 'Waltke', 0),
	('The Book of Proverbs, Chapters 15–31', 'NICOT', 'author', 'Bruce', 'K.', 'Waltke', 0)
) AS v(title, series_abbr, role, first_name, middle_name, last_name, sort_order)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id
);

-- ---------------------------------------------------------------------------
-- Authors (standalone books)
-- ---------------------------------------------------------------------------
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', v.sort_order
FROM (VALUES
	('The Pun Also Rises', 'John', NULL, 'Pollack', 0),
	('The Emotionally Healthy Church, Expanded Edition', 'Peter', NULL, 'Scazzero', 0),
	('The Wisdom of Proverbs, Job and Ecclesiastes', 'Derek', NULL, 'Kidner', 0),
	('The Cry of the Soul', 'Dan', 'B.', 'Allender', 0),
	('The Cry of the Soul', 'Tremper', NULL, 'Longman', 1),
	('Emotionally Healthy Discipleship', 'Peter', NULL, 'Scazzero', 0),
	('Churches, Cultures, and Leadership', 'Mark', 'Lau', 'Branson', 0),
	('Churches, Cultures, and Leadership', 'Juan', 'F.', 'Martinez', 1),
	('When Life Goes Dark', 'Richard', NULL, 'Winter', 0),
	('Reading Genesis Well', 'C.', 'John', 'Collins', 0),
	('Topical Preaching in a Complex World', 'Sam', NULL, 'Chan', 0),
	('Topical Preaching in a Complex World', 'Malcolm', NULL, 'Gill', 1),
	('Strategic Pastoral Counseling', 'David', 'G.', 'Benner', 0),
	('Descriptions and Prescriptions', 'Michael', 'R.', 'Emlet', 0),
	('Preaching Christ from Ecclesiastes', 'Sidney', NULL, 'Greidanus', 0)
) AS v(title, first_name, middle_name, last_name, sort_order)
JOIN public.books b ON b.title = v.title AND b.series_id IS NULL AND b.deleted_at IS NULL
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id
);

-- ---------------------------------------------------------------------------
-- Bible coverage (commentaries)
-- ---------------------------------------------------------------------------
INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('The Epistles of St. Peter and St. Jude', 'ICC', '1 Peter'),
	('The Epistles of St. Peter and St. Jude', 'ICC', '2 Peter'),
	('The Epistles of St. Peter and St. Jude', 'ICC', 'Jude'),
	('The Book of Exodus', 'OTL', 'Exodus'),
	('Daniel', 'ApOTC', 'Daniel'),
	('Galatians', 'Hermeneia', 'Galatians'),
	('Proverbs', 'KCC', 'Proverbs'),
	('Psalms 1–72', 'KCC', 'Psalms'),
	('Psalms 73–150', 'KCC', 'Psalms'),
	('The Book of Proverbs, Chapters 1–15', 'NICOT', 'Proverbs'),
	('The Book of Proverbs, Chapters 15–31', 'NICOT', 'Proverbs')
) AS v(title, series_abbr, bible_book)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);
