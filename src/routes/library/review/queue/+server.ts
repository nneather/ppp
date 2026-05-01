import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { countReviewQueue, loadPeople, loadReviewQueue } from '$lib/library/server/loaders';
import { parseReviewFilters } from '../+page.server';

/**
 * Incremental refetch endpoint for `/library/review`. Returns the next batch
 * of cards (excluding the client-tracked skipped + just-saved ids) plus the
 * fresh remaining count.
 *
 * Called by the page when the local card stack drops below 3, so swiping
 * never blocks on a network round-trip. Auth-gated (same as the page load).
 *
 * Query params:
 *   - All `/library/review` filter params (?subject=, ?match_type=, …)
 *   - ?exclude=<csv of UUIDs>  — skipped + already-saved this session
 *   - ?limit=<int>             — defaults to 10
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const supabase = locals.supabase;
	const filters = parseReviewFilters(url);

	const excludeRaw = url.searchParams.get('exclude') ?? '';
	const excludeIds = excludeRaw
		.split(',')
		.map((s) => s.trim())
		.filter((s) => /^[0-9a-f-]{36}$/i.test(s));

	const limitRaw = parseInt(url.searchParams.get('limit') ?? '10', 10);
	const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 50 ? limitRaw : 10;

	const people = await loadPeople(supabase);
	const [cards, remaining] = await Promise.all([
		loadReviewQueue(supabase, people, filters, { limit, excludeIds }),
		countReviewQueue(supabase, filters)
	]);

	return json({ cards, remaining });
};
