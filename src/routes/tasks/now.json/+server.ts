import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadNowTaskRail } from '$lib/projects/server/task-loaders';

/** Desktop Now rail — Critical + Opportunity only. Authenticated; never cache. */
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const rail = await loadNowTaskRail(locals.supabase, user.id);
	return json(rail, {
		headers: {
			'Cache-Control': 'private, no-store'
		}
	});
};
