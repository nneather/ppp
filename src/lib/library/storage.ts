/**
 * Library module storage constants.
 *
 * Buckets are created via SQL migrations (see
 * `supabase/migrations/20260428200000_library_scripture_images_bucket.sql`).
 * This file is the single source of truth for bucket names + path conventions
 * referenced from app code (loaders generate signed URLs; form components
 * upload to the bucket via the browser supabase client).
 *
 * Convention per `.cursor/rules/library-module.mdc` "Storage buckets":
 *   - bucket name = `${module}-${entity}-images`, private
 *   - object path = `${userId}/${parentId}/${random}.${ext}`
 *   - reads via signed URL (1h TTL) generated server-side in loaders
 *   - RLS gated by `app_is_viewer_writer('<module>')` + first-segment self-prefix
 */

export const SCRIPTURE_IMAGES_BUCKET = 'library-scripture-images';

/** Signed URL TTL in seconds. 1h per Tracker_1 S8. */
export const SCRIPTURE_IMAGES_SIGNED_URL_TTL = 60 * 60;

/**
 * Build the canonical object path for a scripture image.
 *
 * The first path segment MUST be the uploader's auth uid — the storage RLS
 * policy `library_scripture_images_insert` enforces this with
 * `(storage.foldername(name))[1] = auth.uid()::text`.
 */
export function scriptureImagePath(args: {
	userId: string;
	bookId: string;
	ext: string;
}): string {
	const ext = args.ext.replace(/^\.+/, '').toLowerCase() || 'jpg';
	const random =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	return `${args.userId}/${args.bookId}/${random}.${ext}`;
}
