-- library_everlasting_man_original_1925
-- The Everlasting Man (Chesterton) — record original publication (first
-- published London: Hodder & Stoughton, 1925; no schema field for the
-- original publisher name, so 1925 goes in original_year) and mark the
-- shelf copy as the Image Books reprint so Turabian emits
-- "(1925; repr., Garden City, NY: Image Books, 1974)". Idempotent.

UPDATE public.books
SET
	original_year = 1925,
	reprint_publisher = 'Image Books',
	reprint_location = 'Garden City, NY',
	reprint_year = 1974,
	updated_at = now()
WHERE id = '88b84212-be40-436b-b955-fad8fff2493a'
	AND deleted_at IS NULL
	AND title = 'The Everlasting Man'
	AND (
		original_year IS DISTINCT FROM 1925
		OR reprint_publisher IS DISTINCT FROM 'Image Books'
		OR reprint_location IS DISTINCT FROM 'Garden City, NY'
		OR reprint_year IS DISTINCT FROM 1974
	);
