-- book_outline_sections — per-volume TOC (page range → locator + label).
-- Joined to scripture_references pages for the Systematic theologies band
-- (decision 252). Distinct from book_passage_sections (biblical range) and
-- scripture_references (OCR/index).
--
-- Also extends search_scripture_refs() with book genre / volume / series so
-- the systematic band can group without an extra round trip.

CREATE TABLE IF NOT EXISTS public.book_outline_sections (
	id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	book_id      UUID NOT NULL REFERENCES public.books(id),
	parent_id    UUID REFERENCES public.book_outline_sections(id),
	sort_order   INT NOT NULL DEFAULT 0,
	locator      TEXT,
	label        TEXT NOT NULL,
	page_start   INT NOT NULL CHECK (page_start >= 1 AND page_start <= 99999),
	page_end     INT NOT NULL CHECK (page_end >= 1 AND page_end <= 99999),
	deleted_at   TIMESTAMPTZ,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by   UUID REFERENCES public.profiles(id),
	CONSTRAINT book_outline_sections_page_range_chk CHECK (page_end >= page_start),
	CONSTRAINT book_outline_sections_label_len_chk CHECK (char_length(label) <= 300),
	CONSTRAINT book_outline_sections_locator_len_chk CHECK (locator IS NULL OR char_length(locator) <= 80)
);

CREATE INDEX IF NOT EXISTS idx_book_outline_sections_book_pages_live
	ON public.book_outline_sections (book_id, page_start, page_end)
	WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_book_outline_sections_parent_live
	ON public.book_outline_sections (parent_id)
	WHERE deleted_at IS NULL AND parent_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_book_outline_sections_updated_at ON public.book_outline_sections;
CREATE TRIGGER trg_book_outline_sections_updated_at
	BEFORE UPDATE ON public.book_outline_sections
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_book_outline_sections ON public.book_outline_sections;
CREATE TRIGGER trg_audit_book_outline_sections
	AFTER INSERT OR UPDATE OR DELETE ON public.book_outline_sections
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

ALTER TABLE public.book_outline_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS book_outline_sections_owner_all ON public.book_outline_sections;
CREATE POLICY book_outline_sections_owner_all ON public.book_outline_sections
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

DROP POLICY IF EXISTS book_outline_sections_select ON public.book_outline_sections;
CREATE POLICY book_outline_sections_select ON public.book_outline_sections
	FOR SELECT USING (public.app_has_module_read('library'));

DROP POLICY IF EXISTS book_outline_sections_viewer_insert ON public.book_outline_sections;
CREATE POLICY book_outline_sections_viewer_insert ON public.book_outline_sections
	FOR INSERT WITH CHECK (public.app_is_viewer_writer('library'));

DROP POLICY IF EXISTS book_outline_sections_viewer_update ON public.book_outline_sections;
CREATE POLICY book_outline_sections_viewer_update ON public.book_outline_sections
	FOR UPDATE
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_outline_sections TO authenticated, service_role;
GRANT SELECT ON public.book_outline_sections TO anon;

COMMENT ON TABLE public.book_outline_sections IS
	'Per-volume TOC nodes (page range → locator + label). Joined to scripture_references for systematics-by-passage.';

-- =============================================================================
-- search_scripture_refs v3 — add genre / volume / series for systematic band
-- =============================================================================

DROP FUNCTION IF EXISTS public.search_scripture_refs(TEXT, INT, INT, INT, INT);

CREATE OR REPLACE FUNCTION public.search_scripture_refs(
	p_bible_book TEXT,
	p_chapter INT DEFAULT NULL,
	p_verse INT DEFAULT NULL,
	p_chapter_end INT DEFAULT NULL,
	p_verse_end INT DEFAULT NULL
)
RETURNS TABLE (
	ref_id              UUID,
	book_id             UUID,
	essay_id            UUID,
	book_title          TEXT,
	book_subtitle       TEXT,
	book_genre          TEXT,
	book_volume_number  TEXT,
	series_id           UUID,
	series_name         TEXT,
	bible_book          TEXT,
	chapter_start       INT,
	verse_start         INT,
	chapter_end         INT,
	verse_end           INT,
	page_start          TEXT,
	page_end            TEXT,
	confidence_score    NUMERIC,
	needs_review        BOOLEAN,
	review_note         TEXT,
	manual_entry        BOOLEAN
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
				WHEN p_chapter_end IS NOT NULL THEN
					(p_chapter_end * 1000) + COALESCE(p_verse_end, 999)
				WHEN p_verse_end IS NOT NULL THEN
					(p_chapter * 1000) + p_verse_end
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
		b.genre                                            AS book_genre,
		b.volume_number                                    AS book_volume_number,
		b.series_id                                        AS series_id,
		s.name                                             AS series_name,
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
	LEFT JOIN public.series s ON s.id = b.series_id AND s.deleted_at IS NULL
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
	'Overlap search for scripture_references. v3 adds book_genre / volume / series for systematics band. RLS still applies.';
