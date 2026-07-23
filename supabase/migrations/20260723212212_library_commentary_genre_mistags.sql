-- library_commentary_genre_mistags
-- /sermons/by-book splits coverage by genre: Commentary → "Commentaries",
-- everything else → "Also on the shelf". Six series volumes were tagged
-- "Acts and Paul" (NT sub-genre) instead of Commentary — Commentary always
-- wins per library-recommend-genre. NICNT Hebrews was Biblical Reference.
-- ESVEC was already correct; John–Acts "also on shelf" was Calvin CC vol 19.

-- Calvin CC vol 19 + five Romans commentaries mistagged Acts and Paul
UPDATE public.books
SET
	genre = 'Commentary',
	reading_status = CASE
		WHEN id = '48bacc35-af3d-4623-91af-f5585c867a4b' THEN 'reference' -- CC siblings
		ELSE reading_status
	END,
	updated_at = now()
WHERE deleted_at IS NULL
	AND genre = 'Acts and Paul'
	AND id IN (
		'48bacc35-af3d-4623-91af-f5585c867a4b', -- CC vol 19 Acts 14-28; Romans 1-16
		'd20bdc92-23fb-4d28-8790-c4a6141f760b', -- BECNT Romans
		'a5e52d35-d61a-41b8-82c5-e6703da46685', -- EGGNT Romans
		'6c134888-d14e-4b2a-88ca-a4c7f74d6128', -- NIBC Romans
		'f15d5c63-3241-4e79-bf47-b65b47fff767', -- NICNT The Letter to the Romans
		'636f4cb4-7051-46ac-80dc-045a80689ac0'  -- ZECNT Romans
	);

-- NICNT Hebrews: sibling volumes are Commentary
UPDATE public.books
SET
	genre = 'Commentary',
	updated_at = now()
WHERE deleted_at IS NULL
	AND id = '08d7fcb9-9e98-4073-847c-319b52b0323b'
	AND genre = 'Biblical Reference';
