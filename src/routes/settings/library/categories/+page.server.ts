import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadCategories } from '$lib/library/server/loaders';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const categories = await loadCategories(locals.supabase);

	return { categories };
};
