-- =============================================================================
-- Extend search_scripture_refs() with optional end bounds for passage ranges.
-- Find-in-library from sermons (e.g. Matt 6:25–34) needs overlap against the
-- full span, not only the start verse.
--
-- New optional args (defaults preserve prior 3-arg call semantics):
--   p_chapter_end INT — when set (and different from start), ends at that chapter
--   p_verse_end INT   — when set, ends at that verse within the end chapter
-- =============================================================================

DROP FUNCTION IF EXISTS public.search_scripture_refs(TEXT, INT, INT);

CREATE OR REPLACE FUNCTION public.search_scripture_refs(
	p_bible_book TEXT,
	p_chapter INT DEFAULT NULL,
	p_verse INT DEFAULT NULL,
	p_chapter_end INT DEFAULT NULL,
	p_verse_end INT DEFAULT NULL
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
			COALESCE((p_chapter * 1000) + COALESCE(p_verse, 0), 0) AS s_start,
			CASE
				WHEN p_chapter IS NULL THEN 999999
				-- Explicit end chapter (cross-chapter range)
				WHEN p_chapter_end IS NOT NULL THEN
					(p_chapter_end * 1000) + COALESCE(p_verse_end, 999)
				-- Same-chapter verse range (e.g. 6:25–34)
				WHEN p_verse_end IS NOT NULL THEN
					(p_chapter * 1000) + p_verse_end
				-- Point or whole-chapter (legacy): verse set → point; else chapter span
				ELSE
					(p_chapter * 1000) + COALESCE(p_verse, 999)
			END AS s_end
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
		AND (sr.book_id IS NULL OR b.deleted_at IS NULL)
	ORDER BY
		manual_entry DESC,
		sr.confidence_score DESC NULLS FIRST,
		sr.verse_start_abs ASC,
		sr.created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.search_scripture_refs(TEXT, INT, INT, INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_scripture_refs(TEXT, INT, INT, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_scripture_refs(TEXT, INT, INT, INT, INT) TO authenticated;

COMMENT ON FUNCTION public.search_scripture_refs(TEXT, INT, INT, INT, INT) IS
	'Overlap search for scripture_references. Optional end chapter/verse for ranges; inclusive bounds; manual entries (NULL confidence) sort first. RLS still applies.';
