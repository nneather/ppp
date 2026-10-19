import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadByBookStats, parseByBookListFilters } from '$lib/sermons/server/loaders';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:sermons:by-book');

	const filters = parseByBookListFilters(url);
	const result = await loadByBookStats(locals.supabase, filters);

	return {
		rows: result.rows,
		summary: result.summary,
		filters: result.filters,
		loadError: result.error
	};
};
