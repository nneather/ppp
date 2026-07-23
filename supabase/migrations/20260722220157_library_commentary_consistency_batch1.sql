-- library_commentary_consistency_batch1
-- Owner-confirmed Batch 1: series/volume fills for WBC/NAC/AB/ApOTC,
-- Yarbrough Pastorals BECNT→PNTC, clear leaked subtitles, merge Bright AB Jeremiah dup.

-- ---------------------------------------------------------------------------
-- Merge: keep Doubleday Bright Jeremiah (has subtitle); soft-delete Double Day twin
-- ---------------------------------------------------------------------------
UPDATE public.books
SET
	volume_number = '21',
	updated_at = now()
WHERE id = '6b044a1c-285e-4f77-a887-f74a7026e342'::uuid
	AND deleted_at IS NULL
	AND (volume_number IS DISTINCT FROM '21');

UPDATE public.books
SET
	deleted_at = now(),
	updated_at = now()
WHERE id = 'c0c30a93-6dd7-445c-8599-114586e9b5c5'::uuid
	AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Series correction: Yarbrough Timothy/Titus is Pillar (PNTC), not BECNT
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	series_id = s_pntc.id,
	updated_at = now()
FROM public.series s_becnt,
	public.series s_pntc
WHERE b.deleted_at IS NULL
	AND s_becnt.deleted_at IS NULL
	AND s_pntc.deleted_at IS NULL
	AND s_becnt.abbreviation = 'BECNT'
	AND s_pntc.abbreviation = 'PNTC'
	AND b.series_id = s_becnt.id
	AND b.title = 'The Letters to Timothy and Titus'
	AND b.isbn = '9780802837332'
	AND b.series_id IS DISTINCT FROM s_pntc.id;

-- ---------------------------------------------------------------------------
-- WBC: volume_number (+ title/subtitle cleanups)
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET volume_number = v.volume_number, updated_at = now()
FROM public.series s,
	(VALUES
		('Genesis 1-15', '1'),
		('Genesis 16-50', '2'),
		('Joshua', '7'),
		('Ruth-Esther', '9'),
		('2 Chronicles', '15'),
		('Ezra-nehemiah', '16'),
		('Proverbs', '22'),
		('Ecclesiastes', '23A'),
		('Hosea-Jonah', '31'),
		('Micah-Malachi', '32'),
		('Philippians', '43'),
		('1 and 2 Thessalonians', '45')
	) AS v(title, volume_number)
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'WBC'
	AND b.series_id = s.id
	AND b.title = v.title
	AND b.volume_number IS DISTINCT FROM v.volume_number;

-- Hobbs: strip "Word Biblical Commentary Vol. 13, " from title; set vol 13
UPDATE public.books b
SET
	title = '2 Kings',
	volume_number = '13',
	updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'WBC'
	AND b.series_id = s.id
	AND b.title = 'Word Biblical Commentary Vol. 13, 2 Kings';

-- Hawthorne Philippians: clear series-name leak in subtitle
UPDATE public.books b
SET
	subtitle = NULL,
	updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'WBC'
	AND b.series_id = s.id
	AND b.title = 'Philippians'
	AND b.subtitle = 'Revised (Word Biblical Commentary)';

-- ---------------------------------------------------------------------------
-- NAC volume fills
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET volume_number = v.volume_number, updated_at = now()
FROM public.series s,
	(VALUES
		('Genesis 1-11:26', '1A'),
		('Genesis 11:27-50:26', '1B'),
		('Exodus', '2'),
		('Joshua', '5'),
		('Judges, Ruth', '6')
	) AS v(title, volume_number)
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'NAC'
	AND b.series_id = s.id
	AND b.title = v.title
	AND b.volume_number IS DISTINCT FROM v.volume_number;

-- ---------------------------------------------------------------------------
-- AB volume fills (Bright 21 already set above on keeper)
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET volume_number = v.volume_number, updated_at = now()
FROM public.series s,
	(VALUES
		('Judges', '6A'),
		('Ezra Nehemiah', '14'),
		('The Gospel According to Luke (I-IX)', '28'),
		('The Gospel According to John I-XII', '29'),
		('The Wisdom of Ben Sira', '39'),
		('Judith', '40'),
		('I and II Esdras', '42')
	) AS v(title, volume_number)
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'AB'
	AND b.series_id = s.id
	AND b.title = v.title
	AND b.volume_number IS DISTINCT FROM v.volume_number;

-- ---------------------------------------------------------------------------
-- ApOTC: Wray Beal Kings
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET volume_number = '9', updated_at = now()
FROM public.series s
WHERE b.deleted_at IS NULL
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'ApOTC'
	AND b.series_id = s.id
	AND b.title = '1 & 2 Kings'
	AND b.volume_number IS DISTINCT FROM '9';

-- ---------------------------------------------------------------------------
-- Clear junk subtitles (NIBC + REC Deuteronomy)
-- ---------------------------------------------------------------------------
UPDATE public.books b
SET
	subtitle = NULL,
	updated_at = now()
WHERE b.deleted_at IS NULL
	AND b.title = 'Deuteronomy'
	AND b.subtitle = 'introduction and commentary.';

-- ---------------------------------------------------------------------------
-- People: Fitzmyer last_name trailing period (denorms into author_display)
-- ---------------------------------------------------------------------------
UPDATE public.people
SET
	last_name = 'Fitzmyer',
	updated_at = now()
WHERE deleted_at IS NULL
	AND id = '9ab0973c-3cb9-44b3-8541-bcc4f58a39a7'::uuid
	AND last_name = 'Fitzmyer.';
