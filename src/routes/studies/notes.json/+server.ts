import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadNotesOnCatalog } from '$lib/studies/server/note-loaders';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Notes on one catalog row in studies other than the one open. */
export const GET: RequestHandler = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const bookId = url.searchParams.get('book_id');
	const essayId = url.searchParams.get('essay_id');
	const articleId = url.searchParams.get('article_id');
	const exclude = url.searchParams.get('exclude_study');
	const picked = [bookId, essayId, articleId].filter((value) => value && UUID_RE.test(value));
	if (picked.length !== 1) error(400, 'One catalog id is required');

	const result = await loadNotesOnCatalog(locals.supabase, {
		bookId,
		essayId,
		articleId,
		excludeStudyId: exclude && UUID_RE.test(exclude) ? exclude : null
	});
	return json(result);
};
