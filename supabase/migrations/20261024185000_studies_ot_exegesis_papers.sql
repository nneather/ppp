-- Five archived OT papers (OT340, OT305 x2, OT320, OT330) and their bibliographies.
-- Shelf corrections Parker confirmed, plus Lovell (owned) and two journal stubs.
-- Idempotent by natural key. Hosted push only.
--
-- Left unchanged on purpose (follow-up at home):
--   Sarna, Genesis (JPS): year stays 2001. ISBN 9780827603264 is also the
--     ISBN-13 of the 1989 first edition. Copyright page decides the year.
--   Walsh, 1 Kings (Berit Olam): year stays 2021. ISBN 9780814690383 is the
--     2021 paperback, not the 1996 hardcover 9780814650448.
--   Wright, Exodus (Story of God): publisher becomes Zondervan Academic.
--     Year stays 2021. The publisher page dates the hardcover March 2021
--     (9780310490692). The row's ISBN is the 2021 ebook. The paper says 2023.

UPDATE public.people
SET last_name = 'Mathews'
WHERE id = '671c0a10-8f3e-4ed5-9057-a14a5de34c64'
	AND deleted_at IS NULL
	AND first_name = 'Kenneth'
	AND middle_name = 'A.'
	AND last_name = 'Matthew';

-- 4th ed. is the shelf copy. The row was the 1995 Paternoster printing.
UPDATE public.books
SET
	subtitle = 'An Introduction to the Pentateuch',
	year = 2022,
	original_year = 1995,
	edition = '4th',
	isbn = '9781540963406',
	publisher_id = '6cf4d7ef-9825-4f40-8821-ac0f6f56fcbc',
	publisher = NULL,
	publisher_location = NULL
WHERE id = 'dd85e923-43c1-4ad4-8327-42fe703c98e4'
	AND deleted_at IS NULL;

-- Paper cites the 1995 Hendrickson NIBC. The row's ISBN was the 2012 Baker ebook.
UPDATE public.books
SET
	year = 1995,
	isbn = '9781565630536'
WHERE id = '18df1e47-ddc0-41d7-8d48-cf3424dec70d'
	AND deleted_at IS NULL;

UPDATE public.books
SET publisher_id = 'c3878c57-cf3c-4298-abf7-8c5f000f7105'
WHERE id = '8fe47941-7968-4e4f-ad74-7317a63ed24a'
	AND deleted_at IS NULL;

INSERT INTO public.publishers (canonical_name, default_location, created_by)
SELECT 'Hodder & Stoughton', 'London', 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
WHERE NOT EXISTS (
	SELECT 1 FROM public.publishers p
	WHERE p.deleted_at IS NULL AND p.canonical_name = 'Hodder & Stoughton'
);

INSERT INTO public.series (name, abbreviation, include_in_citation, created_by)
SELECT 'The Hodder Bible Commentary', 'HBC', true, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = 'HBC'
);

INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Nathan', NULL, 'Lovell'),
	('Wungtei', NULL, 'Buchem'),
	('Nili', NULL, 'Fox'),
	('G.', NULL, 'Gilmour'),
	('J. R.', NULL, 'Soza')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

INSERT INTO public.books (
	title, year, isbn, publisher_id, series_id, genre, work_type,
	language, reading_status, needs_review, owned, created_by
)
SELECT
	'1 & 2 Kings',
	2025,
	'9781399819367',
	pub.id,
	s.id,
	'Commentary',
	'monograph',
	'english',
	'reference',
	false,
	true,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM public.series s
JOIN public.publishers pub ON pub.deleted_at IS NULL AND pub.canonical_name = 'Hodder & Stoughton'
WHERE s.deleted_at IS NULL
	AND s.abbreviation = 'HBC'
	AND NOT EXISTS (
		SELECT 1 FROM public.books b
		WHERE b.deleted_at IS NULL AND b.title = '1 & 2 Kings' AND b.series_id = s.id
	);

INSERT INTO public.books (
	title, publisher, year, genre, work_type, language,
	reading_status, needs_review, owned, personal_notes, created_by
)
SELECT
	v.title, v.publisher, v.year, 'Old Testament Historical Books', 'monograph', 'english',
	'unread', false, false, v.personal_notes, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'Hermeneutics of Voice: Counter-Reading 1 Kings 12 from an Indigenous Perspective',
		'Bangalore Theological Forum',
		2018,
		'Journal article: Bangalore Theological Forum 50, no. 1 (2018): 152–64. Stored as a book so the paper can attach it.'
	),
	(
		'Royal Officials and Court Families: A New Look at the ילדים (Yĕlādîm) in 1 Kings 12',
		'The Biblical Archaeologist',
		1996,
		'Journal article: The Biblical Archaeologist 59, no. 4 (1996): 225–32. https://doi.org/10.2307/3210564. Stored as a book so the paper can attach it.'
	)
) AS v(title, publisher, year, personal_notes)
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.title = v.title AND b.series_id IS NULL
);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'author', 0
FROM (VALUES
	('1 & 2 Kings', 'HBC', 'Nathan', 'Lovell'),
	('Hermeneutics of Voice: Counter-Reading 1 Kings 12 from an Indigenous Perspective', NULL, 'Wungtei', 'Buchem'),
	('Royal Officials and Court Families: A New Look at the ילדים (Yĕlādîm) in 1 Kings 12', NULL, 'Nili', 'Fox')
) AS v(title, series_abbr, first_name, last_name)
LEFT JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.deleted_at IS NULL
	AND b.title = v.title
	AND b.series_id IS NOT DISTINCT FROM s.id
JOIN public.people p ON p.deleted_at IS NULL
	AND p.first_name = v.first_name
	AND p.last_name = v.last_name
	AND p.middle_name IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id AND ba.role = 'author'
);

INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('1 Kings'),
	('2 Kings')
) AS v(bible_book)
JOIN public.series s ON s.abbreviation = 'HBC' AND s.deleted_at IS NULL
JOIN public.books b ON b.deleted_at IS NULL AND b.title = '1 & 2 Kings' AND b.series_id = s.id
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book AND c.essay_id IS NULL
);

INSERT INTO public.essays (essay_title, parent_book_id, page_start, page_end, created_by)
SELECT v.essay_title, v.parent_book_id, v.page_start, v.page_end, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Galatians', '20c4e983-6889-4190-970e-399cc919dc4a'::uuid, NULL::text, NULL::text),
	('Shechem', '241b0487-5b2e-4129-832e-47423f1d53e7'::uuid, '889', '892'),
	('Rehoboam', '241b0487-5b2e-4129-832e-47423f1d53e7'::uuid, '838', '841'),
	('Jeroboam', '241b0487-5b2e-4129-832e-47423f1d53e7'::uuid, '544', '547')
) AS v(essay_title, parent_book_id, page_start, page_end)
WHERE NOT EXISTS (
	SELECT 1 FROM public.essays e
	WHERE e.deleted_at IS NULL
		AND e.parent_book_id = v.parent_book_id
		AND e.essay_title = v.essay_title
);

INSERT INTO public.essay_authors (essay_id, person_id, role, sort_order)
SELECT e.id, p.id, 'author', 0
FROM (VALUES
	('Galatians', '20c4e983-6889-4190-970e-399cc919dc4a'::uuid, 'Moisés', 'Silva'),
	('Shechem', '241b0487-5b2e-4129-832e-47423f1d53e7'::uuid, 'G.', 'Gilmour'),
	('Rehoboam', '241b0487-5b2e-4129-832e-47423f1d53e7'::uuid, 'Scot', 'McKnight'),
	('Jeroboam', '241b0487-5b2e-4129-832e-47423f1d53e7'::uuid, 'J. R.', 'Soza')
) AS v(essay_title, parent_book_id, first_name, last_name)
JOIN public.essays e ON e.deleted_at IS NULL
	AND e.essay_title = v.essay_title
	AND e.parent_book_id = v.parent_book_id
JOIN public.people p ON p.deleted_at IS NULL
	AND p.first_name = v.first_name
	AND p.last_name = v.last_name
	AND p.middle_name IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.essay_authors ea
	WHERE ea.essay_id = e.id AND ea.person_id = p.id
);

INSERT INTO public.papers (
	title, status, course_id, passage_display, topical, due_date, notes, created_by
)
SELECT
	v.title, 'archived', v.course_id, v.passage_display, false, v.due_date, v.notes,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	(
		'Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9',
		'4e999ce0-7d00-4d87-990e-88ff809dfcce'::uuid,
		'Proverbs 31:1–9',
		DATE '2026-10-15',
		'Covenant Theological Seminary. Dr. Aaron Goldstein.'
	),
	(
		'When the LORD Sees To It, the LORD Is Seen: An Exegetical Paper on Genesis 22:1-19',
		NULL::uuid,
		'Genesis 22:1–19',
		DATE '2025-12-12',
		'OT305: Old Testament Exegesis, Covenant Theological Seminary. Dr. Aaron Goldstein. No course row in classwork.'
	),
	(
		'The Fear of the LORD: A Word Study of ירא in Deuteronomy 13:4–5',
		NULL::uuid,
		'Deuteronomy 13:4–5',
		DATE '2025-05-14',
		'OT305: Old Testament Exegesis, Covenant Theological Seminary. The file had no title-page title.'
	),
	(
		'The LORD Is Sending a Messenger to Guard You and Go Before You: An Exegetical Paper on Exodus 23:20-33',
		NULL::uuid,
		'Exodus 23:20–33',
		DATE '2025-10-31',
		'OT320: Pentateuch, Covenant Theological Seminary. No course row in classwork.'
	),
	(
		'And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12',
		NULL::uuid,
		'1 Kings 12',
		DATE '2026-05-04',
		'OT330: Old Testament Historical Books, Covenant Theological Seminary. Dr. Brian Aucker. No course row in classwork.'
	)
) AS v(title, course_id, passage_display, due_date, notes)
WHERE NOT EXISTS (
	SELECT 1 FROM public.papers p
	WHERE p.deleted_at IS NULL AND p.title = v.title
);

INSERT INTO public.paper_passages (
	paper_id, bible_book, chapter_start, verse_start, chapter_end, verse_end, role, sort_order, created_by
)
SELECT
	p.id, v.bible_book, v.chapter_start, v.verse_start, v.chapter_end, v.verse_end,
	'primary', 0, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', 'Proverbs', 31, 1, 31, 9),
	('When the LORD Sees To It, the LORD Is Seen: An Exegetical Paper on Genesis 22:1-19', 'Genesis', 22, 1, 22, 19),
	('The Fear of the LORD: A Word Study of ירא in Deuteronomy 13:4–5', 'Deuteronomy', 13, 4, 13, 5),
	('The LORD Is Sending a Messenger to Guard You and Go Before You: An Exegetical Paper on Exodus 23:20-33', 'Exodus', 23, 20, 23, 33),
	('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', '1 Kings', 12, 1, 12, 33)
) AS v(title, bible_book, chapter_start, verse_start, chapter_end, verse_end)
JOIN public.papers p ON p.deleted_at IS NULL AND p.title = v.title
WHERE NOT EXISTS (
	SELECT 1 FROM public.paper_passages pp
	WHERE pp.deleted_at IS NULL
		AND pp.paper_id = p.id
		AND pp.bible_book = v.bible_book
		AND pp.chapter_start = v.chapter_start
		AND pp.verse_start = v.verse_start
		AND pp.role = 'primary'
);

-- Bibliography order. A cited set attaches every owned volume in a row.
-- Essays attach the article, not the parent book.
INSERT INTO public.study_sources (
	paper_id, book_id, essay_id, usage, sort_order, notes, created_by
)
SELECT
	paper.id, src.book_id, src.essay_id, 'cited', src.sort_order, src.notes,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM public.papers paper
JOIN (
	SELECT v.paper_title, b.id AS book_id, NULL::uuid AS essay_id, v.sort_order, v.notes
	FROM (VALUES
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', '36840b3e-2d42-4ccb-9df4-ffb9d615facf'::uuid, 0, NULL::text),
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', 'e5ee9ab2-ebb4-4fe8-af04-687a69790639'::uuid, 1, NULL),
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', 'c86ae4f6-6e63-45ee-beb4-7e4206cf29ff'::uuid, 3, NULL),
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', '74158069-b8b1-435b-8f61-f70592c7327f'::uuid, 5, NULL),
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', '5954dbc9-037b-4030-b158-bca6e5642939'::uuid, 6, NULL),
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', '580187b1-589c-4b64-80fe-e6e3054954ad'::uuid, 7, NULL),
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', 'c772d720-08bb-4d0a-8e65-b6844b7ed413'::uuid, 8, NULL),
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', 'c9746c88-7f20-402a-9114-b9d41baba2c7'::uuid, 9, NULL),
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', 'f20c8441-65f2-49ff-a280-842d66a102eb'::uuid, 10, NULL),
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', '8dc61376-8b46-43db-b4ad-def9126b3fca'::uuid, 11, NULL),
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', '226025ca-7c9c-4dc9-8a21-38851f5b318f'::uuid, 12, NULL),
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', '6d407049-e0a4-4c89-a681-130d76261992'::uuid, 13, NULL),
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', '2b649b69-807a-45c4-8b67-d99a078fdee4'::uuid, 14, NULL),
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', '0825eff0-5ec2-4c12-9e23-cd7478ead433'::uuid, 15, NULL),
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', '9bd094e4-7085-4779-a2f8-4be7e3041288'::uuid, 16, NULL),
		('When the LORD Sees To It, the LORD Is Seen: An Exegetical Paper on Genesis 22:1-19', 'dd85e923-43c1-4ad4-8327-42fe703c98e4'::uuid, 0, NULL),
		('When the LORD Sees To It, the LORD Is Seen: An Exegetical Paper on Genesis 22:1-19', 'e61c137d-b502-48f6-86dc-dfc9973fb328'::uuid, 1, NULL),
		('When the LORD Sees To It, the LORD Is Seen: An Exegetical Paper on Genesis 22:1-19', 'd3ce37c3-54e3-4acf-a64d-fa5bbbecc6a4'::uuid, 2, NULL),
		('When the LORD Sees To It, the LORD Is Seen: An Exegetical Paper on Genesis 22:1-19', 'c2023dd9-029a-4dcc-8d97-ff2fe0d47174'::uuid, 4, NULL),
		('When the LORD Sees To It, the LORD Is Seen: An Exegetical Paper on Genesis 22:1-19', '9d656960-fe0b-4c95-8483-93f7ec0d3950'::uuid, 5, NULL),
		('When the LORD Sees To It, the LORD Is Seen: An Exegetical Paper on Genesis 22:1-19', '1bfe704b-3746-4c6f-8141-ef90efbdf19f'::uuid, 6, NULL),
		('When the LORD Sees To It, the LORD Is Seen: An Exegetical Paper on Genesis 22:1-19', '86ac95b4-912f-4ff9-bd99-c8b3c750aaf7'::uuid, 8, NULL),
		('The Fear of the LORD: A Word Study of ירא in Deuteronomy 13:4–5', '1e7a3065-5195-4b6e-99f3-ea0e64734fb2'::uuid, 0, NULL),
		('The Fear of the LORD: A Word Study of ירא in Deuteronomy 13:4–5', '6d98701d-370f-4885-9c6c-41f741c20012'::uuid, 1, NULL),
		('The Fear of the LORD: A Word Study of ירא in Deuteronomy 13:4–5', '1aa2e6f8-d4f3-4796-b74e-f71432a3ae6c'::uuid, 2, NULL),
		('The Fear of the LORD: A Word Study of ירא in Deuteronomy 13:4–5', 'a027e4e5-42fb-4113-8e7e-71acfcdff72e'::uuid, 3, NULL),
		('The Fear of the LORD: A Word Study of ירא in Deuteronomy 13:4–5', '29937c6b-5050-4320-9e55-ff870471d15c'::uuid, 4, NULL),
		('The LORD Is Sending a Messenger to Guard You and Go Before You: An Exegetical Paper on Exodus 23:20-33', 'dd85e923-43c1-4ad4-8327-42fe703c98e4'::uuid, 0, NULL),
		('The LORD Is Sending a Messenger to Guard You and Go Before You: An Exegetical Paper on Exodus 23:20-33', 'e61c137d-b502-48f6-86dc-dfc9973fb328'::uuid, 1, NULL),
		('The LORD Is Sending a Messenger to Guard You and Go Before You: An Exegetical Paper on Exodus 23:20-33', 'a9b1e6fa-9de3-410f-9d40-f485464d0e9b'::uuid, 2, NULL),
		('The LORD Is Sending a Messenger to Guard You and Go Before You: An Exegetical Paper on Exodus 23:20-33', 'd5f6d22a-946c-4ba5-858a-e373399f3394'::uuid, 4, NULL),
		('The LORD Is Sending a Messenger to Guard You and Go Before You: An Exegetical Paper on Exodus 23:20-33', '8fe47941-7968-4e4f-ad74-7317a63ed24a'::uuid, 5, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', '43914f5b-18ee-4758-8dfc-e0b4074c8a8c'::uuid, 0, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', 'e5ee9ab2-ebb4-4fe8-af04-687a69790639'::uuid, 1, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', 'd3ce37c3-54e3-4acf-a64d-fa5bbbecc6a4'::uuid, 2, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', 'd361cec2-6689-41c2-a27a-e940f5adf65b'::uuid, 4, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', 'a60309ed-1172-4da0-acdd-daa3c0bee404'::uuid, 5, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', '580187b1-589c-4b64-80fe-e6e3054954ad'::uuid, 6, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', '976de395-1e0e-41d5-82ed-eacf1c701229'::uuid, 8, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', '5954dbc9-037b-4030-b158-bca6e5642939'::uuid, 9, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', '3bf43427-28e0-4531-a37b-cd4118715230'::uuid, 11, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', '18df1e47-ddc0-41d7-8d48-cf3424dec70d'::uuid, 14, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', 'f538d4ba-b2eb-4187-adca-601297aec436'::uuid, 15, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', '04c3ab1b-5772-4e41-a27f-b73bc33ff124'::uuid, 16, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', '3cb46cd7-f4e7-4a8f-983c-f6cbed764a15'::uuid, 17, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', '93324149-56ef-4602-8a14-1a111d07ed20'::uuid, 19, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', '4e87b189-019a-45ad-b469-4455c5aa753d'::uuid, 20, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', 'b73c5789-9463-41a1-9e74-3459161da25f'::uuid, 21, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', 'c52d5b1a-4c29-47cb-a46f-3059c330686d'::uuid, 22, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', '9bd094e4-7085-4779-a2f8-4be7e3041288'::uuid, 23, NULL),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', '3bc34859-27df-4ff7-b66e-b2656f3f7878'::uuid, 24, NULL)
	) AS v(paper_title, book_id, sort_order, notes)
	JOIN public.books b ON b.id = v.book_id AND b.deleted_at IS NULL

	UNION ALL

	SELECT v.paper_title, NULL::uuid, e.id, v.sort_order, NULL::text
	FROM (VALUES
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', '035fe18a-e02b-4702-87a6-fa8eeb5faf01'::uuid, 'Parallelism', 2),
		('Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9', '8a7588f1-ddeb-402d-b639-a9546ca451b6'::uuid, 'To the Reader of Proverbs', 4),
		('When the LORD Sees To It, the LORD Is Seen: An Exegetical Paper on Genesis 22:1-19', '5cc86a2f-fd7e-4e59-a7b5-cda3adad2669'::uuid, 'Genesis', 3),
		('When the LORD Sees To It, the LORD Is Seen: An Exegetical Paper on Genesis 22:1-19', '20c4e983-6889-4190-970e-399cc919dc4a'::uuid, 'Galatians', 7),
		('The LORD Is Sending a Messenger to Guard You and Go Before You: An Exegetical Paper on Exodus 23:20-33', '5cc86a2f-fd7e-4e59-a7b5-cda3adad2669'::uuid, 'Exodus', 3),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', '241b0487-5b2e-4129-832e-47423f1d53e7'::uuid, 'Shechem', 10),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', '241b0487-5b2e-4129-832e-47423f1d53e7'::uuid, 'Rehoboam', 13),
		('And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12', '241b0487-5b2e-4129-832e-47423f1d53e7'::uuid, 'Jeroboam', 18)
	) AS v(paper_title, parent_book_id, essay_title, sort_order)
	JOIN public.essays e ON e.deleted_at IS NULL
		AND e.parent_book_id = v.parent_book_id
		AND e.essay_title = v.essay_title

	UNION ALL

	SELECT
		'And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12',
		b.id,
		NULL::uuid,
		3,
		b.personal_notes
	FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.series_id IS NULL
		AND b.title = 'Hermeneutics of Voice: Counter-Reading 1 Kings 12 from an Indigenous Perspective'

	UNION ALL

	SELECT
		'And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12',
		b.id,
		NULL::uuid,
		7,
		b.personal_notes
	FROM public.books b
	WHERE b.deleted_at IS NULL
		AND b.series_id IS NULL
		AND b.title = 'Royal Officials and Court Families: A New Look at the ילדים (Yĕlādîm) in 1 Kings 12'

	UNION ALL

	SELECT
		'And They Heard the Word of the LORD, and They Returned: A Literary Exposition of 1 Kings 12',
		b.id,
		NULL::uuid,
		12,
		NULL::text
	FROM public.books b
	JOIN public.series s ON s.id = b.series_id AND s.abbreviation = 'HBC' AND s.deleted_at IS NULL
	WHERE b.deleted_at IS NULL AND b.title = '1 & 2 Kings'
) AS src ON src.paper_title = paper.title
WHERE paper.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.study_sources existing
		WHERE existing.deleted_at IS NULL
			AND existing.paper_id = paper.id
			AND existing.book_id IS NOT DISTINCT FROM src.book_id
			AND existing.essay_id IS NOT DISTINCT FROM src.essay_id
	);
