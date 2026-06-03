import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getBibleBookNames } from '$lib/library/bible-book-names';
import { loadSeries } from '$lib/library/server/loaders';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	depends('app:library:facets');

	const series = await locals.perf.measure('db', () => loadSeries(locals.supabase));

	return { series, bibleBookNames: getBibleBookNames() };
};
