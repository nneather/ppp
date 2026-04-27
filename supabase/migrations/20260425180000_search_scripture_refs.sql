-- =============================================================================
-- search_scripture_refs() — overlap-search SQL function
-- Filed: 2026-04-25 (Session 2 prep — Track E)
--
-- Backs the /library/search-passage UX (Session 3) and any commentary-on-this-
-- passage surfacing throughout the library module.
--
-- Trigger semantics (from compute_verse_abs in baseline):
--   - whole-book ref: chapter_start IS NULL → verse_start_abs = 0,
--     verse_end_abs = 999999. Matches every search on that bible_book.
--   - chapter-only ref: verse_start IS NULL → verse_start_abs = chapter*1000,
--     verse_end_abs = chapter*1000 + 999. Matches any verse in that chapter.
--   - verse-level ref: both set → tight range.
--
-- Overlap predicate inclusive on both ends per S4 / S5 / S6 in the audit doc:
--   verse_start_abs <= search_abs AND verse_end_abs >= search_abs
--
-- Args:
--   p_bible_book TEXT       — required, must match a bible_books.name row
--   p_chapter INT DEFAULT NULL — optional; when null, returns every ref on the book
--   p_verse INT DEFAULT NULL   — optional; when null, defaults to chapter*1000+0
--                                (matches chapter-level + whole-book refs)
--
-- SECURITY INVOKER — RLS on scripture_references and books still applies.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.search_scripture_refs(
	p_bible_book TEXT,
	p_chapter INT DEFAULT NULL,
	p_verse INT DEFAULT NULL
)
RETURNS TABLE (
	ref_id           UUID,
	book_id          UUID,
	essay_id         UUID,
	book_title       TEXT,
	book_subtitle    TEXT,
	bible_book       TEXT,
	chapter_start    INT,
	verse_start      INT,
	chapter_end      INT,
	verse_end        INT,
	page_start       TEXT,
	page_end         TEXT,
	confidence_score NUMERIC,
	needs_review     BOOLEAN,
	review_note      TEXT,
	manual_entry     BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
	WITH search_bounds AS (
		SELECT
			-- When chapter is null, search the entire book by spanning the full
			-- abs range. When verse is null, search the entire chapter.
			COALESCE((p_chapter * 1000) + COALESCE(p_verse, 0), 0)        AS s_start,
			COALESCE((p_chapter * 1000) + COALESCE(p_verse, 999), 999999) AS s_end
	)
	SELECT
		sr.id                                              AS ref_id,
		sr.book_id,
		sr.essay_id,
		b.title                                            AS book_title,
		b.subtitle                                         AS book_subtitle,
		sr.bible_book,
		sr.chapter_start,
		sr.verse_start,
		sr.chapter_end,
		sr.verse_end,
		sr.page_start,
		sr.page_end,
		sr.confidence_score,
		sr.needs_review,
		sr.review_note,
		(sr.confidence_score IS NULL)                      AS manual_entry
	FROM public.scripture_references sr
	LEFT JOIN public.books b ON b.id = sr.book_id
	CROSS JOIN search_bounds sb
	WHERE sr.deleted_at IS NULL
		AND sr.bible_book = p_bible_book
		AND sr.verse_start_abs <= sb.s_end
		AND sr.verse_end_abs   >= sb.s_start
		-- Hide refs whose parent book is soft-deleted (matches app-layer JOIN-filter, S11).
		AND (sr.book_id IS NULL OR b.deleted_at IS NULL)
	ORDER BY
		manual_entry DESC,                                 -- manual entries first per S7
		sr.confidence_score DESC NULLS FIRST,
		sr.verse_start_abs ASC,
		sr.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.search_scripture_refs(TEXT, INT, INT) TO authenticated;

COMMENT ON FUNCTION public.search_scripture_refs(TEXT, INT, INT) IS
	'Overlap search for scripture_references. Inclusive on both bounds; manual entries (NULL confidence) sort first per audit-doc S7. RLS on books / scripture_references still applies.';
