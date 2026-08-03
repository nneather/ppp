-- library_aug3_odyssey_v1_english_title
-- Soft-deleted accidental Loeb Odyssey Vol I: normalize to English title +
-- LCL 104 / ISBN-13 (owner still only shelves Vol II). Re-assert commentary
-- bible coverage from the Aug 3 batch (idempotent).

UPDATE public.books
SET
	title = 'Odyssey, Volume I: Books 1–12',
	volume_number = '104',
	isbn = '9780674995611',
	year = 1995,
	original_year = 1919,
	updated_at = now()
WHERE id = '7edb1110-4dac-4554-94aa-13a3b3bcf774'
	AND deleted_at IS NOT NULL
	AND (
		title IS DISTINCT FROM 'Odyssey, Volume I: Books 1–12'
		OR volume_number IS DISTINCT FROM '104'
		OR isbn IS DISTINCT FROM '9780674995611'
	);

INSERT INTO public.book_bible_coverage (book_id, bible_book, created_by)
SELECT b.id, v.bible_book, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM (VALUES
	('The Epistles of St. Peter and St. Jude', 'ICC', '1 Peter'),
	('The Epistles of St. Peter and St. Jude', 'ICC', '2 Peter'),
	('The Epistles of St. Peter and St. Jude', 'ICC', 'Jude'),
	('The Book of Exodus', 'OTL', 'Exodus'),
	('Daniel', 'ApOTC', 'Daniel'),
	('Galatians', 'Hermeneia', 'Galatians'),
	('Proverbs', 'KCC', 'Proverbs'),
	('Psalms 1–72', 'KCC', 'Psalms'),
	('Psalms 73–150', 'KCC', 'Psalms'),
	('The Book of Proverbs, Chapters 1–15', 'NICOT', 'Proverbs'),
	('The Book of Proverbs, Chapters 15–31', 'NICOT', 'Proverbs')
) AS v(title, series_abbr, bible_book)
JOIN public.series s ON s.abbreviation = v.series_abbr AND s.deleted_at IS NULL
JOIN public.books b ON b.title = v.title AND b.series_id = s.id AND b.deleted_at IS NULL
WHERE NOT EXISTS (
	SELECT 1 FROM public.book_bible_coverage c
	WHERE c.book_id = b.id AND c.bible_book = v.bible_book
);
