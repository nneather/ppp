-- =============================================================================
-- library-scripture-images Storage bucket + RLS
-- Filed: 2026-04-28 (Session 2 — scripture references wiring)
--
-- Resolves Tracker_1 Open Question 3 (Storage bucket name + upload UI for
-- scripture_references.source_image_url). Bucket is private; reads happen via
-- signed URLs (1h TTL) generated server-side in loadScriptureRefsForBook().
--
-- Path convention: ${userId}/${bookId}/${random}.${ext}
--   - userId enforces the self-prefix INSERT check (path-derived auth)
--   - bookId is informational; not enforced by RLS (RLS on scripture_references
--     already gates which rows can reference the path)
--
-- RLS shape (consistent with .cursor/rules/library-module.mdc viewer-write):
--   - SELECT: owner OR viewer-write — anyone with library access reads any image
--   - INSERT: (owner OR viewer-write) AND first path segment matches auth.uid()
--   - UPDATE: owner only — defensive; viewers don't rewrite each other's files
--   - DELETE: owner only — same reason
--
-- HOW TO APPLY:
--   npm run supabase:db:push:dry → review → npm run supabase:db:push
--   then npm run supabase:gen-types in the same commit (storage tables are
--   typically excluded from generated types but the regen still validates).
-- =============================================================================

-- 1. Create the bucket idempotently. file_size_limit = 10 MB. allowed mimes
--    cover phone-camera output (jpeg + heic) plus desktop drag-in (png, webp).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
	'library-scripture-images',
	'library-scripture-images',
	false,
	10485760,
	ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Policies. DROP IF EXISTS first so the file stays idempotent across
--    re-runs (per the immutable-by-filename rule in db-changes.mdc, this
--    migration won't be edited after first apply, but the guards keep
--    re-pushes safe in fresh environments).

DROP POLICY IF EXISTS library_scripture_images_select ON storage.objects;
CREATE POLICY library_scripture_images_select ON storage.objects
	FOR SELECT
	USING (
		bucket_id = 'library-scripture-images'
		AND (
			public.app_is_owner()
			OR public.app_is_viewer_writer('library')
		)
	);

DROP POLICY IF EXISTS library_scripture_images_insert ON storage.objects;
CREATE POLICY library_scripture_images_insert ON storage.objects
	FOR INSERT
	WITH CHECK (
		bucket_id = 'library-scripture-images'
		AND (
			public.app_is_owner()
			OR public.app_is_viewer_writer('library')
		)
		-- Self-prefix: first path segment must match the uploader's auth uid
		-- so a viewer cannot drop files into the owner's prefix (or another
		-- viewer's). storage.foldername returns the path split on '/'.
		AND (storage.foldername(name))[1] = auth.uid()::text
	);

DROP POLICY IF EXISTS library_scripture_images_update ON storage.objects;
CREATE POLICY library_scripture_images_update ON storage.objects
	FOR UPDATE
	USING (
		bucket_id = 'library-scripture-images'
		AND public.app_is_owner()
	)
	WITH CHECK (
		bucket_id = 'library-scripture-images'
		AND public.app_is_owner()
	);

DROP POLICY IF EXISTS library_scripture_images_delete ON storage.objects;
CREATE POLICY library_scripture_images_delete ON storage.objects
	FOR DELETE
	USING (
		bucket_id = 'library-scripture-images'
		AND public.app_is_owner()
	);

-- NOTE: COMMENT ON POLICY would be nice but the migration role is not the
-- owner of storage.objects, so it lacks privilege to attach comments to that
-- table's policies (SQLSTATE 42501). Behavior is fully captured by the policy
-- definitions above + this migration's header comment block.
