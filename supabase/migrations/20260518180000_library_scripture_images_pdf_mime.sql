-- =============================================================================
-- library-scripture-images: allow PDF uploads + raise size cap (Session 9 / 030)
--
-- Adds application/pdf for Genius Scan multi-page index exports.
-- file_size_limit 25 MiB (Anthropic document block accepts up to 32 MiB).
-- =============================================================================

UPDATE storage.buckets
SET
	allowed_mime_types = ARRAY[
		'image/jpeg',
		'image/png',
		'image/webp',
		'image/heic',
		'application/pdf'
	],
	file_size_limit = 26214400
WHERE id = 'library-scripture-images';
