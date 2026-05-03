-- =============================================================================
-- Session 7b — Library module read/write/none via user_permissions + RLS
-- Adds app_module_access_level + app_has_module_read; gates library SELECT
-- policies; read-only viewers may UPDATE books.reading_status only (trigger).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.app_module_access_level(p_module text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT CASE
		WHEN EXISTS (
			SELECT 1 FROM public.profiles p
			WHERE p.id = auth.uid()
				AND p.role = 'owner'
				AND p.deleted_at IS NULL
		) THEN 'owner'
		WHEN EXISTS (
			SELECT 1 FROM public.profiles p
			WHERE p.id = auth.uid()
				AND p.role = 'viewer'
				AND p.deleted_at IS NULL
		) THEN COALESCE(
			(
				SELECT up.access_level::text
				FROM public.user_permissions up
				WHERE up.user_id = auth.uid()
					AND up.module = p_module
				LIMIT 1
			),
			'none'
		)
		ELSE 'none'
	END;
$$;

CREATE OR REPLACE FUNCTION public.app_has_module_read(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT public.app_module_access_level(p_module) IN ('owner', 'read', 'write');
$$;

GRANT EXECUTE ON FUNCTION public.app_module_access_level(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_has_module_read(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- books — read viewers: only reading_status may change (BEFORE UPDATE)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.library_books_read_access_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
	v_old jsonb;
	v_new jsonb;
BEGIN
	IF public.app_module_access_level('library') IS DISTINCT FROM 'read' THEN
		RETURN NEW;
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM public.profiles p
		WHERE p.id = auth.uid() AND p.role = 'viewer' AND p.deleted_at IS NULL
	) THEN
		RETURN NEW;
	END IF;

	v_old := to_jsonb(OLD) - 'reading_status' - 'updated_at';
	v_new := to_jsonb(NEW) - 'reading_status' - 'updated_at';
	IF v_old IS DISTINCT FROM v_new THEN
		RAISE EXCEPTION 'Library read access: only reading_status may be changed.'
			USING ERRCODE = '42501';
	END IF;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_library_books_read_guard ON public.books;
CREATE TRIGGER trg_library_books_read_guard
	BEFORE UPDATE ON public.books
	FOR EACH ROW
	EXECUTE FUNCTION public.library_books_read_access_update_guard();

-- ---------------------------------------------------------------------------
-- SELECT policies — library module
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS categories_select ON public.categories;
CREATE POLICY categories_select ON public.categories
	FOR SELECT USING (public.app_has_module_read('library'));

DROP POLICY IF EXISTS bible_books_select ON public.bible_books;
CREATE POLICY bible_books_select ON public.bible_books
	FOR SELECT USING (public.app_has_module_read('library'));

DROP POLICY IF EXISTS ancient_texts_select ON public.ancient_texts;
CREATE POLICY ancient_texts_select ON public.ancient_texts
	FOR SELECT USING (
		public.app_is_owner()
		OR (
			public.app_has_module_read('library')
			AND deleted_at IS NULL
		)
	);

DROP POLICY IF EXISTS people_select ON public.people;
CREATE POLICY people_select ON public.people
	FOR SELECT USING (public.app_has_module_read('library'));

DROP POLICY IF EXISTS series_select ON public.series;
CREATE POLICY series_select ON public.series
	FOR SELECT USING (public.app_has_module_read('library'));

DROP POLICY IF EXISTS books_viewer_select ON public.books;
CREATE POLICY books_viewer_select ON public.books
	FOR SELECT USING (public.app_has_module_read('library'));

DROP POLICY IF EXISTS essays_viewer_select ON public.essays;
CREATE POLICY essays_viewer_select ON public.essays
	FOR SELECT USING (public.app_has_module_read('library'));

DROP POLICY IF EXISTS essay_authors_viewer_select ON public.essay_authors;
CREATE POLICY essay_authors_viewer_select ON public.essay_authors
	FOR SELECT USING (public.app_has_module_read('library'));

DROP POLICY IF EXISTS scripture_references_viewer_select ON public.scripture_references;
CREATE POLICY scripture_references_viewer_select ON public.scripture_references
	FOR SELECT USING (public.app_has_module_read('library'));

DROP POLICY IF EXISTS book_topics_viewer_select ON public.book_topics;
CREATE POLICY book_topics_viewer_select ON public.book_topics
	FOR SELECT USING (public.app_has_module_read('library'));

CREATE POLICY book_authors_library_read_select ON public.book_authors
	FOR SELECT USING (public.app_has_module_read('library'));

CREATE POLICY book_categories_library_read_select ON public.book_categories
	FOR SELECT USING (public.app_has_module_read('library'));

CREATE POLICY book_bible_coverage_library_read_select ON public.book_bible_coverage
	FOR SELECT USING (public.app_has_module_read('library'));

CREATE POLICY book_ancient_coverage_library_read_select ON public.book_ancient_coverage
	FOR SELECT USING (public.app_has_module_read('library'));

CREATE POLICY books_viewer_read_update ON public.books
	FOR UPDATE
	USING (
		public.app_module_access_level('library') = 'read'
		AND EXISTS (
			SELECT 1 FROM public.profiles p
			WHERE p.id = auth.uid() AND p.role = 'viewer' AND p.deleted_at IS NULL
		)
	)
	WITH CHECK (
		public.app_module_access_level('library') = 'read'
		AND EXISTS (
			SELECT 1 FROM public.profiles p
			WHERE p.id = auth.uid() AND p.role = 'viewer' AND p.deleted_at IS NULL
		)
	);
