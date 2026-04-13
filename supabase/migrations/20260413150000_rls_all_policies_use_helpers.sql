-- Extend SECURITY DEFINER helpers to ALL remaining RLS policies that query
-- profiles (or profiles + user_permissions).  Prevents nested-RLS failures on
-- INSERT / UPDATE across every table, not just the four invoicing tables
-- already fixed in 20260413140000.

-- ---------------------------------------------------------------------------
-- 1. New helper: viewer with write permission on a given module
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_is_viewer_writer(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.profiles p
		JOIN public.user_permissions up ON up.user_id = p.id
		WHERE p.id = auth.uid()
			AND p.role = 'viewer'
			AND p.deleted_at IS NULL
			AND up.module = p_module
			AND up.access_level = 'write'
	);
$$;

GRANT EXECUTE ON FUNCTION public.app_is_viewer_writer(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Owner-only policies  (11 tables not yet converted)
-- ---------------------------------------------------------------------------

-- profiles
DROP POLICY IF EXISTS profiles_owner_all ON public.profiles;
CREATE POLICY profiles_owner_all ON public.profiles
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- user_permissions
DROP POLICY IF EXISTS user_permissions_owner_all ON public.user_permissions;
CREATE POLICY user_permissions_owner_all ON public.user_permissions
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- audit_log
DROP POLICY IF EXISTS audit_log_owner_all ON public.audit_log;
CREATE POLICY audit_log_owner_all ON public.audit_log
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- client_rates
DROP POLICY IF EXISTS client_rates_owner_all ON public.client_rates;
CREATE POLICY client_rates_owner_all ON public.client_rates
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- ancient_texts (separate INSERT / UPDATE policies)
DROP POLICY IF EXISTS ancient_texts_owner_insert ON public.ancient_texts;
CREATE POLICY ancient_texts_owner_insert ON public.ancient_texts
	FOR INSERT
	WITH CHECK (public.app_is_owner());

DROP POLICY IF EXISTS ancient_texts_owner_update ON public.ancient_texts;
CREATE POLICY ancient_texts_owner_update ON public.ancient_texts
	FOR UPDATE
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- people
DROP POLICY IF EXISTS people_owner_all ON public.people;
CREATE POLICY people_owner_all ON public.people
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- series
DROP POLICY IF EXISTS series_owner_all ON public.series;
CREATE POLICY series_owner_all ON public.series
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- books
DROP POLICY IF EXISTS books_owner_all ON public.books;
CREATE POLICY books_owner_all ON public.books
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- book_authors
DROP POLICY IF EXISTS book_authors_owner_all ON public.book_authors;
CREATE POLICY book_authors_owner_all ON public.book_authors
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- book_categories
DROP POLICY IF EXISTS book_categories_owner_all ON public.book_categories;
CREATE POLICY book_categories_owner_all ON public.book_categories
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- essays
DROP POLICY IF EXISTS essays_owner_all ON public.essays;
CREATE POLICY essays_owner_all ON public.essays
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- essay_authors
DROP POLICY IF EXISTS essay_authors_owner_all ON public.essay_authors;
CREATE POLICY essay_authors_owner_all ON public.essay_authors
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- book_bible_coverage
DROP POLICY IF EXISTS book_bible_coverage_owner_all ON public.book_bible_coverage;
CREATE POLICY book_bible_coverage_owner_all ON public.book_bible_coverage
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- book_ancient_coverage
DROP POLICY IF EXISTS book_ancient_coverage_owner_all ON public.book_ancient_coverage;
CREATE POLICY book_ancient_coverage_owner_all ON public.book_ancient_coverage
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- scripture_references
DROP POLICY IF EXISTS scripture_references_owner_all ON public.scripture_references;
CREATE POLICY scripture_references_owner_all ON public.scripture_references
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- book_topics
DROP POLICY IF EXISTS book_topics_owner_all ON public.book_topics;
CREATE POLICY book_topics_owner_all ON public.book_topics
	FOR ALL
	USING  (public.app_is_owner())
	WITH CHECK (public.app_is_owner());

-- ---------------------------------------------------------------------------
-- 3. Viewer-write policies  (12 policies across 10 tables)
-- ---------------------------------------------------------------------------

-- people
DROP POLICY IF EXISTS people_viewer_write ON public.people;
CREATE POLICY people_viewer_write ON public.people
	FOR ALL
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- series
DROP POLICY IF EXISTS series_viewer_write ON public.series;
CREATE POLICY series_viewer_write ON public.series
	FOR ALL
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- books (separate INSERT / UPDATE)
DROP POLICY IF EXISTS books_viewer_insert ON public.books;
CREATE POLICY books_viewer_insert ON public.books
	FOR INSERT
	WITH CHECK (public.app_is_viewer_writer('library'));

DROP POLICY IF EXISTS books_viewer_update ON public.books;
CREATE POLICY books_viewer_update ON public.books
	FOR UPDATE
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- book_authors
DROP POLICY IF EXISTS book_authors_viewer_write ON public.book_authors;
CREATE POLICY book_authors_viewer_write ON public.book_authors
	FOR ALL
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- book_categories
DROP POLICY IF EXISTS book_categories_viewer_write ON public.book_categories;
CREATE POLICY book_categories_viewer_write ON public.book_categories
	FOR ALL
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- book_bible_coverage
DROP POLICY IF EXISTS book_bible_coverage_viewer_write ON public.book_bible_coverage;
CREATE POLICY book_bible_coverage_viewer_write ON public.book_bible_coverage
	FOR ALL
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- book_ancient_coverage
DROP POLICY IF EXISTS book_ancient_coverage_viewer_write ON public.book_ancient_coverage;
CREATE POLICY book_ancient_coverage_viewer_write ON public.book_ancient_coverage
	FOR ALL
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- scripture_references (separate INSERT / UPDATE)
DROP POLICY IF EXISTS scripture_references_viewer_insert ON public.scripture_references;
CREATE POLICY scripture_references_viewer_insert ON public.scripture_references
	FOR INSERT
	WITH CHECK (public.app_is_viewer_writer('library'));

DROP POLICY IF EXISTS scripture_references_viewer_update ON public.scripture_references;
CREATE POLICY scripture_references_viewer_update ON public.scripture_references
	FOR UPDATE
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));

-- book_topics (separate INSERT / UPDATE)
DROP POLICY IF EXISTS book_topics_viewer_insert ON public.book_topics;
CREATE POLICY book_topics_viewer_insert ON public.book_topics
	FOR INSERT
	WITH CHECK (public.app_is_viewer_writer('library'));

DROP POLICY IF EXISTS book_topics_viewer_update ON public.book_topics;
CREATE POLICY book_topics_viewer_update ON public.book_topics
	FOR UPDATE
	USING  (public.app_is_viewer_writer('library'))
	WITH CHECK (public.app_is_viewer_writer('library'));
