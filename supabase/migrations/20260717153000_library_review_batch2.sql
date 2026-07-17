-- Review-queue Batch 2 resolutions (2026-07-17).

-- ---------------------------------------------------------------------------
-- Q5: clear importer verify notes (genre already set)
-- ---------------------------------------------------------------------------

UPDATE public.books
SET needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id IN (
	'0a431bb2-4dc6-4519-8c98-0ad450bef22c', -- Beginning Biblical Hebrew
	'4d8435bc-8b91-474f-b410-f5b8bf7d8afa', -- Harris Colossians and Philemon
	'3ee3ca20-c8d1-4b4b-be8b-69ab396a451e', -- Hendriksen Galatians and Ephesians
	'5f4e0b4a-5b35-4515-b14a-3ea8a1b22aa7'  -- Cotton Mather / Biblia Americana
)
AND deleted_at IS NULL;

-- Ashley NICOT Numbers: drop incorrect "Second" edition
UPDATE public.books
SET
	edition = NULL,
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = 'd755555c-224d-48f3-913a-6e3acfba28e3'
	AND deleted_at IS NULL;

-- Arnold Colossians: keep WBC (confirmed); ISBN was ZECNT-era mismatch.
-- Real work is WBC vol. 44A 2nd ed. (2025).
UPDATE public.books
SET
	isbn = '9780310125211',
	year = 2025,
	publisher = 'Zondervan Academic',
	edition = '2nd ed.',
	series_id = 'bc234727-5b73-45ab-b0bc-a289b304cd86',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = 'ac63b0a9-9683-44a2-a843-243731ef0101'
	AND deleted_at IS NULL;

-- Keyword Study Bible: replace garbage author; ISBN 9780899573328 is a
-- different AMG title ("Key Word Bible Studies on Praise and Worship").
DO $$
DECLARE
	v_owner uuid := 'a14833c9-459e-4667-aef3-dae698734f6d';
	v_zodhiates uuid;
	v_book uuid := 'ae904200-d8d1-4130-9aab-afb5f33c0899';
BEGIN
	SELECT id INTO v_zodhiates
	FROM public.people
	WHERE deleted_at IS NULL
		AND last_name = 'Zodhiates'
		AND first_name = 'Spiros'
	LIMIT 1;

	IF v_zodhiates IS NULL THEN
		INSERT INTO public.people (first_name, last_name, created_by)
		VALUES ('Spiros', 'Zodhiates', v_owner)
		RETURNING id INTO v_zodhiates;
	END IF;

	DELETE FROM public.book_authors WHERE book_id = v_book;

	INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
	VALUES (v_book, v_zodhiates, 'editor', 1);

	UPDATE public.books
	SET
		title = 'Hebrew-Greek Key Word Study Bible',
		isbn = NULL,
		work_type = 'reference_work',
		needs_review = false,
		needs_review_note = NULL,
		updated_at = now()
	WHERE id = v_book
		AND deleted_at IS NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Q6: genre + shelf + Football authors
-- ---------------------------------------------------------------------------

UPDATE public.books
SET genre = 'Philosophy', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id = 'b3dd198c-851f-45e0-8bcd-f2f5a3687bd3' -- Der Deutschenhaß
	AND deleted_at IS NULL;

UPDATE public.books
SET genre = 'Poetry', language = 'german', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id = '69fd1355-58d7-45b3-9aec-7e05fa665731' -- Das zweite Buch der Ernte
	AND deleted_at IS NULL;

UPDATE public.books
SET genre = 'Biography', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id = '9f44c8da-10a1-4d62-bb13-8d8295039bf1' -- Tage in Kunduz
	AND deleted_at IS NULL;

UPDATE public.books
SET
	genre = 'History',
	year = 1919,
	publisher = 'University of Wisconsin',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '26709c14-5c19-49cf-af62-a85f33fe44ed' -- The Badger 1919
	AND deleted_at IS NULL;

UPDATE public.books
SET genre = 'Literature', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id = '223f8fe1-1981-47e9-a1d7-9eef88def0fe' -- Sawmill River Valley War
	AND deleted_at IS NULL;

UPDATE public.books
SET genre = 'Devotional', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id = '6e23a2cf-e525-4bf3-b093-a1d8b6fb4c4c' -- Lasset die Kindlein…
	AND deleted_at IS NULL;

UPDATE public.books
SET genre = 'Business', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id = 'ad53becb-a175-4db3-96f6-8cbb6fb6a45b' -- Designing for Health
	AND deleted_at IS NULL;

-- Theories of Vision: Philosophy + fix author spelling Linderg → Lindberg
UPDATE public.people
SET last_name = 'Lindberg', updated_at = now()
WHERE id = '72fc9c01-6d37-4e82-97c3-e2d8e45508c6'
	AND deleted_at IS NULL;

UPDATE public.books
SET genre = 'Philosophy', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id = '9e9a9693-50a1-4a00-8d7f-94f177a6535f'
	AND deleted_at IS NULL;

-- Start Something New → Needs the shelf
UPDATE public.books
SET
	needs_review = true,
	needs_review_note = 'Verify at shelf — OL title-only match; confirm actual title/edition.',
	updated_at = now()
WHERE id = '3e83a2c9-1408-4c31-9725-2536182b4984'
	AND deleted_at IS NULL;

-- Football Book of Wisdom: drop publisher-as-people authors
DELETE FROM public.book_authors
WHERE book_id = '78c866ad-da75-4fc3-ae3e-49159e53701f'
	AND person_id IN (
		'563869b1-f5bc-4ea5-93fd-d9f02435a474', -- Simon
		'6a8b8beb-0d61-46ef-8b8a-59832dd0fe60'  -- Schuster
	);

UPDATE public.books
SET
	no_attributed_author = true,
	updated_at = now()
WHERE id = '78c866ad-da75-4fc3-ae3e-49159e53701f'
	AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Q7: Urbana 18 Bible — 13 copies; fill what we can; keep review for shelf ISBN/translation
-- ---------------------------------------------------------------------------

DELETE FROM public.book_authors
WHERE book_id = '6cda7392-2c38-41ce-a5e2-2c5a50808c78'
	AND person_id = '55581868-eadc-4848-a42b-c94b666dc58f'; -- "Version, New"

UPDATE public.books
SET
	copy_count = 13,
	year = 2018,
	publisher = 'InterVarsity Press',
	no_attributed_author = true,
	work_type = 'reference_work',
	needs_review = true,
	needs_review_note = 'Verify at shelf — confirm translation and ISBN (Urbana 18 conference Bible; 13 copies).',
	updated_at = now()
WHERE id = '6cda7392-2c38-41ce-a5e2-2c5a50808c78'
	AND deleted_at IS NULL;
