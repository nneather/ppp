import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadBookListFiltered, loadEssaySearchHits } from '$lib/library/server/loaders';
import { parseBookListFilters } from '$lib/library/server/url-params';
import { LIBRARY_PAGE_SIZE } from '$lib/types/library';

export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const offsetRaw = url.searchParams.get('offset');
	const offset = Math.max(0, Number.parseInt(offsetRaw ?? '0', 10) || 0);

	const supabase = locals.supabase;
	const filters = parseBookListFilters(url);
	const q = filters.q?.trim() ?? '';

	const booksPromise = loadBookListFiltered(supabase, [], filters, {
		limit: LIBRARY_PAGE_SIZE,
		offset
	});
	// Essay hits only on the first page of a keyword search (not on infinite-scroll chunks).
	const essayHitsPromise =
		offset === 0 && q.length > 0
			? loadEssaySearchHits(supabase, q)
			: Promise.resolve([]);

	const [{ books, filteredCount }, essayHits] = await Promise.all([
		booksPromise,
		essayHitsPromise
	]);

	return json({ books, filteredCount, essayHits });
};
