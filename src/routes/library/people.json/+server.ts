import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadPeople, loadPersonBookCounts } from '$lib/library/server/loaders';

/** Facet author picker — avoids shipping ~1k people on every `/library/*` layout load. */
export const GET: RequestHandler = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const withCounts = url.searchParams.get('counts') === '1';
	const [people, counts] = await Promise.all([
		loadPeople(locals.supabase),
		withCounts ? loadPersonBookCounts(locals.supabase) : Promise.resolve(null)
	]);
	return json(
		{
			people,
			...(counts ? { personBookCounts: Object.fromEntries(counts) } : {})
		},
		{
			headers: {
				'Cache-Control': 'private, max-age=300'
			}
		}
	);
};
