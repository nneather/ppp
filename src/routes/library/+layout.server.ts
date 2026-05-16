import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import {
	loadBibleBookNames,
	loadPeople,
	loadSeries
} from '$lib/library/server/loaders';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:library:facets');

	const supabase = locals.supabase;
	const [people, series, bibleBookNames] = await Promise.all([
		loadPeople(supabase),
		loadSeries(supabase),
		loadBibleBookNames(supabase)
	]);

	return { people, series, bibleBookNames };
};
