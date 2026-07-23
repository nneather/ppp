-- library_commentary_consistency_batch5
-- Owner-confirmed (A/B/C review lists):
--   A: Calvin CC 22-vol Baker/Trinity map; shelf-flag remaining multi-vol/reprint items
--   B: Spurgeon Treasury detach from SS; EGGNT Mark/Merkle/Quarles/Harris → B&H;
--      soft-delete Wright UBCS (keep NIBC)
--   C: standalones stay standalone (no DML)

-- ---------------------------------------------------------------------------
-- A: Calvin's Commentaries — Trinity/Baker 22-vol enumeration
-- https://www.trinitybookservice.com/calvins-commentaries-22-volume-set/
-- Titles kept as recorded; volume_number only. Non-Baker imprints also shelf-flagged.
-- ---------------------------------------------------------------------------
UPDATE public.books AS b
SET
	volume_number = v.vol,
	updated_at = now()
FROM (
	VALUES
		('68e1fe80-b013-428a-ac03-46c07b58f855'::uuid, '1'),   -- Genesis (Banner 1965 imprint)
		('a0b67590-f240-4315-8a7e-9b1c4bc1de5c'::uuid, '2'),   -- Exodus harmony pt 1
		('c723b97b-04db-4779-a47a-ef11df38724a'::uuid, '3'),   -- Exodus harmony pt 2
		('8d3cd5ac-00ab-451e-8585-97a73d7bde78'::uuid, '4'),   -- Joshua / Psalms 1-35
		('21fbb41d-a83c-4ae8-8288-c90e258157e1'::uuid, '5'),   -- Psalms 36-92
		('b82e4d27-8ee8-447a-85bd-7632b08d5476'::uuid, '6'),   -- Psalms 93-150 (Eerdmans 1949)
		('4beef45a-d742-4d8f-9b23-020e8702a42a'::uuid, '7'),   -- Isaiah 1-32
		('7772aedc-0d45-42d1-9f08-24be6282d972'::uuid, '8'),   -- Isaiah 33-66 (Trinity: 35-60)
		('530feacb-05be-4e70-b496-f4f4d4639f14'::uuid, '9'),   -- Jeremiah 1-19
		('5c66ccb7-ac03-402c-affe-4a280280597b'::uuid, '10'),  -- Jeremiah 20-47
		('3ded3928-a7b0-4926-8c44-92a2e6e8e9ec'::uuid, '11'),  -- Jer 48-52; Lam; Ezek 1-12
		('f2ef6fa7-f9a4-4d9d-a19b-ff590529a906'::uuid, '12'),  -- Ezek 13-20 & Dan 1-6
		('70ae1833-8d4b-4826-b828-35c2179d94e7'::uuid, '13'),  -- Daniel 7-12; Hosea
		('700be0c0-bfe5-4850-98a6-13f39421c2f9'::uuid, '14'),  -- Joel–Nahum
		('d6361c8c-2b04-4a96-bb4a-caba9fc012e7'::uuid, '15'),  -- Hab–Mal
		('bb8ad6fc-c24f-4828-8f14-94139f5d67ef'::uuid, '16'),  -- Harmony Gospels (CTS 1845)
		('a21f8f78-e6f7-4e88-980e-9fd44ce86a50'::uuid, '17'),  -- Harmony + John 1-11
		('c4a509f4-8f2c-42de-9c82-d6645531299f'::uuid, '18'),  -- John 12-21; Acts 1-13
		('48bacc35-af3d-4623-91af-f5585c867a4b'::uuid, '19'),  -- Acts 14-28; Romans
		('e3099c8b-36d8-4a5f-bd91-56e5b5d1658e'::uuid, '20'),  -- 1–2 Corinthians
		('6674c886-7e32-4790-a04a-b971bff765d1'::uuid, '21'),  -- Galatians–Philemon
		('4651a20b-b178-424f-b31f-68c6fe9edf83'::uuid, '22')   -- Hebrews–Jude
) AS v(id, vol)
WHERE b.id = v.id
	AND b.deleted_at IS NULL;

-- Non-Baker CC imprints + remaining list-A items → Needs the shelf (August STL)
UPDATE public.books
SET
	needs_review = true,
	needs_review_note = CASE
		WHEN id = '68e1fe80-b013-428a-ac03-46c07b58f855' THEN
			'CC vol 1 (Genesis) — Banner of Truth 1965 imprint; confirm vs Baker 22-vol set at shelf'
		WHEN id = 'b82e4d27-8ee8-447a-85bd-7632b08d5476' THEN
			'CC vol 6 (Psalms 93-150) — Eerdmans 1949 imprint; confirm vs Baker 22-vol set at shelf'
		WHEN id = 'bb8ad6fc-c24f-4828-8f14-94139f5d67ef' THEN
			'CC vol 16 (Harmony Matthew–Luke) — CTS 1845 imprint; confirm vs Baker 22-vol set at shelf'
		WHEN id = '67a2bfb4-bb3c-4886-a5eb-49b37588fbdd' THEN
			'EHS MacLaren Genesis — IndyPublish POD; confirm owned imprint/vols at shelf'
		WHEN id = '68d9a795-cf59-415e-8528-911f76f9b31e' THEN
			'EHS MacLaren Psalms II — IndyPublish POD; confirm owned imprint/vols at shelf'
		WHEN id = '3f78e12e-32ad-44c7-b443-2a53313595c6' THEN
			'NIB Acts–1 Corinthians — missing publisher/year/ISBN; confirm Abingdon spine at shelf'
		WHEN id = 'ac63b0a9-9683-44a2-a843-243731ef0101' THEN
			'WBC Arnold Colossians (2025 2nd) — confirm series volume number vs WBC 44 family at shelf'
		WHEN id = 'c52d5b1a-4c29-47cb-a46f-3059c330686d' THEN
			'Berit Olam Walsh 1 Kings — no reliable series enumeration; leave vol null; confirm at shelf'
		WHEN id = '64af0ae5-5765-4e3f-91c2-e1f258353a88' THEN
			'Berit Olam Schaefer Psalms — no reliable series enumeration; leave vol null; confirm at shelf'
		ELSE needs_review_note
	END,
	updated_at = now()
WHERE deleted_at IS NULL
	AND id IN (
		'68e1fe80-b013-428a-ac03-46c07b58f855',
		'b82e4d27-8ee8-447a-85bd-7632b08d5476',
		'bb8ad6fc-c24f-4828-8f14-94139f5d67ef',
		'67a2bfb4-bb3c-4886-a5eb-49b37588fbdd',
		'68d9a795-cf59-415e-8528-911f76f9b31e',
		'3f78e12e-32ad-44c7-b443-2a53313595c6',
		'ac63b0a9-9683-44a2-a843-243731ef0101',
		'c52d5b1a-4c29-47cb-a46f-3059c330686d',
		'64af0ae5-5765-4e3f-91c2-e1f258353a88'
	);

-- ---------------------------------------------------------------------------
-- B: Spurgeon Treasury of David ×3 — detach from SS (Sermons); shelf for vols/imprint
-- ---------------------------------------------------------------------------
UPDATE public.books
SET
	series_id = NULL,
	volume_number = NULL,
	needs_review = true,
	needs_review_note = 'Treasury of David 3-vol set — no series (detached from SS); assign vols 1–3 + confirm MacDonald vs Hendrickson imprint at shelf',
	updated_at = now()
WHERE deleted_at IS NULL
	AND title = 'The Treasury of David'
	AND id IN (
		'17eee4de-43d9-43a1-815d-0eef165d7473',
		'bbed8783-0c7f-4ce3-9676-3aa0e46a44a4',
		'de2a577b-a69a-4fa8-be09-4735dbd24562'
	);

-- ---------------------------------------------------------------------------
-- B: EGGNT imprint corrections → B&H Academic (owner-confirmed prints)
-- ---------------------------------------------------------------------------
UPDATE public.books
SET
	publisher = 'B&H Academic',
	year = 2020,
	isbn = '9781433676093',
	updated_at = now()
WHERE id = '081d7b90-202e-4498-a706-c14daf34a47b'
	AND deleted_at IS NULL;

UPDATE public.books
SET
	publisher = 'B&H Academic',
	year = 2016,
	isbn = '9781433676116',
	updated_at = now()
WHERE id = 'bcf40c29-db0b-4914-a32a-a007801f6bbb'
	AND deleted_at IS NULL;

UPDATE public.books
SET
	publisher = 'B&H Academic',
	year = 2017,
	isbn = '9781433676161',
	updated_at = now()
WHERE id = 'd7b3b357-d83c-4ef7-a0a0-e2b9584a2ec5'
	AND deleted_at IS NULL;

UPDATE public.books
SET
	publisher = 'B&H Academic',
	year = 2015,
	isbn = '9781433676871',
	updated_at = now()
WHERE id = 'd24e98cd-25b9-432d-926f-b236db43616e'
	AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- B: Wright Deuteronomy — soft-delete UBCS; keep NIBC
-- ---------------------------------------------------------------------------
UPDATE public.books
SET
	deleted_at = now(),
	updated_at = now()
WHERE id = 'd31e7efb-71d0-4b4c-9bf4-7b6c2a2827f3'
	AND deleted_at IS NULL;
