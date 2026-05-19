import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadAncientTexts } from '$lib/library/server/loaders';

/** Full ancient-texts list for the coverage editor — lazy-loaded from book detail. */
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const ancientTexts = await loadAncientTexts(locals.supabase);
	return json({ ancientTexts });
};
