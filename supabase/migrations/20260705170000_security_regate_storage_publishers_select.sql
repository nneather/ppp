-- =============================================================================
-- Security hardening (review 051, Session R2) — regate SELECT policies that
-- drifted from app_has_module_read after Session 7b (20260502160000).
--
-- library_scripture_images_select: was app_is_owner() OR app_is_viewer_writer;
--   read-only viewers (access_level = 'read') could not SELECT storage objects
--   even though table SELECTs already use app_has_module_read('library').
--
-- publishers_select: was auth.uid() IS NOT NULL only; now requires library read
--   (owner still sees soft-deleted rows via app_is_owner()).
-- =============================================================================

DROP POLICY IF EXISTS library_scripture_images_select ON storage.objects;
CREATE POLICY library_scripture_images_select ON storage.objects
	FOR SELECT
	USING (
		bucket_id = 'library-scripture-images'
		AND public.app_has_module_read('library')
	);

DROP POLICY IF EXISTS publishers_select ON public.publishers;
CREATE POLICY publishers_select ON public.publishers
	FOR SELECT USING (
		public.app_is_owner()
		OR (
			public.app_has_module_read('library')
			AND deleted_at IS NULL
		)
	);
