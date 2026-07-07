import { multiParam } from '$lib/library/server/url-params';
import { CITATION_CRITICAL_GENRES } from '$lib/library/turabian/types';
import {
	IMPORT_MATCH_TYPES,
	LANGUAGES,
	READING_STATUSES
} from '$lib/types/library';
import type {
	ImportMatchType,
	Language,
	ReadingStatus,
	ReviewQueueFilters,
	ReviewShelfFilter,
	ReviewSlice
} from '$lib/types/library';

const SLICE_SET = new Set<ReviewSlice>(['critical', 'backlog']);
const SHELF_SET = new Set<ReviewShelfFilter>(['only', 'exclude', 'all']);

/**
 * Substring on `needs_review_note` marking books that cannot be resolved
 * without the physical shelf (edition/volume/ISBN questions). The importer's
 * `Deferred shelf-check:` prefix did not survive later passes — prod notes are
 * free-text ("verify at shelf", "Shelf-check pending", "verify binding at
 * shelf"), so the word itself is the reliable marker (44 rows, all verified
 * shelf-bound as of 2026-07).
 */
export const SHELF_CHECK_MARKER = 'shelf';

export function parseReviewFilters(url: URL): ReviewQueueFilters {
	const filters: ReviewQueueFilters = {};

	const genres = multiParam(url, 'genre');
	if (genres.length > 0) filters.genre = genres;

	const series = multiParam(url, 'series_id');
	if (series.length > 0) filters.series_id = series;

	const langSet = new Set<Language>(LANGUAGES);
	const langs = multiParam(url, 'language').filter((l): l is Language =>
		langSet.has(l as Language)
	);
	if (langs.length > 0) filters.language = langs;

	const statusSet = new Set<ReadingStatus>(READING_STATUSES);
	const statuses = multiParam(url, 'reading_status').filter((s): s is ReadingStatus =>
		statusSet.has(s as ReadingStatus)
	);
	if (statuses.length > 0) filters.reading_status = statuses;

	if (url.searchParams.get('subject') === 'blank') filters.subject_blank = true;

	const matchSet = new Set<ImportMatchType>(IMPORT_MATCH_TYPES);
	const matches = multiParam(url, 'match_type').filter((m): m is ImportMatchType =>
		matchSet.has(m as ImportMatchType)
	);
	if (matches.length > 0) filters.import_match_type = matches;

	const sliceParam = url.searchParams.get('slice');
	if (sliceParam && SLICE_SET.has(sliceParam as ReviewSlice)) {
		filters.slice = sliceParam as ReviewSlice;
	}

	if (url.searchParams.get('missing') === 'genre') filters.missing = 'genre';

	const shelfParam = url.searchParams.get('shelf');
	if (shelfParam && SHELF_SET.has(shelfParam as ReviewShelfFilter)) {
		filters.shelf = shelfParam as ReviewShelfFilter;
	}

	if (url.searchParams.get('proposal') === 'pending') filters.proposal = 'pending';

	if (url.searchParams.get('isbn') === 'blank') filters.isbn_blank = true;

	if (url.searchParams.get('shuffle') === '1') filters.shuffle = true;

	return filters;
}

/**
 * Away-from-shelf default: when the URL carries no `shelf` param, hide the
 * `Deferred shelf-check:` books from every deck — they are unresolvable until
 * August. `?shelf=all` opts out explicitly; the "Needs the shelf" deck uses
 * `?shelf=only`. Applied by the page load AND the queue refill endpoint so
 * counts and cards always agree.
 */
export function withReviewShelfDefault(filters: ReviewQueueFilters): ReviewQueueFilters {
	if (filters.shelf) return filters;
	return { ...filters, shelf: 'exclude' };
}

type ReviewFilterableQuery = {
	in(column: string, values: string[]): ReviewFilterableQuery;
	is(column: string, value: null): ReviewFilterableQuery;
	not(column: string, operator: string, value: unknown): ReviewFilterableQuery;
	ilike(column: string, pattern: string): ReviewFilterableQuery;
	or(filters: string, options?: { foreignTable?: string }): ReviewFilterableQuery;
};

/** Apply Citation Critical / Backlog slice to a Supabase books query builder. */
export function applyReviewSliceGenreFilter<T extends ReviewFilterableQuery>(
	query: T,
	slice: ReviewSlice | undefined
): T {
	if (!slice) return query;
	const genres = [...CITATION_CRITICAL_GENRES];
	if (slice === 'critical') {
		return query.in('genre', genres) as T;
	}
	// Backlog: genre IS NULL OR genre not in scholarly core
	const quoted = genres.map((g) => `"${g.replace(/"/g, '""')}"`).join(',');
	return query.or(`genre.is.null,genre.not.in.(${quoted})`) as T;
}

/**
 * Apply the deck-routing filters (`missing=genre`, `shelf=`, `isbn=blank`) to a
 * Supabase books query builder. Shared by `loadReviewQueue` + `countReviewQueue`
 * so cards and counts never disagree. The `proposal=pending` filter is applied
 * at the loader level (it needs an `!inner` embed on the select string).
 */
export function applyReviewDeckFilters<T extends ReviewFilterableQuery>(
	query: T,
	filters: ReviewQueueFilters
): T {
	let q: ReviewFilterableQuery = query;
	if (filters.missing === 'genre') {
		// Genre is the ONLY citation-critical gap: title/year/publisher present.
		q = q
			.is('genre', null)
			.not('title', 'is', null)
			.not('year', 'is', null)
			.or('publisher.not.is.null,publisher_id.not.is.null');
	}
	if (filters.isbn_blank === true) {
		q = q.is('isbn', null);
	}
	if (filters.shelf === 'only') {
		q = q.ilike('needs_review_note', `%${SHELF_CHECK_MARKER}%`);
	} else if (filters.shelf === 'exclude') {
		// NOT ILIKE alone would also drop NULL notes — keep them explicitly.
		q = q.or(`needs_review_note.is.null,needs_review_note.not.ilike."*${SHELF_CHECK_MARKER}*"`);
	}
	return q as T;
}

export { CITATION_CRITICAL_GENRES };
