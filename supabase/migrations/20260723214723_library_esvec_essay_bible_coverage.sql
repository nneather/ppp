-- library_esvec_essay_bible_coverage
-- ESVEC essays are already titled with Protestant canon names. Wire essay-level
-- book_bible_coverage so /sermons/by-book can show signed contributors (Doriani,
-- Hamilton, …) like NIB Vol X essays — not only the multi-book parent volume.

INSERT INTO public.book_bible_coverage (essay_id, bible_book, created_by)
SELECT e.id, e.essay_title, 'a14833c9-459e-4667-aef3-dae698734f6d'::uuid
FROM public.essays e
JOIN public.books b
	ON b.id = e.parent_book_id
	AND b.deleted_at IS NULL
JOIN public.series s
	ON s.id = b.series_id
	AND s.deleted_at IS NULL
	AND s.abbreviation = 'ESVEC'
JOIN public.bible_books bb
	ON bb.name = e.essay_title
WHERE e.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM public.book_bible_coverage bbc
		WHERE bbc.essay_id = e.id
			AND bbc.bible_book = e.essay_title
	);
