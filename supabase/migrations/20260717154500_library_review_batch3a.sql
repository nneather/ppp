-- Review queue Batch 3a: shelf-tag incomplete pub-meta; residual fills;
-- bulk-accept clear AI genre proposals (Literature / Biography / Business /
-- Drama / History) with drama-play overrides.

-- ---------------------------------------------------------------------------
-- Shelf-tag incomplete year/publisher (keep needs_review; route to Needs the shelf)
-- ---------------------------------------------------------------------------

UPDATE public.books
SET
	needs_review = true,
	needs_review_note = CASE
		WHEN needs_review_note IS NULL OR btrim(needs_review_note) = '' THEN 'Verify at shelf'
		WHEN needs_review_note ILIKE '%shelf%' THEN needs_review_note
		ELSE needs_review_note || E'\n\nVerify at shelf'
	END,
	updated_at = now()
WHERE deleted_at IS NULL
	AND needs_review
	AND id IN (
		'9debc227-358f-4684-9ee4-66fe528cd8e2', -- Alt deutscher Witz
		'e41bf543-8b19-40f7-b5d9-8097956608a1', -- Athletic Performance Manual
		'89d894e4-0c38-48b0-90fd-6eb10a96deef', -- Luther Galatians
		'4cd01c6c-ed59-433b-a34e-80ac00c8441d', -- Gesangbuch
		'12e949a7-937d-414f-bc3a-c206424e85de', -- Liederlust
		'569e58d9-342a-4628-9f1f-0de75848bfae', -- Davidis Koch Buch
		'11e24726-616e-4321-8dd4-196c1e8f447b', -- Adventure Bible
		'91dabb7b-7e4d-453a-9c5c-dbad0b0f3f0c'  -- Bhagavad Gita
	);

-- ---------------------------------------------------------------------------
-- Residual clears / fills
-- ---------------------------------------------------------------------------

-- Great Writers: fix author spellings; clear review
UPDATE public.people
SET last_name = 'Shelley', updated_at = now()
WHERE id = '334697bb-98e6-4d94-8250-d64723e9a48e' AND deleted_at IS NULL;

UPDATE public.people
SET last_name = 'Dickinson', updated_at = now()
WHERE id = '9542172a-cc3d-4681-9926-b916c28df17a' AND deleted_at IS NULL;

UPDATE public.books
SET needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id IN (
	'6a85cb88-b759-409b-9650-0d72d485318f',
	'59c90775-7cad-4f5a-9de1-c73d996b021b'
)
AND deleted_at IS NULL;

-- Time Thief → Literature
UPDATE public.books
SET genre = 'Literature', needs_review = false, needs_review_note = NULL, updated_at = now()
WHERE id = 'd7f12ac3-9db3-4d06-909d-b5c24006de76' AND deleted_at IS NULL;

-- Pocket Dictionary NT Greek (DeMoss)
UPDATE public.books
SET
	isbn = '9780830814640',
	year = 2001,
	publisher = 'IVP Academic',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '4fda7ecf-cb06-4987-abb7-b6ede8d8a778' AND deleted_at IS NULL;

-- New Unger's Bible Handbook
UPDATE public.books
SET
	publisher = 'Moody Publishers',
	year = 2005,
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '2f483273-5dac-46b4-95bd-fdce9f42a318' AND deleted_at IS NULL;

-- IVP Background Commentary OT
UPDATE public.books
SET
	isbn = '9780830814190',
	year = 2000,
	publisher = 'IVP Academic',
	needs_review = false,
	needs_review_note = NULL,
	updated_at = now()
WHERE id = '563393a2-029a-4f9a-a15f-afaee072337a' AND deleted_at IS NULL;

-- IVP Background Commentary NT is Keener (not Walton et al.)
DO $$
DECLARE
	v_book uuid := '43a91670-3ddc-4f00-b4bc-e32cfaf754a6';
	v_keener uuid := '46cc22dd-c0e6-4781-9208-7e163de198ca';
BEGIN
	DELETE FROM public.book_authors WHERE book_id = v_book;
	INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
	VALUES (v_book, v_keener, 'author', 1);

	UPDATE public.books
	SET
		isbn = '9780830824786',
		year = 2014,
		publisher = 'IVP Academic',
		edition = '2nd ed.',
		needs_review = false,
		needs_review_note = NULL,
		updated_at = now()
	WHERE id = v_book AND deleted_at IS NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Bulk-accept AI genre proposals (genre-only accept path)
-- ---------------------------------------------------------------------------

WITH accepted AS (
	UPDATE public.books b
	SET
		genre = p.fields->'genre'->>'proposed',
		needs_review = false,
		needs_review_note = NULL,
		updated_at = now()
	FROM public.book_metadata_proposals p
	WHERE p.book_id = b.id
		AND p.deleted_at IS NULL
		AND p.status = 'pending'
		AND b.deleted_at IS NULL
		AND b.needs_review
		AND (b.needs_review_note IS NULL OR b.needs_review_note NOT ILIKE '%shelf%')
		AND p.fields ? 'genre'
		AND p.fields->'genre'->>'proposed' IN (
			'Literature', 'Biography', 'Business', 'Drama', 'History'
		)
		-- Hold ambiguous / boundary cases for Batch 3 questions
		AND b.id NOT IN (
			-- Drama plays mis-tagged Literature
			'1993daa1-7a20-4ad4-a167-cd1d6f7f5d25', -- Death of a Salesman
			'cdd2de33-0883-45ae-ae8c-ac3edf900f60', -- Hamlet
			'3d6fb85d-396d-4410-bf64-d02d1d025819', -- Macbeth
			'a39d6cc8-813d-4096-89f3-35ded731b6d4', -- Julius Caesar
			'6ead1474-87ee-4ad1-b8f5-2075015e59e4', -- Our Town
			'1cfd5890-fe7c-49a9-93f7-853db5e8b7a0', -- Much Ado
			'f24b4b14-fa3f-4892-a9d4-4085381458c5', -- Die Dreigroschenoper
			'3a2539aa-0f3d-4d34-82e2-4e8a6dea15a0', -- Die Räuber
			-- Boundary / ask
			'fe774b50-4522-47bd-b331-c649eedb7b21', -- Eat That Frog
			'54921a91-a735-45ca-a134-5436706de29c', -- Getting Things Done
			'59790f60-bbfe-4f00-8dc7-2911fde7f60e', -- How to Win Friends
			'c8982ab4-26fc-4b77-8c7b-0664345e232f', -- Primal Leadership
			'a663980d-53d6-42b6-a86a-d0a9699aa889', -- Strengths Based Leadership
			'5007de84-a6cd-4e4c-b951-548663810485', -- Tribal Leadership
			'f87f89fd-5779-44cc-a40e-fe6ff96b87b2', -- One Minute Manager
			'5ee4f534-7ceb-4c7e-a81c-0f7a3334d5d5', -- Wealth of Nations
			'304fa08a-a1f1-4d2c-92b6-b4b740c25055', -- Common Sense
			'b5610825-f1c5-467a-bebb-478b9790d256', -- Democracy in America I
			'85cc19fc-d6eb-494f-8d51-be0644e07df4', -- Democracy in America II
			'921fd07c-179a-44e2-995b-f74541ca7a09', -- Paul Apostle Heart Set Free
			'dfbe6f73-9297-464d-9c19-3c89dc324607', -- Widerstand und Ergebung
			'6f1cb8a5-3c0b-4b18-b0af-3380f4f76595', -- John Williamson Nevin
			'8dd12a74-405e-494f-bb51-23734fb0f3c4', -- Caesar and Christ
			'e9d422bd-2f0d-46ab-974f-90885b5236a8', -- The Keener Side
			'86e804bd-d92c-488f-aa2b-8da70ad6c792', -- For Parker, Love Mom
			'87dbb6f5-9c9f-42a9-bb76-7f870ac6c6e4', -- Literary Theory
			'857d5305-7d03-418d-b6e7-ca2cf1773be7', -- Experiment in Criticism
			'389e27f1-ca7d-448f-b435-085801599ea6', -- Preface to Paradise Lost
			'8326711f-dadc-41d3-916c-36ff38d61c5a'  -- Deutschland Wintermärchen (Poetry?)
		)
	RETURNING b.id
)
UPDATE public.book_metadata_proposals p
SET
	status = 'accepted',
	reviewed_at = now(),
	updated_at = now()
WHERE p.book_id IN (SELECT id FROM accepted)
	AND p.deleted_at IS NULL
	AND p.status = 'pending';

-- Drama overrides for plays currently proposed as Literature
WITH drama AS (
	UPDATE public.books b
	SET
		genre = 'Drama',
		needs_review = false,
		needs_review_note = NULL,
		updated_at = now()
	FROM public.book_metadata_proposals p
	WHERE p.book_id = b.id
		AND p.deleted_at IS NULL
		AND p.status = 'pending'
		AND b.deleted_at IS NULL
		AND b.id IN (
			'1993daa1-7a20-4ad4-a167-cd1d6f7f5d25',
			'cdd2de33-0883-45ae-ae8c-ac3edf900f60',
			'3d6fb85d-396d-4410-bf64-d02d1d025819',
			'a39d6cc8-813d-4096-89f3-35ded731b6d4',
			'6ead1474-87ee-4ad1-b8f5-2075015e59e4',
			'1cfd5890-fe7c-49a9-93f7-853db5e8b7a0',
			'f24b4b14-fa3f-4892-a9d4-4085381458c5',
			'3a2539aa-0f3d-4d34-82e2-4e8a6dea15a0'
		)
	RETURNING b.id
)
UPDATE public.book_metadata_proposals p
SET
	status = 'accepted',
	reviewed_at = now(),
	updated_at = now()
WHERE p.book_id IN (SELECT id FROM drama)
	AND p.deleted_at IS NULL
	AND p.status = 'pending';

-- Also accept the three already-proposed Drama titles
WITH drama2 AS (
	UPDATE public.books b
	SET
		genre = 'Drama',
		needs_review = false,
		needs_review_note = NULL,
		updated_at = now()
	FROM public.book_metadata_proposals p
	WHERE p.book_id = b.id
		AND p.deleted_at IS NULL
		AND p.status = 'pending'
		AND b.deleted_at IS NULL
		AND p.fields->'genre'->>'proposed' = 'Drama'
	RETURNING b.id
)
UPDATE public.book_metadata_proposals p
SET
	status = 'accepted',
	reviewed_at = now(),
	updated_at = now()
WHERE p.book_id IN (SELECT id FROM drama2)
	AND p.deleted_at IS NULL
	AND p.status = 'pending';
