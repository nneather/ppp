import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadBookListFiltered } from '$lib/library/server/loaders';
import { parseBookListFilters } from '$lib/library/server/url-params';
import { LIBRARY_PAGE_SIZE } from '$lib/types/library';

export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const offsetRaw = url.searchParams.get('offset');
	const offset = Math.max(0, Number.parseInt(offsetRaw ?? '0', 10) || 0);

	const supabase = locals.supabase;
	const filters = parseBookListFilters(url);
	// Embedded `people` on book_authors — no layout `loadPeople` refetch per scroll chunk.
	const { books, filteredCount } = await loadBookListFiltered(supabase, [], filters, {
		limit: LIBRARY_PAGE_SIZE,
		offset
	});

	return json({ books, filteredCount });
};
