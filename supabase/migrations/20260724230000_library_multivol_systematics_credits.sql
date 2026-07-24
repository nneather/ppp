-- library_multivol_systematics_credits: Calvin / Synopsis / Mastricht / Bavinck / Turretin
-- House style: clean work title + volume_number (+ subtitle for part titles) + total_volumes.
-- Self-named series: include_in_citation = false. Turretin keep newer vol III; soft-delete older.
-- Idempotent. Hosted push only. Owner confirm 2026-07-24.

-- ---------------------------------------------------------------------------
-- People (editors / translators)
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name, suffix, created_by)
SELECT v.first_name, v.middle_name, v.last_name, v.suffix, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Henry', NULL::text, 'Beveridge', NULL::text),
	('Todd', 'M.', 'Rester', NULL::text),
	('Joel', 'R.', 'Beeke', NULL::text),
	('John', NULL::text, 'Bolt', NULL::text),
	('John', NULL::text, 'Vriend', NULL::text),
	('George', 'Musgrave', 'Giger', NULL::text),
	('James', 'T.', 'Dennison', 'Jr.')
) AS v(first_name, middle_name, last_name, suffix)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
		AND COALESCE(p.suffix, '') = COALESCE(v.suffix, '')
);

-- ---------------------------------------------------------------------------
-- Series: omit self-named catalog series from Turabian strings
-- ---------------------------------------------------------------------------
UPDATE public.series s
SET include_in_citation = false
WHERE s.deleted_at IS NULL
	AND s.abbreviation IN ('INST', 'SPT', 'TPT', 'RD', 'IET')
	AND s.include_in_citation IS DISTINCT FROM false;

-- ---------------------------------------------------------------------------
-- Calvin WJK McNeill/Battles (2 vols)
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	title = 'Institutes of the Christian Religion',
	subtitle = NULL,
	volume_number = v.vol,
	total_volumes = 2,
	updated_at = now()
FROM (VALUES
	('d361cec2-6689-41c2-a27a-e940f5adf65b'::uuid, '1'),
	('a60309ed-1172-4da0-acdd-daa3c0bee404'::uuid, '2')
) AS v(id, vol)
WHERE b.id = v.id
	AND b.deleted_at IS NULL
	AND (
		b.title IS DISTINCT FROM 'Institutes of the Christian Religion'
		OR b.subtitle IS DISTINCT FROM NULL
		OR b.volume_number IS DISTINCT FROM v.vol
		OR b.total_volumes IS DISTINCT FROM 2
	);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('d361cec2-6689-41c2-a27a-e940f5adf65b'::uuid, 'John', 'T.', 'McNeill', NULL::text, 'editor', 2),
	('d361cec2-6689-41c2-a27a-e940f5adf65b'::uuid, 'Ford', 'Lewis', 'Battles', NULL::text, 'translator', 3),
	('a60309ed-1172-4da0-acdd-daa3c0bee404'::uuid, 'John', 'T.', 'McNeill', NULL::text, 'editor', 2),
	('a60309ed-1172-4da0-acdd-daa3c0bee404'::uuid, 'Ford', 'Lewis', 'Battles', NULL::text, 'translator', 3)
) AS v(book_id, first_name, middle_name, last_name, suffix, role, sort_order)
JOIN public.books b ON b.id = v.book_id AND b.deleted_at IS NULL
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
	AND COALESCE(p.suffix, '') = COALESCE(v.suffix, '')
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id AND ba.role = v.role
);

-- ---------------------------------------------------------------------------
-- Calvin Hendrickson (Beveridge) — Henry, not Albert J.
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	edition = NULL,
	updated_at = now()
WHERE b.id = 'a97a8327-b840-4a0c-8e5b-29d98a905cbd'::uuid
	AND b.deleted_at IS NULL
	AND b.edition IS DISTINCT FROM NULL;

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'translator', 2
FROM public.books b
JOIN public.people p ON p.deleted_at IS NULL
	AND p.first_name = 'Henry'
	AND p.middle_name IS NULL
	AND p.last_name = 'Beveridge'
	AND p.suffix IS NULL
WHERE b.id = 'a97a8327-b840-4a0c-8e5b-29d98a905cbd'::uuid
	AND b.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM public.book_authors ba
		WHERE ba.book_id = b.id AND ba.person_id = p.id AND ba.role = 'translator'
	);

-- ---------------------------------------------------------------------------
-- Brill Synopsis — author-led monograph + part subtitles
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	title = 'Synopsis of a Purer Theology',
	subtitle = v.subtitle,
	volume_number = v.vol,
	total_volumes = 3,
	work_type = 'monograph',
	updated_at = now()
FROM (VALUES
	('a06e57d1-c4f0-44c0-96ca-1212f9e3dfa2'::uuid, '1', 'Disputations 1–23'),
	('62ecc732-941a-4b44-84bd-b3e7844eea81'::uuid, '2', 'Disputations 24–42'),
	('3d5bbdaa-5cba-48ef-90f0-d6f390e188b5'::uuid, '3', 'Disputations 43–52')
) AS v(id, vol, subtitle)
WHERE b.id = v.id
	AND b.deleted_at IS NULL
	AND (
		b.title IS DISTINCT FROM 'Synopsis of a Purer Theology'
		OR b.subtitle IS DISTINCT FROM v.subtitle
		OR b.volume_number IS DISTINCT FROM v.vol
		OR b.total_volumes IS DISTINCT FROM 3
		OR b.work_type IS DISTINCT FROM 'monograph'
	);

-- ---------------------------------------------------------------------------
-- Van Mastricht TPT — Rester + Beeke; part subtitles
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	title = 'Theoretical-Practical Theology',
	subtitle = v.subtitle,
	volume_number = v.vol,
	total_volumes = 5,
	updated_at = now()
FROM (VALUES
	('6bbee0cb-abf6-4cf8-8c8e-a156b5244125'::uuid, '1', 'Prolegomena'),
	('8650d747-ca08-42a3-a2ba-f3a1ca19c9fb'::uuid, '2', 'Faith in the Triune God'),
	('3ee7129d-8707-4ef0-9815-790f372ecd8c'::uuid, '3', 'The Works of God and the Fall of Man'),
	('eab8be36-705e-4332-871d-e96226fa7cfc'::uuid, '4', 'Redemption in Christ'),
	('49a4e6ec-4d57-4d8e-95df-09fb1157145c'::uuid, '5', 'The Application of Redemption and the Church')
) AS v(id, vol, subtitle)
WHERE b.id = v.id
	AND b.deleted_at IS NULL
	AND (
		b.title IS DISTINCT FROM 'Theoretical-Practical Theology'
		OR b.subtitle IS DISTINCT FROM v.subtitle
		OR b.volume_number IS DISTINCT FROM v.vol
		OR b.total_volumes IS DISTINCT FROM 5
	);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('6bbee0cb-abf6-4cf8-8c8e-a156b5244125'::uuid),
	('8650d747-ca08-42a3-a2ba-f3a1ca19c9fb'::uuid),
	('3ee7129d-8707-4ef0-9815-790f372ecd8c'::uuid),
	('eab8be36-705e-4332-871d-e96226fa7cfc'::uuid),
	('49a4e6ec-4d57-4d8e-95df-09fb1157145c'::uuid)
) AS books(book_id)
CROSS JOIN (VALUES
	('Todd', 'M.', 'Rester', NULL::text, 'translator', 2),
	('Joel', 'R.', 'Beeke', NULL::text, 'editor', 3)
) AS v(first_name, middle_name, last_name, suffix, role, sort_order)
JOIN public.books b ON b.id = books.book_id AND b.deleted_at IS NULL
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
	AND COALESCE(p.suffix, '') = COALESCE(v.suffix, '')
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id AND ba.role = v.role
);

-- ---------------------------------------------------------------------------
-- Bavinck RD — Bolt + Vriend; part subtitles
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	title = 'Reformed Dogmatics',
	subtitle = v.subtitle,
	volume_number = v.vol,
	total_volumes = 4,
	updated_at = now()
FROM (VALUES
	('dfd01ed5-5158-4fca-8ce8-41dfb1a8921a'::uuid, '1', 'Prolegomena'),
	('ab764f02-d09e-4a12-b610-90ebd1b21761'::uuid, '2', 'God and Creation'),
	('5b2c1bd7-bf02-428e-87b3-8aa81142a7d2'::uuid, '3', 'Sin and Salvation in Christ'),
	('d29ccc81-e593-476a-b139-6c36034f71cc'::uuid, '4', 'Holy Spirit, Church, and New Creation')
) AS v(id, vol, subtitle)
WHERE b.id = v.id
	AND b.deleted_at IS NULL
	AND (
		b.title IS DISTINCT FROM 'Reformed Dogmatics'
		OR b.subtitle IS DISTINCT FROM v.subtitle
		OR b.volume_number IS DISTINCT FROM v.vol
		OR b.total_volumes IS DISTINCT FROM 4
	);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('dfd01ed5-5158-4fca-8ce8-41dfb1a8921a'::uuid),
	('ab764f02-d09e-4a12-b610-90ebd1b21761'::uuid),
	('5b2c1bd7-bf02-428e-87b3-8aa81142a7d2'::uuid),
	('d29ccc81-e593-476a-b139-6c36034f71cc'::uuid)
) AS books(book_id)
CROSS JOIN (VALUES
	('John', NULL::text, 'Bolt', NULL::text, 'editor', 2),
	('John', NULL::text, 'Vriend', NULL::text, 'translator', 3)
) AS v(first_name, middle_name, last_name, suffix, role, sort_order)
JOIN public.books b ON b.id = books.book_id AND b.deleted_at IS NULL
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
	AND COALESCE(p.suffix, '') = COALESCE(v.suffix, '')
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id AND ba.role = v.role
);

-- ---------------------------------------------------------------------------
-- Turretin IET — keep newer vol III; soft-delete older; Roman volume_number
-- ---------------------------------------------------------------------------

-- Move ISBN from older vol-III row onto the kept newer row (if kept lacks ISBN)
UPDATE public.books keep
SET
	isbn = COALESCE(keep.isbn, older.isbn),
	updated_at = now()
FROM public.books older
WHERE keep.id = 'b73c5789-9463-41a1-9e74-3459161da25f'::uuid
	AND older.id = '4735b182-c838-4b85-8066-d61dadd22250'::uuid
	AND keep.deleted_at IS NULL
	AND older.deleted_at IS NULL
	AND keep.isbn IS NULL
	AND older.isbn IS NOT NULL;

UPDATE public.books
SET deleted_at = now(), updated_at = now()
WHERE id = '4735b182-c838-4b85-8066-d61dadd22250'::uuid
	AND deleted_at IS NULL;

UPDATE public.books b
SET
	title = 'Institutes of Elenctic Theology',
	subtitle = NULL,
	volume_number = v.vol,
	total_volumes = 3,
	year = v.year,
	updated_at = now()
FROM (VALUES
	('93324149-56ef-4602-8a14-1a111d07ed20'::uuid, 'I', 1992),
	('4e87b189-019a-45ad-b469-4455c5aa753d'::uuid, 'II', 1994),
	('b73c5789-9463-41a1-9e74-3459161da25f'::uuid, 'III', 1997)
) AS v(id, vol, year)
WHERE b.id = v.id
	AND b.deleted_at IS NULL
	AND (
		b.title IS DISTINCT FROM 'Institutes of Elenctic Theology'
		OR b.subtitle IS DISTINCT FROM NULL
		OR b.volume_number IS DISTINCT FROM v.vol
		OR b.total_volumes IS DISTINCT FROM 3
		OR b.year IS DISTINCT FROM v.year
	);

INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, v.role, v.sort_order
FROM (VALUES
	('93324149-56ef-4602-8a14-1a111d07ed20'::uuid),
	('4e87b189-019a-45ad-b469-4455c5aa753d'::uuid),
	('b73c5789-9463-41a1-9e74-3459161da25f'::uuid)
) AS books(book_id)
CROSS JOIN (VALUES
	('George', 'Musgrave', 'Giger', NULL::text, 'translator', 2),
	('James', 'T.', 'Dennison', 'Jr.', 'editor', 3)
) AS v(first_name, middle_name, last_name, suffix, role, sort_order)
JOIN public.books b ON b.id = books.book_id AND b.deleted_at IS NULL
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
	AND COALESCE(p.suffix, '') = COALESCE(v.suffix, '')
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id AND ba.role = v.role
);
