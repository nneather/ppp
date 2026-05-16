import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadBookListFiltered, loadPeople } from '$lib/library/server/loaders';
import { parseBookListFilters } from '$lib/library/server/url-params';
import { LIBRARY_PAGE_SIZE } from '$lib/types/library';

export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const offsetRaw = url.searchParams.get('offset');
	const offset = Math.max(0, Number.parseInt(offsetRaw ?? '0', 10) || 0);

	const supabase = locals.supabase;
	const filters = parseBookListFilters(url);
	const people = await loadPeople(supabase);
	const all = await loadBookListFiltered(supabase, people, filters);
	const books = all.slice(offset, offset + LIBRARY_PAGE_SIZE);

	return json({ books, filteredCount: all.length });
};
