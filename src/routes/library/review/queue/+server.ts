import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { countReviewQueue, loadPeople, loadReviewQueue } from '$lib/library/server/loaders';
import { parseReviewFilters, withReviewShelfDefault } from '$lib/library/review';

/**
 * Incremental refetch endpoint for `/library/review`. Returns the next batch
 * of cards (excluding the client-tracked skipped + just-saved ids) plus the
 * fresh remaining count.
 *
 * Called by the page when the local card stack drops below 3, so swiping
 * never blocks on a network round-trip. Auth-gated (same as the page load).
 *
 * Query params:
 *   - All `/library/review` filter params (?subject=, ?match_type=, ?missing=,
 *     ?shelf=, ?proposal=, ?isbn=, ?shuffle=, …)
 *   - ?exclude=<csv of UUIDs>  — skipped + already-saved this session
 *   - ?limit=<int>             — defaults to 10
 *
 * `shelf` gets the same away-from-shelf default as the page load so refill
 * batches never resurface `Deferred shelf-check:` books mid-session. When
 * `?shuffle=1`, each refill draws from a fresh random window.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) error(401, 'Unauthorized');

	const supabase = locals.supabase;
	const filters = withReviewShelfDefault(parseReviewFilters(url));

	const excludeRaw = url.searchParams.get('exclude') ?? '';
	const excludeIds = excludeRaw
		.split(',')
		.map((s) => s.trim())
		.filter((s) => /^[0-9a-f-]{36}$/i.test(s));

	const limitRaw = parseInt(url.searchParams.get('limit') ?? '10', 10);
	const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 50 ? limitRaw : 10;

	const people = await loadPeople(supabase);
	const [cards, remaining] = await Promise.all([
		loadReviewQueue(supabase, people, filters, {
			limit,
			excludeIds,
			shufflePivot: filters.shuffle ? crypto.randomUUID() : null
		}),
		countReviewQueue(supabase, filters)
	]);

	return json({ cards, remaining });
};
