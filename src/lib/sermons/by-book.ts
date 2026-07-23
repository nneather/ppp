/**
 * Pure helpers for `/sermons/by-book` — sort, filter, commentary ordering.
 * Aggregation from Supabase lives in `server/loaders.ts`.
 */

import { BIBLE_BOOK_NAMES } from '$lib/library/bible-book-names';
import {
	BY_BOOK_SORTS,
	type ByBookListFilters,
	type ByBookRow,
	type ByBookShelfHit,
	type ByBookSort,
	type ByBookSortDir,
	type ByBookSummary,
	type ByBookTestamentFilter
} from '$lib/types/sermons';

/** Protestant OT book count (Genesis … Malachi). */
export const OT_BOOK_COUNT = 39;

export function testamentForCanonIndex(canonIndex: number): 'ot' | 'nt' {
	return canonIndex < OT_BOOK_COUNT ? 'ot' : 'nt';
}

/** Empty canon spine — metrics filled by the loader. */
export function emptyByBookRows(): ByBookRow[] {
	return BIBLE_BOOK_NAMES.map((bibleBook, canonIndex) => ({
		bibleBook,
		canonIndex,
		testament: testamentForCanonIndex(canonIndex),
		sermonCount: 0,
		latestSermonOn: null,
		commentaryCount: 0,
		fourStarCount: 0,
		commentaries: [],
		alsoOnShelf: []
	}));
}

/** Rated high→low, then title; unrated last. */
export function compareCommentaryHits(a: ByBookShelfHit, b: ByBookShelfHit): number {
	const ar = a.rating;
	const br = b.rating;
	if (ar != null && br != null && ar !== br) return br - ar;
	if (ar != null && br == null) return -1;
	if (ar == null && br != null) return 1;
	return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}

export function sortShelfHits(hits: ByBookShelfHit[]): ByBookShelfHit[] {
	return hits.slice().sort(compareCommentaryHits);
}

/**
 * Collapse multi-part / multi-edition commentaries that share a series + author set
 * into one hit (per Bible book). Standalone books (no series) stay one-per-bookId.
 */
export function commentaryCollapseKey(hit: ByBookShelfHit): string {
	if (hit.seriesId) {
		return `series:${hit.seriesId}:${hit.authorKey ?? ''}`;
	}
	return `book:${hit.bookId}`;
}

function preferHit(a: ByBookShelfHit, b: ByBookShelfHit): ByBookShelfHit {
	const cmp = compareCommentaryHits(a, b);
	if (cmp <= 0) return a;
	return b;
}

/**
 * When a parent commentary has essay-level coverage for this Bible book, drop the
 * volume-level hit so ESVEC/NIB show the signed essay (not both).
 */
export function preferEssayHitsOverParentBooks(hits: ByBookShelfHit[]): ByBookShelfHit[] {
	const parentsWithEssay = new Set<string>();
	for (const hit of hits) {
		if (hit.kind === 'essay') parentsWithEssay.add(hit.bookId);
	}
	if (parentsWithEssay.size === 0) return hits;
	return hits.filter((hit) => !(hit.kind === 'book' && parentsWithEssay.has(hit.bookId)));
}

export function collapseCommentaryHits(hits: ByBookShelfHit[]): ByBookShelfHit[] {
	const groups = new Map<string, ByBookShelfHit[]>();
	for (const hit of preferEssayHitsOverParentBooks(hits)) {
		const key = commentaryCollapseKey(hit);
		const list = groups.get(key) ?? [];
		list.push(hit);
		groups.set(key, list);
	}

	const collapsed: ByBookShelfHit[] = [];
	for (const members of groups.values()) {
		if (members.length === 1) {
			collapsed.push(members[0]!);
			continue;
		}
		let preferred = members[0]!;
		for (let i = 1; i < members.length; i++) {
			preferred = preferHit(preferred, members[i]!);
		}
		const titles: string[] = [];
		const seen = new Set<string>();
		for (const m of members.slice().sort(compareCommentaryHits)) {
			const t = m.title.trim();
			if (!t) continue;
			const norm = t.toLowerCase();
			if (seen.has(norm)) continue;
			seen.add(norm);
			titles.push(t);
		}
		let maxRating: number | null = null;
		for (const m of members) {
			if (m.rating == null) continue;
			if (maxRating == null || m.rating > maxRating) maxRating = m.rating;
		}
		collapsed.push({
			...preferred,
			title: titles.length > 0 ? titles.join('; ') : preferred.title,
			rating: maxRating
		});
	}
	return collapsed;
}

/** Header totals from the full (unfiltered) canon spine + distinct sermon count. */
export function summarizeByBookRows(rows: ByBookRow[], sermonTotal: number): ByBookSummary {
	const commentaryBookIds = new Set<string>();
	const fourStarBookIds = new Set<string>();
	for (const row of rows) {
		for (const c of row.commentaries) {
			commentaryBookIds.add(c.bookId);
			if (c.rating != null && c.rating >= 4) fourStarBookIds.add(c.bookId);
		}
	}
	return {
		sermonTotal,
		commentaryTotal: commentaryBookIds.size,
		fourStarTotal: fourStarBookIds.size
	};
}

export function filterByBookRows(rows: ByBookRow[], filters: ByBookListFilters): ByBookRow[] {
	return rows.filter((row) => {
		if (filters.testament === 'ot' && row.testament !== 'ot') return false;
		if (filters.testament === 'nt' && row.testament !== 'nt') return false;
		if (filters.hasSermons && row.sermonCount === 0) return false;
		if (filters.hasFourStar && row.fourStarCount === 0) return false;
		return true;
	});
}

function metricValue(row: ByBookRow, sort: ByBookSort): number {
	switch (sort) {
		case 'sermons':
			return row.sermonCount;
		case 'commentaries':
			return row.commentaryCount;
		case 'four_star':
			return row.fourStarCount;
		case 'canon':
			return row.canonIndex;
	}
}

/**
 * Bidirectional sort. For `canon`, asc = Genesis→Revelation.
 * For metrics, desc = most first (UI default when picking a metric sort).
 */
export function sortByBookRows(
	rows: ByBookRow[],
	sort: ByBookSort,
	sortDir: ByBookSortDir
): ByBookRow[] {
	const mult = sortDir === 'asc' ? 1 : -1;
	return rows.slice().sort((a, b) => {
		const av = metricValue(a, sort);
		const bv = metricValue(b, sort);
		if (av !== bv) return (av - bv) * mult;
		return a.canonIndex - b.canonIndex;
	});
}

export function defaultSortDir(sort: ByBookSort): ByBookSortDir {
	return sort === 'canon' ? 'asc' : 'desc';
}

export function parseByBookListFilters(url: URL): ByBookListFilters {
	const sortRaw = (url.searchParams.get('sort') ?? 'canon').trim();
	const sort = (BY_BOOK_SORTS as readonly string[]).includes(sortRaw)
		? (sortRaw as ByBookSort)
		: 'canon';

	const dirRaw = (url.searchParams.get('dir') ?? '').trim();
	let sortDir: ByBookSortDir;
	if (dirRaw === 'asc' || dirRaw === 'desc') {
		sortDir = dirRaw;
	} else {
		sortDir = defaultSortDir(sort);
	}

	const testamentRaw = (url.searchParams.get('testament') ?? '').trim().toLowerCase();
	const testament: ByBookTestamentFilter =
		testamentRaw === 'ot' || testamentRaw === 'nt' ? testamentRaw : null;

	return {
		sort,
		sortDir,
		testament,
		hasSermons: url.searchParams.get('has_sermons') === '1',
		hasFourStar: url.searchParams.get('has_4star') === '1'
	};
}

export function byBookFiltersToSearchParams(filters: ByBookListFilters): URLSearchParams {
	const params = new URLSearchParams();
	if (filters.sort !== 'canon') params.set('sort', filters.sort);
	const def = defaultSortDir(filters.sort);
	if (filters.sortDir !== def) params.set('dir', filters.sortDir);
	if (filters.testament) params.set('testament', filters.testament);
	if (filters.hasSermons) params.set('has_sermons', '1');
	if (filters.hasFourStar) params.set('has_4star', '1');
	return params;
}

export function librarySearchPassageHref(bibleBook: string): string {
	const params = new URLSearchParams({
		bible_book: bibleBook,
		returnTo: '/sermons/by-book'
	});
	return `/library/search-passage?${params.toString()}`;
}

export function sermonsListByBookHref(bibleBook: string): string {
	const params = new URLSearchParams({ bible_book: bibleBook });
	return `/sermons?${params.toString()}`;
}
