-- Keil & Delitzsch: one Hendrickson 1996 set, author per volume, biblical-book essays.
-- Bibliography stays the volume. Footnotes name the book via essays.
-- Psalms (vol 5) and Isaiah (vol 7) are already one book per volume — no essay.
-- Book-level bible coverage stays so the library list filter still finds the volumes.
-- Essay-level coverage lets /sermons/by-book prefer the part (existing preferEssayHits).

-- ---------------------------------------------------------------------------
-- Imprint: edition year is 1996 (Peabody: Hendrickson), including vol 8.
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	year = 1996,
	publisher = 'Hendrickson',
	publisher_id = '7a6522d0-e634-42c6-83a7-7cd674832a21',
	publisher_location = 'Peabody, MA',
	updated_at = now()
FROM public.series s
WHERE b.series_id = s.id
	AND s.abbreviation = 'K&D'
	AND s.deleted_at IS NULL
	AND b.deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Volume authors. Vol 4 keeps both (Keil: Ezra, Nehemiah, Esther; Delitzsch: Job).
-- ---------------------------------------------------------------------------
DELETE FROM public.book_authors ba
USING public.books b
JOIN public.series s ON s.id = b.series_id AND s.abbreviation = 'K&D' AND s.deleted_at IS NULL
WHERE ba.book_id = b.id
	AND b.deleted_at IS NULL
	AND b.volume_number IN ('1', '2', '3', '8', '9', '10')
	AND ba.person_id = 'c00f1e86-1481-42c6-9f41-76ff4cac89c0';

DELETE FROM public.book_authors ba
USING public.books b
JOIN public.series s ON s.id = b.series_id AND s.abbreviation = 'K&D' AND s.deleted_at IS NULL
WHERE ba.book_id = b.id
	AND b.deleted_at IS NULL
	AND b.volume_number IN ('5', '6', '7')
	AND ba.person_id = '17656da7-3170-4281-9d80-75cf8c01d0a2';

-- ---------------------------------------------------------------------------
-- Biblical-book parts. created_at steps so the essay list follows canon order
-- (page_start is unknown; the loader orders null pages by created_at).
-- ---------------------------------------------------------------------------
INSERT INTO public.essays (essay_title, parent_book_id, created_by, created_at)
SELECT
	v.essay_title,
	v.book_id,
	b.created_by,
	timestamptz '2026-10-15 18:00:00+00' + (v.ord * interval '1 second')
FROM (
	VALUES
		(1, 'Genesis', 'f3dd4dd5-e1cc-4e25-8dc2-1c17c93046fe'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(2, 'Exodus', 'f3dd4dd5-e1cc-4e25-8dc2-1c17c93046fe'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(3, 'Leviticus', 'f3dd4dd5-e1cc-4e25-8dc2-1c17c93046fe'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(4, 'Numbers', 'f3dd4dd5-e1cc-4e25-8dc2-1c17c93046fe'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(5, 'Deuteronomy', 'f3dd4dd5-e1cc-4e25-8dc2-1c17c93046fe'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(6, 'Joshua', '7c8876a4-bf67-4518-a23f-6ca2a45a9ad6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(7, 'Judges', '7c8876a4-bf67-4518-a23f-6ca2a45a9ad6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(8, 'Ruth', '7c8876a4-bf67-4518-a23f-6ca2a45a9ad6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(9, '1 Samuel', '7c8876a4-bf67-4518-a23f-6ca2a45a9ad6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(10, '2 Samuel', '7c8876a4-bf67-4518-a23f-6ca2a45a9ad6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(11, '1 Kings', '976de395-1e0e-41d5-82ed-eacf1c701229'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(12, '2 Kings', '976de395-1e0e-41d5-82ed-eacf1c701229'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(13, '1 Chronicles', '976de395-1e0e-41d5-82ed-eacf1c701229'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(14, '2 Chronicles', '976de395-1e0e-41d5-82ed-eacf1c701229'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(15, 'Ezra', 'efc8cfef-b26f-46cf-9c0a-96f6cc711f9c'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(16, 'Nehemiah', 'efc8cfef-b26f-46cf-9c0a-96f6cc711f9c'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(17, 'Esther', 'efc8cfef-b26f-46cf-9c0a-96f6cc711f9c'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(18, 'Job', 'efc8cfef-b26f-46cf-9c0a-96f6cc711f9c'::uuid, 'c00f1e86-1481-42c6-9f41-76ff4cac89c0'::uuid),
		(19, 'Proverbs', '74158069-b8b1-435b-8f61-f70592c7327f'::uuid, 'c00f1e86-1481-42c6-9f41-76ff4cac89c0'::uuid),
		(20, 'Ecclesiastes', '74158069-b8b1-435b-8f61-f70592c7327f'::uuid, 'c00f1e86-1481-42c6-9f41-76ff4cac89c0'::uuid),
		(21, 'Song of Songs', '74158069-b8b1-435b-8f61-f70592c7327f'::uuid, 'c00f1e86-1481-42c6-9f41-76ff4cac89c0'::uuid),
		(22, 'Jeremiah', '24fd6b7c-daca-457e-bcf3-ccfa33490441'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(23, 'Lamentations', '24fd6b7c-daca-457e-bcf3-ccfa33490441'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(24, 'Ezekiel', 'd777380a-eaf9-4089-81e0-9c52a8ccc38d'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(25, 'Daniel', 'd777380a-eaf9-4089-81e0-9c52a8ccc38d'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(26, 'Hosea', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(27, 'Joel', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(28, 'Amos', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(29, 'Obadiah', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(30, 'Jonah', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(31, 'Micah', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(32, 'Nahum', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(33, 'Habakkuk', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(34, 'Zephaniah', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(35, 'Haggai', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(36, 'Zechariah', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		(37, 'Malachi', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid)
) AS v(ord, essay_title, book_id, author_id)
JOIN public.books b ON b.id = v.book_id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1
	FROM public.essays e
	WHERE e.parent_book_id = v.book_id
		AND e.essay_title = v.essay_title
		AND e.deleted_at IS NULL
);

INSERT INTO public.essay_authors (essay_id, person_id, role, sort_order)
SELECT e.id, v.author_id, 'author', 0
FROM (
	VALUES
		('Genesis', 'f3dd4dd5-e1cc-4e25-8dc2-1c17c93046fe'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Exodus', 'f3dd4dd5-e1cc-4e25-8dc2-1c17c93046fe'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Leviticus', 'f3dd4dd5-e1cc-4e25-8dc2-1c17c93046fe'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Numbers', 'f3dd4dd5-e1cc-4e25-8dc2-1c17c93046fe'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Deuteronomy', 'f3dd4dd5-e1cc-4e25-8dc2-1c17c93046fe'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Joshua', '7c8876a4-bf67-4518-a23f-6ca2a45a9ad6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Judges', '7c8876a4-bf67-4518-a23f-6ca2a45a9ad6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Ruth', '7c8876a4-bf67-4518-a23f-6ca2a45a9ad6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('1 Samuel', '7c8876a4-bf67-4518-a23f-6ca2a45a9ad6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('2 Samuel', '7c8876a4-bf67-4518-a23f-6ca2a45a9ad6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('1 Kings', '976de395-1e0e-41d5-82ed-eacf1c701229'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('2 Kings', '976de395-1e0e-41d5-82ed-eacf1c701229'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('1 Chronicles', '976de395-1e0e-41d5-82ed-eacf1c701229'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('2 Chronicles', '976de395-1e0e-41d5-82ed-eacf1c701229'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Ezra', 'efc8cfef-b26f-46cf-9c0a-96f6cc711f9c'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Nehemiah', 'efc8cfef-b26f-46cf-9c0a-96f6cc711f9c'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Esther', 'efc8cfef-b26f-46cf-9c0a-96f6cc711f9c'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Job', 'efc8cfef-b26f-46cf-9c0a-96f6cc711f9c'::uuid, 'c00f1e86-1481-42c6-9f41-76ff4cac89c0'::uuid),
		('Proverbs', '74158069-b8b1-435b-8f61-f70592c7327f'::uuid, 'c00f1e86-1481-42c6-9f41-76ff4cac89c0'::uuid),
		('Ecclesiastes', '74158069-b8b1-435b-8f61-f70592c7327f'::uuid, 'c00f1e86-1481-42c6-9f41-76ff4cac89c0'::uuid),
		('Song of Songs', '74158069-b8b1-435b-8f61-f70592c7327f'::uuid, 'c00f1e86-1481-42c6-9f41-76ff4cac89c0'::uuid),
		('Jeremiah', '24fd6b7c-daca-457e-bcf3-ccfa33490441'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Lamentations', '24fd6b7c-daca-457e-bcf3-ccfa33490441'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Ezekiel', 'd777380a-eaf9-4089-81e0-9c52a8ccc38d'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Daniel', 'd777380a-eaf9-4089-81e0-9c52a8ccc38d'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Hosea', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Joel', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Amos', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Obadiah', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Jonah', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Micah', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Nahum', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Habakkuk', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Zephaniah', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Haggai', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Zechariah', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid),
		('Malachi', '0e25726d-f773-4117-96d2-b097850c31e6'::uuid, '17656da7-3170-4281-9d80-75cf8c01d0a2'::uuid)
) AS v(essay_title, book_id, author_id)
JOIN public.essays e
	ON e.parent_book_id = v.book_id
	AND e.essay_title = v.essay_title
	AND e.deleted_at IS NULL
ON CONFLICT (essay_id, person_id) DO NOTHING;

INSERT INTO public.book_bible_coverage (essay_id, bible_book, created_by)
SELECT e.id, e.essay_title, e.created_by
FROM public.essays e
JOIN public.books b
	ON b.id = e.parent_book_id
	AND b.deleted_at IS NULL
JOIN public.series s
	ON s.id = b.series_id
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'K&D'
JOIN public.bible_books bb
	ON bb.name = e.essay_title
WHERE e.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM public.book_bible_coverage bbc
		WHERE bbc.essay_id = e.id
			AND bbc.bible_book = e.essay_title
	);
