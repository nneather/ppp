import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadResourceSetList } from '$lib/studies/server/resource-set-loaders';

export const load: PageServerLoad = async ({ locals, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	depends('app:studies:sets');
	const { groups, error } = await loadResourceSetList(locals.supabase);
	return { groups, loadError: error };
};
