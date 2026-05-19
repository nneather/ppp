import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadPublishers } from '$lib/library/server/loaders';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	const publishers = await loadPublishers(locals.supabase);
	return { publishers };
};
