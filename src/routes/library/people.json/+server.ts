import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadPeople } from '$lib/library/server/loaders';

/** Facet author picker — avoids shipping ~900 people on every `/library/*` layout load. */
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const people = await loadPeople(locals.supabase);
	return json({ people });
};
