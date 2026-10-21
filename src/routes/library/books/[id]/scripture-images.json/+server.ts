import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadScriptureImagesForBook } from '$lib/library/server/scripture-index-loaders';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Recorded scripture-page thumbs. Fetched when the disclosure opens, not on book detail load. */
export const GET: RequestHandler = async ({ locals, params }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const bookId = params.id?.trim() ?? '';
	if (!UUID_RE.test(bookId)) error(400, 'Invalid book.');

	const images = await loadScriptureImagesForBook(locals.supabase, bookId);
	return json({ images });
};
