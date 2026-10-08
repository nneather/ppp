-- library_ivp_dictionaries: DNTB, DJG 2nd, DOTP, DLNT, DOTPr
-- (owner confirm 2026-10-07). Existing DJG row is the 1992 1st edition
-- (Green / McKnight / Marshall) but was stored with the 2013 ISBN and year.
-- Correct that row, then insert the 2nd edition. Same split as DPL / DPL2:
-- key by ISBN, not title+series. Hosted push only. DML-only (no gen-types).

-- ---------------------------------------------------------------------------
-- People (new). Existing: Evans, Green, McKnight, Marshall, Alexander, Boda,
-- Martin, Davids.
-- ---------------------------------------------------------------------------
INSERT INTO public.people (first_name, middle_name, last_name, created_by)
SELECT v.first_name, v.middle_name, v.last_name, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Stanley', 'E.', 'Porter'),
	('Jeannine', 'K.', 'Brown'),
	('Nicholas', NULL::text, 'Perrin'),
	('David', 'W.', 'Baker'),
	('J.', 'Gordon', 'McConville')
) AS v(first_name, middle_name, last_name)
WHERE NOT EXISTS (
	SELECT 1 FROM public.people p
	WHERE p.deleted_at IS NULL
		AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
		AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
		AND p.last_name = v.last_name
);

-- ---------------------------------------------------------------------------
-- DJG 1st: the shelf copy already in the catalog. Restore 1992 / 9780830817771.
-- Editors already on the row (Green, McKnight, Marshall). Citation stays DJG.
-- ---------------------------------------------------------------------------
UPDATE public.books
SET
	year = 1992,
	isbn = '9780830817771',
	edition = 'First',
	citation_abbreviation = 'DJG',
	updated_at = now()
WHERE id = '09696579-b466-4440-bcac-8fb0b757d85c'
	AND deleted_at IS NULL
	AND (
		year IS DISTINCT FROM 1992
		OR isbn IS DISTINCT FROM '9780830817771'
		OR edition IS DISTINCT FROM 'First'
		OR citation_abbreviation IS DISTINCT FROM 'DJG'
	);

-- ---------------------------------------------------------------------------
-- New volumes. DJG 2nd shares the title with the 1st — key by ISBN.
-- Abbreviations: DNTB, DJG2, DOTP, DLNT (current SBL, not DLNTD), DOTPr.
-- ---------------------------------------------------------------------------
INSERT INTO public.books (
	title, publisher, publisher_id, publisher_location, year, isbn,
	edition, citation_abbreviation, series_id, genre, work_type, language,
	reading_status, needs_review, created_by
)
SELECT
	v.title, v.publisher, pub.id, v.publisher_location, v.year, v.isbn,
	v.edition, v.citation_abbreviation, s.id, 'Biblical Reference', 'edited_volume',
	'english', 'reference', false, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('Dictionary of New Testament Background', 'IVP', 'Downers Grove, IL', 2000, '9780830817801', NULL::text, 'DNTB'),
	('Dictionary of Jesus and the Gospels', 'IVP', 'Downers Grove, IL', 2013, '9780830824564', 'Second', 'DJG2'),
	('Dictionary of the Old Testament Pentateuch', 'IVP', 'Downers Grove, IL', 2002, '9780830817818', NULL::text, 'DOTP'),
	('Dictionary of the Later New Testament & Its Developments', 'IVP', 'Downers Grove, IL', 1997, '9780830817795', NULL::text, 'DLNT'),
	('Dictionary of the Old Testament Prophets', 'IVP', 'Downers Grove, IL', 2012, '9780830817849', NULL::text, 'DOTPr')
) AS v(title, publisher, publisher_location, year, isbn, edition, citation_abbreviation)
JOIN public.series s ON s.name = 'IVP Bible Dictionary Series' AND s.deleted_at IS NULL
LEFT JOIN public.publishers pub ON pub.canonical_name = v.publisher AND pub.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.books b
	WHERE b.deleted_at IS NULL AND b.isbn = v.isbn
);

-- ---------------------------------------------------------------------------
-- Editors (ISBN key so the two DJG rows do not cross-wire)
-- ---------------------------------------------------------------------------
INSERT INTO public.book_authors (book_id, person_id, role, sort_order)
SELECT b.id, p.id, 'editor', v.sort_order
FROM (VALUES
	('9780830817801', 'Craig', 'A.', 'Evans', 0),
	('9780830817801', 'Stanley', 'E.', 'Porter', 1),
	('9780830824564', 'Joel', 'B.', 'Green', 0),
	('9780830824564', 'Jeannine', 'K.', 'Brown', 1),
	('9780830824564', 'Nicholas', NULL::text, 'Perrin', 2),
	('9780830817818', 'T.', 'Desmond', 'Alexander', 0),
	('9780830817818', 'David', 'W.', 'Baker', 1),
	('9780830817795', 'Ralph', 'P.', 'Martin', 0),
	('9780830817795', 'Peter', 'H.', 'Davids', 1),
	('9780830817849', 'Mark', 'J.', 'Boda', 0),
	('9780830817849', 'J.', 'Gordon', 'McConville', 1)
) AS v(isbn, first_name, middle_name, last_name, sort_order)
JOIN public.books b ON b.isbn = v.isbn AND b.deleted_at IS NULL
JOIN public.people p ON p.deleted_at IS NULL
	AND COALESCE(p.first_name, '') = COALESCE(v.first_name, '')
	AND COALESCE(p.middle_name, '') = COALESCE(v.middle_name, '')
	AND p.last_name = v.last_name
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_authors ba
	WHERE ba.book_id = b.id AND ba.person_id = p.id
);
