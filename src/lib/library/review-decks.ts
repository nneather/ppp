import type { Genre, ReviewQueueFilters, ReviewSlice } from '$lib/types/library';
import { defaultReviewSlice } from '$lib/library/turabian/review-progress';

/**
 * Deck routing for `/library/review` — each deck is a named, pre-baked filter
 * set with a live count, replacing the old flat slice-pill rail. Client-safe
 * (no server imports): the page renders the picker from this list and the
 * page server counts each deck via `countReviewQueue(deck.filters)`.
 */
export type ReviewDeckKey =
	| 'critical'
	| 'genre_sprint'
	| 'research'
	| 'puzzle'
	| 'backlog'
	| 'shelf';

export type ReviewDeckSpec = {
	key: ReviewDeckKey;
	label: string;
	/** One-line hint under the label in the picker. */
	hint: string;
	filters: ReviewQueueFilters;
	/** Hide the deck from the picker when its count is 0. */
	hideWhenEmpty?: boolean;
};

export const REVIEW_DECKS: ReviewDeckSpec[] = [
	{
		key: 'critical',
		label: 'Citation Critical',
		hint: 'Full Turabian check',
		filters: { slice: 'critical' }
	},
	{
		key: 'genre_sprint',
		label: 'Genre Sprint',
		hint: 'One tap per book',
		filters: { missing: 'genre' }
	},
	{
		key: 'research',
		label: 'Research',
		hint: 'AI proposals ready',
		filters: { proposal: 'pending' },
		hideWhenEmpty: true
	},
	{
		key: 'puzzle',
		label: 'Puzzles',
		hint: 'No ISBN, no OL match',
		filters: { import_match_type: ['no-match'], isbn_blank: true }
	},
	{
		key: 'backlog',
		label: 'Backlog',
		hint: 'Everything else',
		filters: { slice: 'backlog' }
	},
	{
		key: 'shelf',
		label: 'Needs the shelf',
		hint: 'Waits for August',
		filters: { shelf: 'only' },
		hideWhenEmpty: true
	}
];

/** URL params that route to a specific deck/slice (vs. plain list filters). */
const DECK_ROUTING_PARAMS = [
	'slice',
	'subject',
	'match_type',
	'missing',
	'proposal',
	'isbn',
	'shelf'
] as const;

/**
 * True when the URL already routes to a deck — used by the page load and the
 * page's onMount URL normalizer to decide whether to inject the date-gated
 * default slice. Without this guard, `?missing=genre` would get
 * `slice=critical` stacked on top and return an empty queue.
 */
export function hasReviewDeckParams(url: URL): boolean {
	return DECK_ROUTING_PARAMS.some((p) => url.searchParams.has(p));
}

/**
 * Which slice a confirm in this filter set should credit (localStorage
 * progress + burndown denominator). Explicit `slice` wins; the fast-lane and
 * provenance decks all drain general-library books, so they credit backlog.
 */
export function sliceForReviewFilters(filters: ReviewQueueFilters, d = new Date()): ReviewSlice {
	if (filters.slice) return filters.slice;
	if (
		filters.missing === 'genre' ||
		filters.proposal === 'pending' ||
		filters.isbn_blank === true ||
		filters.shelf === 'only' ||
		filters.subject_blank === true ||
		(filters.import_match_type?.length ?? 0) > 0
	) {
		return 'backlog';
	}
	return defaultReviewSlice(d);
}

/**
 * A deck is active when its routing params match the current URL filters.
 * `shelf` only distinguishes the "Needs the shelf" deck — the server defaults
 * every other deck to `shelf=exclude`, so it is ignored here otherwise.
 */
export function isReviewDeckActive(deck: ReviewDeckSpec, filters: ReviewQueueFilters): boolean {
	const f = deck.filters;
	if ((f.slice ?? null) !== (filters.slice ?? null)) return false;
	if ((f.missing ?? null) !== (filters.missing ?? null)) return false;
	if ((f.proposal ?? null) !== (filters.proposal ?? null)) return false;
	if ((f.isbn_blank ?? false) !== (filters.isbn_blank ?? false)) return false;
	if ((f.subject_blank ?? false) !== (filters.subject_blank ?? false)) return false;
	const wantMatch = f.import_match_type ?? [];
	const haveMatch = filters.import_match_type ?? [];
	if (wantMatch.length !== haveMatch.length || !wantMatch.every((m) => haveMatch.includes(m)))
		return false;
	if ((f.shelf === 'only') !== (filters.shelf === 'only')) return false;
	return true;
}

/** Build the URL search params for a deck (drops all other deck-routing params). */
export function reviewDeckSearchParams(deck: ReviewDeckSpec, current: URLSearchParams): URLSearchParams {
	const params = new URLSearchParams(current);
	for (const key of ['slice', 'subject', 'match_type', 'missing', 'proposal', 'isbn', 'shelf']) {
		params.delete(key);
	}
	const f = deck.filters;
	if (f.slice) params.set('slice', f.slice);
	if (f.subject_blank) params.set('subject', 'blank');
	if (f.missing) params.set('missing', f.missing);
	if (f.proposal) params.set('proposal', f.proposal);
	if (f.isbn_blank) params.set('isbn', 'blank');
	if (f.shelf) params.set('shelf', f.shelf);
	for (const m of f.import_match_type ?? []) params.append('match_type', m);
	return params;
}

/**
 * Most-shelved genres (prod frequency, 2026-07) — the Genre Sprint chip row
 * shows these first; "More…" reveals the full closed enum.
 */
export const REVIEW_TOP_GENRES: Genre[] = [
	'Commentary',
	'Literature',
	'Biblical Reference',
	'Historical Theology',
	'Bibles',
	'Christian Living',
	'Systematic Theology',
	'History'
];
