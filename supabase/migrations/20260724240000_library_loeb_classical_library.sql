-- library_loeb_classical_library
-- Create Loeb Classical Library (LCL, omit from citation) and remint four
-- mis-catalogued Loeb editions already on the shelf (Confessions I–II,
-- Teacher/Teaching Christianity, Boethius Tractates/Consolation).
-- Owner confirm 2026-07-24: rename Confessions; Church Fathers for Augustine;
-- New City + Digireads rows ARE the Loebs. Idempotent. Hosted push only.

-- ---------------------------------------------------------------------------
-- Series
-- ---------------------------------------------------------------------------
INSERT INTO public.series (name, abbreviation, include_in_citation, created_by)
SELECT
	'Loeb Classical Library',
	'LCL',
	false,
	'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
WHERE NOT EXISTS (
	SELECT 1 FROM public.series s
	WHERE s.deleted_at IS NULL AND s.abbreviation = 'LCL'
);

UPDATE public.series s
SET
	name = 'Loeb Classical Library',
	include_in_citation = false,
	updated_at = now()
WHERE s.deleted_at IS NULL
	AND s.abbreviation = 'LCL'
	AND (
		s.name IS DISTINCT FROM 'Loeb Classical Library'
		OR s.include_in_citation IS DISTINCT FROM false
	);

-- ---------------------------------------------------------------------------
-- Augustine Confessions I–II (already had correct Loeb ISBNs/years)
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	title = v.title,
	publisher = 'Harvard University Press',
	publisher_location = 'Cambridge, MA',
	year = v.year,
	isbn = v.isbn,
	volume_number = v.volume_number,
	series_id = s.id,
	genre = 'Church Fathers',
	updated_at = now()
FROM public.series s,
	(VALUES
		(
			'd39993cf-b209-4a14-930f-c51a37c66d2c'::uuid,
			'Confessions, Volume I: Books 1–8',
			2014,
			'9780674996854',
			'26'
		),
		(
			'16b638fd-c635-474c-b15b-8ffb1ab94797'::uuid,
			'Confessions, Volume II: Books 9–13',
			2016,
			'9780674996939',
			'27'
		)
	) AS v(id, title, year, isbn, volume_number)
WHERE s.deleted_at IS NULL
	AND s.abbreviation = 'LCL'
	AND b.id = v.id
	AND b.deleted_at IS NULL
	AND (
		b.title IS DISTINCT FROM v.title
		OR b.publisher IS DISTINCT FROM 'Harvard University Press'
		OR b.publisher_location IS DISTINCT FROM 'Cambridge, MA'
		OR b.year IS DISTINCT FROM v.year
		OR b.isbn IS DISTINCT FROM v.isbn
		OR b.volume_number IS DISTINCT FROM v.volume_number
		OR b.series_id IS DISTINCT FROM s.id
		OR b.genre IS DISTINCT FROM 'Church Fathers'
	);

-- ---------------------------------------------------------------------------
-- The Teacher. Teaching Christianity — was New City Press; is Loeb 560
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	title = 'The Teacher. Teaching Christianity',
	publisher = 'Harvard University Press',
	publisher_location = 'Cambridge, MA',
	year = 2025,
	isbn = '9780674997721',
	volume_number = '560',
	series_id = s.id,
	genre = 'Church Fathers',
	updated_at = now()
FROM public.series s
WHERE s.deleted_at IS NULL
	AND s.abbreviation = 'LCL'
	AND b.id = '9a9430c2-b0f7-473e-8a71-b53cff961609'::uuid
	AND b.deleted_at IS NULL
	AND (
		b.title IS DISTINCT FROM 'The Teacher. Teaching Christianity'
		OR b.publisher IS DISTINCT FROM 'Harvard University Press'
		OR b.publisher_location IS DISTINCT FROM 'Cambridge, MA'
		OR b.year IS DISTINCT FROM 2025
		OR b.isbn IS DISTINCT FROM '9780674997721'
		OR b.volume_number IS DISTINCT FROM '560'
		OR b.series_id IS DISTINCT FROM s.id
		OR b.genre IS DISTINCT FROM 'Church Fathers'
	);

-- ---------------------------------------------------------------------------
-- Boethius — was Digireads; is Loeb 74 (keep Philosophy)
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	title = 'Theological Tractates. The Consolation of Philosophy',
	publisher = 'Harvard University Press',
	publisher_location = 'Cambridge, MA',
	year = 1973,
	isbn = '9780674990838',
	volume_number = '74',
	series_id = s.id,
	updated_at = now()
FROM public.series s
WHERE s.deleted_at IS NULL
	AND s.abbreviation = 'LCL'
	AND b.id = 'a93bbe75-5a5e-42ba-80f5-ec09111902f8'::uuid
	AND b.deleted_at IS NULL
	AND (
		b.title IS DISTINCT FROM 'Theological Tractates. The Consolation of Philosophy'
		OR b.publisher IS DISTINCT FROM 'Harvard University Press'
		OR b.publisher_location IS DISTINCT FROM 'Cambridge, MA'
		OR b.year IS DISTINCT FROM 1973
		OR b.isbn IS DISTINCT FROM '9780674990838'
		OR b.volume_number IS DISTINCT FROM '74'
		OR b.series_id IS DISTINCT FROM s.id
	);
