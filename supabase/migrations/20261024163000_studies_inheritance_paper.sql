-- Published NT305 paper "Our Share of the Inheritance" (Presbyterion, Fall 2025)
-- plus bibliography sources. Not-owned works stay owned = false.
-- Idempotent by natural keys. Hosted push only.

INSERT INTO public.series (name, abbreviation, created_by)
SELECT v.name, v.abbreviation, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('New International Dictionary of New Testament Theology', 'NIDNTT'),
	('Scottish Journal of Theology Occasional Papers', 'SJT Occasional Papers')
) AS v(name, abbreviation)
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = v.abbreviation
);

INSERT INTO public.people (first_name, middle_name, last_name, suffix, created_by)
SELECT v.first_name, v.middle_name, v.last_name, v.suffix, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Paul', NULL, 'Foster', NULL),
	('David', 'W.', 'Pao', NULL),
	('Miguel', 'G.', 'Echevarria', 'Jr.'),
	('Francis', NULL, 'Lyall', NULL),
	('D. R.', NULL, 'Denton', NULL),
	('Johannes', NULL, 'Eichler', NULL),
	('Werner', NULL, 'Foerster', NULL),
	('Colin', NULL, 'Brown', NULL)
) AS v(first_name, middle_name, last_name, suffix)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
		AND COALESCE(p.suffix, '') = COALESCE(v.suffix, '')
);

-- Commentaries and the Brown NIDNTT volume (distinct from Silva's NIDNTTE).
INSERT INTO public.books (
	title, publisher, publisher_location, year, original_year, isbn,
	volume_number, series_id, genre, work_type, language,
	reading_status, needs_review, owned, created_by
)
SELECT
	v.title, v.publisher, v.publisher_location, v.year, v.original_year, v.isbn,
	v.volume_number, s.id, v.genre, v.work_type, 'english',
	v.reading_status, false, false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('The Letter to the Colossians', 'Eerdmans', 'Grand Rapids, MI', 2018, NULL::int, '9780802867988', NULL::text, 'NICNT', 'Commentary', 'monograph', 'reference'),
	('Colossians and Philemon', 'Eerdmans', 'Grand Rapids, MI', 1986, NULL::int, '9780802803092', NULL::text, 'TNTC', 'Commentary', 'monograph', 'reference'),
	('Colossians', 'Bloomsbury T&T Clark', 'London', 2016, NULL::int, NULL::text, NULL::text, 'BNTC', 'Commentary', 'monograph', 'reference'),
	('Colossians and Philemon', 'Zondervan', 'Grand Rapids, MI', 2012, NULL::int, '9780310243953', NULL::text, 'ZECNT', 'Commentary', 'monograph', 'reference'),
	('New International Dictionary of New Testament Theology', 'Regency', 'Grand Rapids, MI', 1986, 1976, NULL::text, '2', 'NIDNTT', 'Biblical Reference', 'reference_work', 'reference')
) AS v(title, publisher, publisher_location, year, original_year, isbn, volume_number, series_abbr, genre, work_type, reading_status)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id = s.id
);

INSERT INTO public.books (
	title, publisher, publisher_location, year, isbn,
	genre, work_type, language, reading_status, needs_review, owned,
	personal_notes, created_by
)
SELECT
	v.title, v.publisher, v.publisher_location, v.year, v.isbn,
	v.genre, 'monograph', 'english', 'unread', false, false,
	v.personal_notes, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('The Future Inheritance of Land in the Pauline Epistles', 'Pickwick Publications', 'Eugene, OR', 2019, '9781532632822', 'Acts and Paul', NULL::text),
	('Slaves, Citizens, Sons: Legal Metaphors in the Epistles', 'Zondervan', 'Grand Rapids, MI', 1984, '9780310451914', 'New Testament', NULL::text),
	(
		'Inheritance in Paul and Ephesians',
		'Evangelical Quarterly',
		NULL::text,
		1982,
		NULL::text,
		'New Testament',
		'Journal article: Evangelical Quarterly 54 (1982): 157–62. Stored as a book so the paper can attach it.'
	)
) AS v(title, publisher, publisher_location, year, isbn, genre, personal_notes)
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id IS NULL
);

-- Existing not-owned stub. Fill the 1968 Oliver & Boyd edition (SJT Occasional Papers 14).
UPDATE public.books b
SET
	year = 1968,
	publisher = 'Oliver & Boyd',
	publisher_location = 'Edinburgh',
	genre = 'Acts and Paul',
	series_id = s.id,
	volume_number = '14',
	reading_status = 'unread',
	needs_review = false,
	owned = false
FROM public.series s
WHERE s.abbreviation = 'SJT Occasional Papers'
	AND s.deleted_at IS NULL
	AND b.deleted_at IS NULL
	AND b.title = 'Paul''s Concept of Inheritance'
	AND b.owned = false;

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('The Letter to the Colossians', 'NICNT', 'Scot', NULL, 'McKnight', NULL, 'author', 0),
	('Colossians and Philemon', 'TNTC', 'N. T.', NULL, 'Wright', NULL, 'author', 0),
	('Colossians', 'BNTC', 'Paul', NULL, 'Foster', NULL, 'author', 0),
	('Colossians and Philemon', 'ZECNT', 'David', 'W.', 'Pao', NULL, 'author', 0),
	('New International Dictionary of New Testament Theology', 'NIDNTT', 'Colin', NULL, 'Brown', NULL, 'editor', 0),
	('The Future Inheritance of Land in the Pauline Epistles', NULL, 'Miguel', 'G.', 'Echevarria', 'Jr.', 'author', 0),
	('Slaves, Citizens, Sons: Legal Metaphors in the Epistles', NULL, 'Francis', NULL, 'Lyall', NULL, 'author', 0),
	('Inheritance in Paul and Ephesians', NULL, 'D. R.', NULL, 'Denton', NULL, 'author', 0)
) AS v(title, series_abbr, first_name, middle_name, last_name, suffix, role, sort_order)
LEFT JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.deleted_at IS NULL
	AND b.series_id IS NOT DISTINCT FROM s.id
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
	AND COALESCE(p.suffix, '') = COALESCE(v.suffix, '')
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id AND ba.role = v.role
);

INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('The Letter to the Colossians', 'NICNT', 'Colossians'),
	('Colossians', 'BNTC', 'Colossians'),
	('Colossians and Philemon', 'ZECNT', 'Colossians'),
	('Colossians and Philemon', 'ZECNT', 'Philemon'),
	('Colossians and Philemon', 'TNTC', 'Colossians'),
	('Colossians and Philemon', 'TNTC', 'Philemon')
) AS v(title, series_abbr, bible_book)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book AND c.essay_id IS NULL
);

INSERT INTO public.essays (essay_title, parent_book_id, page_start, page_end, created_by)
SELECT v.essay_title, b.id, v.page_start, v.page_end, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Inheritance, Lot, Portion', 'NIDNTT', '2', '295', '303'),
	('κληρονόμος', 'TDNT', '3', '758', '785')
) AS v(essay_title, series_abbr, volume_number, page_start, page_end)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.series_id = s.id AND b.volume_number = v.volume_number AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.essays e
	WHERE e.deleted_at IS NULL
		AND e.parent_book_id = b.id
		AND e.essay_title = v.essay_title
);

INSERT INTO public.essay_authors (essay_id, person_id, role, sort_order)
SELECT e.id, p.id, 'author', 0
FROM (VALUES
	('Inheritance, Lot, Portion', 'NIDNTT', '2', 'Johannes', NULL, 'Eichler'),
	('κληρονόμος', 'TDNT', '3', 'Werner', NULL, 'Foerster')
) AS v(essay_title, series_abbr, volume_number, first_name, middle_name, last_name)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.series_id = s.id AND b.volume_number = v.volume_number AND b.deleted_at IS NULL
JOIN public.essays e ON e.parent_book_id = b.id AND e.essay_title = v.essay_title AND e.deleted_at IS NULL
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.essay_authors ea
	WHERE ea.essay_id = e.id AND ea.person_id = p.id
);

INSERT INTO public.papers (
	title, status, passage_display, topical, due_date, notes, created_by
)
SELECT
	'Our Share of the Inheritance: The Lord is my Portion; Indeed, I have a Beautiful Inheritance',
	'published',
	'Colossians 1:12',
	false,
	DATE '2025-05-07',
	'NT305 term paper, Covenant Theological Seminary, submitted 7 May 2025. Published in Presbyterion, Fall 2025.',
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
WHERE NOT EXISTS (
	SELECT 1 FROM public.papers p
	WHERE p.deleted_at IS NULL
		AND p.title = 'Our Share of the Inheritance: The Lord is my Portion; Indeed, I have a Beautiful Inheritance'
);

-- Bibliography order. Dictionary and TDNT rows cite the article, not the whole set.
INSERT INTO public.study_sources (
	paper_id, book_id, essay_id, usage, sort_order, notes, created_by
)
SELECT
	paper.id,
	src.book_id,
	src.essay_id,
	'cited',
	src.sort_order,
	src.notes,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM public.papers paper
JOIN (
	SELECT b.id AS book_id, NULL::uuid AS essay_id, 0 AS sort_order, NULL::text AS notes
	FROM public.books b
	JOIN public.series s ON s.id = b.series_id
	WHERE b.deleted_at IS NULL AND s.abbreviation = 'BDAG'
		AND b.title = 'A Greek-English Lexicon of the New Testament and Other Early Christian Literature'

	UNION ALL
	SELECT b.id, NULL, 1, 'Journal article: Evangelical Quarterly 54 (1982): 157–62.'
	FROM public.books b
	WHERE b.deleted_at IS NULL AND b.series_id IS NULL
		AND b.title = 'Inheritance in Paul and Ephesians'

	UNION ALL
	SELECT b.id, NULL, 2, NULL
	FROM public.books b
	WHERE b.deleted_at IS NULL AND b.series_id IS NULL
		AND b.title = 'The Future Inheritance of Land in the Pauline Epistles'

	UNION ALL
	SELECT NULL, e.id, 3, NULL
	FROM public.essays e
	JOIN public.books b ON b.id = e.parent_book_id
	JOIN public.series s ON s.id = b.series_id
	WHERE e.deleted_at IS NULL AND e.essay_title = 'Inheritance, Lot, Portion'
		AND s.abbreviation = 'NIDNTT' AND b.volume_number = '2'

	UNION ALL
	SELECT NULL, e.id, 4, NULL
	FROM public.essays e
	JOIN public.books b ON b.id = e.parent_book_id
	JOIN public.series s ON s.id = b.series_id
	WHERE e.deleted_at IS NULL AND e.essay_title = 'κληρονόμος'
		AND s.abbreviation = 'TDNT' AND b.volume_number = '3'

	UNION ALL
	SELECT b.id, NULL, 5, 'Cited pp. 163–167.'
	FROM public.books b
	JOIN public.series s ON s.id = b.series_id
	WHERE b.deleted_at IS NULL AND s.abbreviation = 'BNTC' AND b.title = 'Colossians'
		AND b.year = 2016

	UNION ALL
	SELECT b.id, NULL, 6, NULL
	FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = 'Paul''s Concept of Inheritance' AND b.owned = false

	UNION ALL
	SELECT b.id, NULL, 7, 'Cited pp. 101–117.'
	FROM public.books b
	WHERE b.deleted_at IS NULL AND b.series_id IS NULL
		AND b.title = 'Slaves, Citizens, Sons: Legal Metaphors in the Epistles'

	UNION ALL
	SELECT b.id, NULL, 8, NULL
	FROM public.books b
	JOIN public.series s ON s.id = b.series_id
	WHERE b.deleted_at IS NULL AND s.abbreviation = 'NICNT'
		AND b.title = 'The Letter to the Colossians'

	UNION ALL
	SELECT b.id, NULL, 9, NULL
	FROM public.books b
	JOIN public.series s ON s.id = b.series_id
	WHERE b.deleted_at IS NULL AND s.abbreviation = 'PNTC'
		AND b.title = 'The Letters to the Colossians and to Philemon' AND b.year = 2024

	UNION ALL
	SELECT b.id, NULL, 10, NULL
	FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = 'Novum Testamentum Graece Ed. XXVIII'

	UNION ALL
	SELECT b.id, NULL, 11, NULL
	FROM public.books b
	JOIN public.series s ON s.id = b.series_id
	WHERE b.deleted_at IS NULL AND s.abbreviation = 'ZECNT'
		AND b.title = 'Colossians and Philemon'

	UNION ALL
	SELECT b.id, NULL, 12, NULL
	FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = 'Septuaginta' AND b.year = 2006

	UNION ALL
	SELECT b.id, NULL, 13, 'Cited pp. 60–62.'
	FROM public.books b
	JOIN public.series s ON s.id = b.series_id
	WHERE b.deleted_at IS NULL AND s.abbreviation = 'TNTC'
		AND b.title = 'Colossians and Philemon' AND b.year = 1986
) AS src ON true
WHERE paper.deleted_at IS NULL
	AND paper.title = 'Our Share of the Inheritance: The Lord is my Portion; Indeed, I have a Beautiful Inheritance'
	AND NOT EXISTS (
		SELECT 1 FROM public.study_sources existing
		WHERE existing.deleted_at IS NULL
			AND existing.paper_id = paper.id
			AND existing.book_id IS NOT DISTINCT FROM src.book_id
			AND existing.essay_id IS NOT DISTINCT FROM src.essay_id
	);
