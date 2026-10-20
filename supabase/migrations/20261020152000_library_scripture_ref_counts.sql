-- =============================================================================
-- library_scripture_ref_counts — tallies for book-detail scripture index UI
-- Filed: 2026-10-20 (scripture index book detail — decision 280)
--
-- Returns one row per (book_id, bible_book, chapter_start) for live refs on the
-- given books. One RPC feeds the header total, Bible-book grid, and chapter
-- chips without loading every scripture_references row (PostgREST 1000-row cap).
--
-- SECURITY INVOKER — RLS on scripture_references still applies.
-- Uses idx_scripture_references_book_id_live.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.library_scripture_ref_counts(p_book_ids uuid[])
RETURNS TABLE (
	book_id uuid,
	bible_book text,
	chapter_start int,
	n bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
	SELECT
		sr.book_id,
		sr.bible_book,
		sr.chapter_start,
		count(*)::bigint AS n
	FROM public.scripture_references sr
	WHERE sr.deleted_at IS NULL
		AND sr.book_id = ANY (p_book_ids)
	GROUP BY sr.book_id, sr.bible_book, sr.chapter_start
	ORDER BY sr.bible_book, sr.chapter_start NULLS FIRST;
$$;

REVOKE EXECUTE ON FUNCTION public.library_scripture_ref_counts(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.library_scripture_ref_counts(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.library_scripture_ref_counts(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.library_scripture_ref_counts(uuid[]) IS
	'Tallies live scripture_references by book_id / bible_book / chapter_start for the book-detail index UI. SECURITY INVOKER — RLS applies.';
