import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import {
	countLiveBooks,
	loadBibleBookNames,
	loadSeries
} from '$lib/library/server/loaders';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:library:facets');

	const supabase = locals.supabase;
	const [series, bibleBookNames, totalCount] = await Promise.all([
		loadSeries(supabase),
		loadBibleBookNames(supabase),
		countLiveBooks(supabase)
	]);

	return { series, bibleBookNames, totalCount };
};
