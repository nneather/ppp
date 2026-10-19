-- book_passage_sections — curated monograph sections with biblical range + pages
-- (decision 249). Distinct from scripture_references (OCR/index backload) and
-- from essays (citable articles). Surfaces on /library/search-passage between
-- commentaries and the scripture index.
--
-- verse_*_abs reuse compute_verse_abs() (chapter-only / range semantics).

CREATE TABLE IF NOT EXISTS public.book_passage_sections (
	id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	book_id          UUID NOT NULL REFERENCES public.books(id),
	label            TEXT,
	bible_book       TEXT NOT NULL REFERENCES public.bible_books(name),
	chapter_start    INT,
	verse_start      INT,
	chapter_end      INT,
	verse_end        INT,
	verse_start_abs  INT,
	verse_end_abs    INT,
	page_start       TEXT NOT NULL,
	page_end         TEXT,
	deleted_at       TIMESTAMPTZ,
	created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
	created_by       UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_book_passage_sections_overlap
	ON public.book_passage_sections (bible_book, verse_start_abs, verse_end_abs)
	WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_book_passage_sections_book_id_live
	ON public.book_passage_sections (book_id, verse_start_abs)
	WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_book_passage_sections_updated_at ON public.book_passage_sections;
CREATE TRIGGER trg_book_passage_sections_updated_at
	BEFORE UPDATE ON public.book_passage_sections
	FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_compute_verse_abs_book_passage_sections ON public.book_passage_sections;
CREATE TRIGGER trg_compute_verse_abs_book_passage_sections
	BEFORE INSERT OR UPDATE OF chapter_start, verse_start, chapter_end, verse_end
	ON public.book_passage_sections
	FOR EACH ROW EXECUTE FUNCTION public.compute_verse_abs();

DROP TRIGGER IF EXISTS trg_audit_book_passage_sections ON public.book_passage_sections;
CREATE TRIGGER trg_audit_book_passage_sections
	AFTER INSERT OR UPDATE OR DELETE ON public.book_passage_sections
	FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

ALTER TABLE public.book_passage_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS book_passage_sections_owner_all ON public.book_passage_sections;
CREATE POLICY book_passage_sections_owner_all ON public.book_passage_sections
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

DROP POLICY IF EXISTS book_passage_sections_select ON public.book_passage_sections;
CREATE POLICY book_passage_sections_select ON public.book_passage_sections
	FOR SELECT USING (public.app_has_module_read('library'));

DROP POLICY IF EXISTS book_passage_sections_viewer_insert ON public.book_passage_sections;
CREATE POLICY book_passage_sections_viewer_insert ON public.book_passage_sections
	FOR INSERT WITH CHECK (public.app_is_viewer_writer('library'));

DROP POLICY IF EXISTS book_passage_sections_viewer_update ON public.book_passage_sections;
CREATE POLICY book_passage_sections_viewer_update ON public.book_passage_sections
	FOR UPDATE
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_passage_sections TO authenticated, service_role;
GRANT SELECT ON public.book_passage_sections TO anon;

COMMENT ON TABLE public.book_passage_sections IS
	'Curated monograph / treatise sections (biblical range + pages). Not the scripture index; not essays.';
