-- library_oct7_shelf_batch: Allender/Call marriage, Marshall/Peterson Acts essays,
-- Hartley NICOT Job, Schnittjer/Harmon, Rahlfs hand edition, LEH 3rd corrected
-- (owner confirm 2026-10-07). Idempotent by natural keys. Hosted push only.
-- DML-only (no gen-types).
-- Witherington last_name is 'Witherington III' (suffix on the last name — 236).

-- ---------------------------------------------------------------------------
-- People (new only). Existing: Allender, Marshall, Hartley, Schnittjer,
-- Harmon, Bock, Green, Rosner, Bayer, Blomberg, Towner, Wall, Witherington III.
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Steve', NULL::text, 'Call'),
	('David', 'G.', 'Peterson'),
	('John', 'T.', 'Squires'),
	('John', NULL::text, 'Nolland'),
	('H.', 'Douglas', 'Buckwalter'),
	('Christoph', 'W.', 'Stenschke'),
	('Andrew', 'C.', 'Clark'),
	('Peter', 'G.', 'Bolt'),
	('Brian', NULL::text, 'Rapske'),
	('Heinz-Werner', NULL::text, 'Neudorfer'),
	('G.', 'Walter', 'Hansen'),
	('Max', NULL::text, 'Turner'),
	('David', NULL::text, 'Seccombe'),
	('Stephen', 'C.', 'Barton'),
	('Brad', NULL::text, 'Blue'),
	('Brian', NULL::text, 'Capper'),
	('Alfred', NULL::text, 'Rahlfs'),
	('Robert', NULL::text, 'Hanhart'),
	('Johan', NULL::text, 'Lust'),
	('Erik', NULL::text, 'Eynikel'),
	('Katrin', NULL::text, 'Hauspie')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- Standalone books
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, subtitle, edition, publisher, publisher_id, publisher_location,
	year, original_year, isbn,
	genre, work_type, language, reading_status, needs_review, created_by
)
SELECT
	v.title, v.subtitle, v.edition, v.publisher, pub.id, v.publisher_location,
	v.year, v.original_year, v.isbn,
	v.genre, v.work_type, v.language, v.reading_status, false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'The Deep-Rooted Marriage',
		'Cultivating Intimacy, Healing, and Delight',
		NULL::text,
		'Thomas Nelson',
		'Nashville, TN',
		2025,
		NULL::int,
		'9781400344468',
		'Christian Living',
		'monograph',
		'english',
		'unread'
	),
	(
		'Witness to the Gospel',
		'The Theology of Acts',
		NULL::text,
		'Eerdmans',
		'Grand Rapids, MI',
		1998,
		NULL::int,
		'9780802844354',
		'Biblical Theology',
		'edited_volume',
		'english',
		'unread'
	),
	(
		'How to Study the Bible''s Use of the Bible',
		'Seven Hermeneutical Choices for the Old and New Testaments',
		NULL::text,
		'Zondervan Academic',
		'Grand Rapids, MI',
		2024,
		NULL::int,
		'9780310142454',
		'Biblical Theology',
		'monograph',
		'english',
		'unread'
	),
	(
		'Septuaginta',
		NULL::text,
		'Editio altera',
		'Deutsche Bibelgesellschaft',
		'Stuttgart',
		2006,
		1935,
		'9783438051196',
		'Bibles',
		'monograph',
		'greek',
		'reference'
	),
	(
		'A Greek-English Lexicon of the Septuagint',
		NULL::text,
		'Third Corrected Edition',
		'Deutsche Bibelgesellschaft',
		'Stuttgart',
		2015,
		NULL::int,
		'9783438051387',
		'Greek Language Tools',
		'monograph',
		'english',
		'reference'
	)
) AS v(
	title, subtitle, edition, publisher, publisher_location,
	year, original_year, isbn, genre, work_type, language, reading_status
)
LEFT JOIN public.publishers pub
	ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.title = v.title
		AND b.series_id IS NULL
);

-- ---------------------------------------------------------------------------
-- NICOT Job (series already exists; siblings have no volume_number)
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location, year, isbn,
	series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	'The Book of Job',
	'Eerdmans',
	pub.id,
	'Grand Rapids, MI',
	1988,
	'9780802825285',
	s.id,
	'Commentary',
	'monograph',
	'english',
	'reference',
	false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM public.series s
LEFT JOIN public.publishers pub
	ON pub.canonical_name = 'Eerdmans' AND pub.deleted_at IS NULL
WHERE s.abbreviation = 'NICOT'
	AND s.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.books b
		WHERE b.deleted_at IS NULL
			AND b.title = 'The Book of Job'
			AND b.series_id = s.id
	);

-- ---------------------------------------------------------------------------
-- Authors / editors
-- ---------------------------------------------------------------------------
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('The Deep-Rooted Marriage', 'Dan', 'B.', 'Allender', 'author', 0),
	('The Deep-Rooted Marriage', 'Steve', NULL::text, 'Call', 'author', 1),
	('Witness to the Gospel', 'I.', 'Howard', 'Marshall', 'editor', 0),
	('Witness to the Gospel', 'David', 'G.', 'Peterson', 'editor', 1),
	('How to Study the Bible''s Use of the Bible', 'Gary', 'Edward', 'Schnittjer', 'author', 0),
	('How to Study the Bible''s Use of the Bible', 'Matthew', 'S.', 'Harmon', 'author', 1),
	('Septuaginta', 'Alfred', NULL::text, 'Rahlfs', 'editor', 0),
	('Septuaginta', 'Robert', NULL::text, 'Hanhart', 'editor', 1),
	('A Greek-English Lexicon of the Septuagint', 'Johan', NULL::text, 'Lust', 'author', 0),
	('A Greek-English Lexicon of the Septuagint', 'Erik', NULL::text, 'Eynikel', 'author', 1),
	('A Greek-English Lexicon of the Septuagint', 'Katrin', NULL::text, 'Hauspie', 'author', 2)
) AS v(title, first_name, middle_name, last_name, role, sort_order)
JOIN public.books b
	ON b.title = v.title AND b.series_id IS NULL AND b.deleted_at IS NULL
JOIN public.people p
	ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM public.series s
JOIN public.books b
	ON b.series_id = s.id AND b.title = 'The Book of Job' AND b.deleted_at IS NULL
JOIN public.people p
	ON p.deleted_at IS NULL
	AND p.first_name = 'John'
	AND p.middle_name = 'E.'
	AND p.last_name = 'Hartley'
WHERE s.abbreviation = 'NICOT'
	AND s.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.book_authors ba
		WHERE ba.book_id = b.id AND ba.person_id = p.id
	);

INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, 'Job', 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM public.series s
JOIN public.books b
	ON b.series_id = s.id AND b.title = 'The Book of Job' AND b.deleted_at IS NULL
WHERE s.abbreviation = 'NICOT'
	AND s.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.book_bible_coverage c
		WHERE c.book_id = b.id AND c.bible_book = 'Job'
	);

-- ---------------------------------------------------------------------------
-- Witness to the Gospel essays (JETS 43.2 contents list)
-- ---------------------------------------------------------------------------
INSERT INTO public.essays (essay_title, parent_book_id, page_start, page_end, created_by)
SELECT
	v.essay_title,
	b.id,
	v.page_start,
	v.page_end,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('How Does One Write on the Theology of Acts?', 3, 16),
	('The Plan of God', 19, 39),
	('Scripture and the Realisation of God''s Promises', 41, 62),
	('Salvation-History and Eschatology', 63, 81),
	('Salvation to the End of the Earth: God as the Saviour in the Acts of the Apostles', 83, 106),
	('The Divine Saviour', 107, 123),
	('The Need for Salvation', 125, 144),
	('Salvation and Health in Christian Antiquity: The Soteriology of Luke-Acts in Its First Century Setting', 145, 166),
	('The Role of the Apostles', 169, 190),
	('Mission and Witness', 191, 214),
	('The Progress of the Word', 215, 233),
	('Opposition to the Plan of God and Persecution', 235, 256),
	('The Preaching of Peter in Acts', 257, 274),
	('The Speech of Stephen', 275, 294),
	('The Preaching and Defence of Paul', 295, 324),
	('The ''Spirit of Prophecy'' as the Power of Israel''s Restoration and Witness', 327, 348),
	('The New People of God', 349, 372),
	('The Worship of the New Community', 373, 395),
	('The Christian and the Law of Moses', 397, 416),
	('Mission Practice and Theology under Construction (Acts 18–20)', 417, 436),
	('Israel and the Gentile Mission in Acts and Paul: A Canonical Approach', 437, 457),
	('Sociology and Theology', 459, 472),
	('The Influence of Jewish Worship on Luke''s Presentation of the Early Church', 473, 497),
	('Reciprocity and the Ethic of Acts', 499, 518),
	('Luke''s Theological Enterprise: Integration and Intent', 521, 544)
) AS v(essay_title, page_start, page_end)
JOIN public.books b
	ON b.title = 'Witness to the Gospel' AND b.series_id IS NULL AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.essays e
	WHERE e.deleted_at IS NULL
		AND e.parent_book_id = b.id
		AND e.essay_title = v.essay_title
);

INSERT INTO public.essay_authors (essay_id, person_id, role, sort_order)
SELECT e.id, p.id, 'author', 0
FROM (VALUES
	('How Does One Write on the Theology of Acts?', 'I.', 'Howard', 'Marshall'),
	('The Plan of God', 'John', 'T.', 'Squires'),
	('Scripture and the Realisation of God''s Promises', 'Darrell', 'L.', 'Bock'),
	('Salvation-History and Eschatology', 'John', NULL::text, 'Nolland'),
	('Salvation to the End of the Earth: God as the Saviour in the Acts of the Apostles', 'Joel', 'B.', 'Green'),
	('The Divine Saviour', 'H.', 'Douglas', 'Buckwalter'),
	('The Need for Salvation', 'Christoph', 'W.', 'Stenschke'),
	('Salvation and Health in Christian Antiquity: The Soteriology of Luke-Acts in Its First Century Setting', 'Ben', NULL::text, 'Witherington III'),
	('The Role of the Apostles', 'Andrew', 'C.', 'Clark'),
	('Mission and Witness', 'Peter', 'G.', 'Bolt'),
	('The Progress of the Word', 'Brian', 'S.', 'Rosner'),
	('Opposition to the Plan of God and Persecution', 'Brian', NULL::text, 'Rapske'),
	('The Preaching of Peter in Acts', 'Hans', 'F.', 'Bayer'),
	('The Speech of Stephen', 'Heinz-Werner', NULL::text, 'Neudorfer'),
	('The Preaching and Defence of Paul', 'G.', 'Walter', 'Hansen'),
	('The ''Spirit of Prophecy'' as the Power of Israel''s Restoration and Witness', 'Max', NULL::text, 'Turner'),
	('The New People of God', 'David', NULL::text, 'Seccombe'),
	('The Worship of the New Community', 'David', 'G.', 'Peterson'),
	('The Christian and the Law of Moses', 'Craig', 'L.', 'Blomberg'),
	('Mission Practice and Theology under Construction (Acts 18–20)', 'Philip', 'H.', 'Towner'),
	('Israel and the Gentile Mission in Acts and Paul: A Canonical Approach', 'Robert', 'W.', 'Wall'),
	('Sociology and Theology', 'Stephen', 'C.', 'Barton'),
	('The Influence of Jewish Worship on Luke''s Presentation of the Early Church', 'Brad', NULL::text, 'Blue'),
	('Reciprocity and the Ethic of Acts', 'Brian', NULL::text, 'Capper'),
	('Luke''s Theological Enterprise: Integration and Intent', 'David', 'G.', 'Peterson')
) AS v(essay_title, first_name, middle_name, last_name)
JOIN public.books b
	ON b.title = 'Witness to the Gospel' AND b.series_id IS NULL AND b.deleted_at IS NULL
JOIN public.essays e
	ON e.parent_book_id = b.id AND e.essay_title = v.essay_title AND e.deleted_at IS NULL
JOIN public.people p
	ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.essay_authors ea
	WHERE ea.essay_id = e.id AND ea.person_id = p.id
);
