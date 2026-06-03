import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadSeries } from '$lib/library/server/loaders';

/** Facet vocabulary — cacheable by the service worker (see service-worker.ts). */
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const series = await loadSeries(locals.supabase);
	return json(
		{ series },
		{
			headers: {
				'Cache-Control': 'private, max-age=300'
			}
		}
	);
};
