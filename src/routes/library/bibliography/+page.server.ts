import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadBookCitationInputs, loadPeople } from '$lib/library/server/loaders';
import { formatCompiledBibliography } from '$lib/library/turabian';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const idsParam = url.searchParams.get('ids') ?? '';
	const ids = idsParam
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	const people = await loadPeople(locals.supabase);
	const books = await loadBookCitationInputs(locals.supabase, ids, people);
	const compiled = formatCompiledBibliography(books);

	return {
		ids,
		books,
		compiled
	};
};
