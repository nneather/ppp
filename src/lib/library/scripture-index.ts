/**
 * Pure helpers for the book-detail scripture index summary / dialog / manage page.
 * Client-safe — no Supabase.
 */
import {
	ALL_BIBLE_BOOK_NAMES,
	APOCRYPHA_BOOK_NAMES,
	BIBLE_BOOK_NAMES
} from '$lib/library/bible-book-names';
import { parsePassageDisplay } from '$lib/sermons/passage-parse';

/** Below this total in the active scope, book detail renders the inline list. */
export const SCRIPTURE_INDEX_INLINE_THRESHOLD = 150;

export const SCRIPTURE_INDEX_MANAGE_PAGE_SIZE = 100;

/** OT ends at Malachi (index 38); NT starts at Matthew. */
export const OT_BOOK_COUNT = 39;

export type ScriptureCountRow = {
	book_id: string;
	bible_book: string;
	chapter_start: number | null;
	n: number;
};

export type BibleBookTally = {
	bible_book: string;
	count: number;
	/**
	 * chapter_start → count. `chapter: null` is the whole-book chip (refs with
	 * null chapter_start); numbered chapters follow in order.
	 */
	chapters: { chapter: number | null; count: number }[];
};

export type ScriptureIndexTallies = {
	total: number;
	bibleBookCount: number;
	books: BibleBookTally[];
	ot: BibleBookTally[];
	nt: BibleBookTally[];
	/** NRSV Apocrypha (`APOCRYPHA_BOOK_NAMES`), in that order. */
	apocrypha: BibleBookTally[];
	/** Names in neither the canon nor the Apocrypha list. */
	other: BibleBookTally[];
};

export function shouldUseInlineList(total: number): boolean {
	return total <= SCRIPTURE_INDEX_INLINE_THRESHOLD;
}

/**
 * Aggregate RPC rows into canon-ordered Bible-book tallies (+ chapter chips).
 * When `scopeBookIds` is set, only those book_ids contribute.
 */
export function aggregateScriptureCounts(
	rows: ScriptureCountRow[],
	scopeBookIds?: ReadonlySet<string> | readonly string[]
): ScriptureIndexTallies {
	const scope =
		scopeBookIds == null
			? null
			: scopeBookIds instanceof Set
				? scopeBookIds
				: new Set(scopeBookIds);

	const byBook = new Map<string, { total: number; chapters: Map<number | null, number> }>();
	let total = 0;

	for (const row of rows) {
		if (scope && !scope.has(row.book_id)) continue;
		const n = Number(row.n) || 0;
		if (n <= 0) continue;
		total += n;
		const slot = byBook.get(row.bible_book) ?? { total: 0, chapters: new Map() };
		slot.total += n;
		const ch = row.chapter_start;
		slot.chapters.set(ch, (slot.chapters.get(ch) ?? 0) + n);
		byBook.set(row.bible_book, slot);
	}

	const sortChapterEntries = (
		entries: [number | null, number][]
	): { chapter: number | null; count: number }[] =>
		entries
			.sort((a, b) => {
				if (a[0] == null) return -1;
				if (b[0] == null) return 1;
				return a[0] - b[0];
			})
			.map(([chapter, count]) => ({ chapter, count }));

	const toTally = (
		bible_book: string,
		slot: { total: number; chapters: Map<number | null, number> }
	): BibleBookTally => ({
		bible_book,
		count: slot.total,
		chapters: sortChapterEntries([...slot.chapters.entries()])
	});

	const takeNamed = (names: readonly string[]): BibleBookTally[] => {
		const out: BibleBookTally[] = [];
		for (const name of names) {
			const slot = byBook.get(name);
			if (!slot) continue;
			byBook.delete(name);
			out.push(toTally(name, slot));
		}
		return out;
	};

	const canonIndex = new Map(BIBLE_BOOK_NAMES.map((name, i) => [name, i]));
	const canon = takeNamed(BIBLE_BOOK_NAMES);
	const apocrypha = takeNamed(APOCRYPHA_BOOK_NAMES);

	const other: BibleBookTally[] = [...byBook.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([bible_book, slot]) => toTally(bible_book, slot));

	const ot: BibleBookTally[] = [];
	const nt: BibleBookTally[] = [];
	for (const b of canon) {
		const idx = canonIndex.get(b.bible_book) ?? -1;
		if (idx >= 0 && idx < OT_BOOK_COUNT) ot.push(b);
		else nt.push(b);
	}

	const books = [...canon, ...apocrypha, ...other];

	return {
		total,
		bibleBookCount: books.length,
		books,
		ot,
		nt,
		apocrypha,
		other
	};
}

export type ScriptureIndexScope = 'volume' | 'set';

export type ScriptureManageFilters = {
	scope: ScriptureIndexScope;
	bibleBook: string | null;
	chapter: number | null;
	/** Free-text passage (e.g. "Rom 9:1-5" or "9:1"). */
	passage: string | null;
	/** Exact page token or arabic page number filter. */
	page: string | null;
	needsReview: boolean | null;
	offset: number;
	limit: number;
};

export type ParsedPassageFilter = {
	bible_book: string | null;
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
};

/**
 * Parse manage-page passage filter. Prefers full book+range via parsePassageDisplay;
 * bare "9:1-5" / "9" falls back to chapter/verse without a bible_book.
 */
export function parsePassageFilter(raw: string | null | undefined): ParsedPassageFilter | null {
	const t = (raw ?? '').trim();
	if (!t) return null;

	const parsed = parsePassageDisplay(t, ALL_BIBLE_BOOK_NAMES);
	if (parsed.length > 0) {
		const first = parsed[0]!;
		return {
			bible_book: first.bible_book,
			chapter_start: first.chapter_start,
			verse_start: first.verse_start,
			chapter_end: first.chapter_end ?? (parsed.length === 1 ? first.chapter_end : null),
			verse_end:
				parsed.length === 1
					? first.verse_end
					: (parsed[parsed.length - 1]!.verse_end ?? parsed[parsed.length - 1]!.verse_start)
		};
	}

	const chapterOnly = t.match(/^(\d{1,3})$/);
	if (chapterOnly) {
		const ch = Number(chapterOnly[1]);
		return {
			bible_book: null,
			chapter_start: ch,
			verse_start: null,
			chapter_end: null,
			verse_end: null
		};
	}

	const cv = t.match(/^(\d{1,3}):(\d{1,3})(?:\s*[-–—]\s*(\d{1,3})(?::(\d{1,3}))?)?$/);
	if (cv) {
		const ch = Number(cv[1]);
		const vs = Number(cv[2]);
		const endA = cv[3] != null ? Number(cv[3]) : null;
		const endB = cv[4] != null ? Number(cv[4]) : null;
		if (endA != null && endB != null) {
			return {
				bible_book: null,
				chapter_start: ch,
				verse_start: vs,
				chapter_end: endA,
				verse_end: endB
			};
		}
		if (endA != null) {
			return {
				bible_book: null,
				chapter_start: ch,
				verse_start: vs,
				chapter_end: ch,
				verse_end: endA
			};
		}
		return {
			bible_book: null,
			chapter_start: ch,
			verse_start: vs,
			chapter_end: null,
			verse_end: null
		};
	}

	return null;
}

export type ParsedPageFilter =
	| { kind: 'exact'; token: string }
	| { kind: 'arabic'; page: number };

/** Exact token (incl. section locators) or a bare arabic page number. */
export function parsePageFilter(raw: string | null | undefined): ParsedPageFilter | null {
	const t = (raw ?? '').trim();
	if (!t) return null;
	if (/^\d{1,5}$/.test(t)) return { kind: 'arabic', page: Number(t) };
	return { kind: 'exact', token: t };
}

export function parseScriptureManageFilters(
	params: URLSearchParams,
	defaults?: { scope?: ScriptureIndexScope }
): ScriptureManageFilters {
	const scopeRaw = (params.get('scope') ?? defaults?.scope ?? 'volume').trim().toLowerCase();
	const scope: ScriptureIndexScope = scopeRaw === 'set' ? 'set' : 'volume';

	const bibleBook = params.get('bible_book')?.trim() || null;
	const chapterRaw = params.get('chapter')?.trim() ?? '';
	const chapter = chapterRaw === '' ? null : Number(chapterRaw);
	const passage = params.get('passage')?.trim() || null;
	const page = params.get('page')?.trim() || null;

	const reviewRaw = (params.get('needs_review') ?? '').trim().toLowerCase();
	let needsReview: boolean | null = null;
	if (reviewRaw === '1' || reviewRaw === 'true' || reviewRaw === 'yes') needsReview = true;
	else if (reviewRaw === '0' || reviewRaw === 'false' || reviewRaw === 'no') needsReview = false;

	const offsetRaw = Number(params.get('offset') ?? '0');
	const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;
	const limitRaw = Number(params.get('limit') ?? String(SCRIPTURE_INDEX_MANAGE_PAGE_SIZE));
	const limit =
		Number.isFinite(limitRaw) && limitRaw > 0
			? Math.min(Math.floor(limitRaw), 200)
			: SCRIPTURE_INDEX_MANAGE_PAGE_SIZE;

	return {
		scope,
		bibleBook,
		chapter: chapter != null && Number.isInteger(chapter) && chapter >= 0 ? chapter : null,
		passage,
		page,
		needsReview,
		offset,
		limit
	};
}

export function scriptureManageFiltersToSearchParams(
	filters: ScriptureManageFilters
): URLSearchParams {
	const p = new URLSearchParams();
	if (filters.scope === 'set') p.set('scope', 'set');
	if (filters.bibleBook) p.set('bible_book', filters.bibleBook);
	if (filters.chapter != null) p.set('chapter', String(filters.chapter));
	if (filters.passage) p.set('passage', filters.passage);
	if (filters.page) p.set('page', filters.page);
	if (filters.needsReview === true) p.set('needs_review', '1');
	if (filters.needsReview === false) p.set('needs_review', '0');
	if (filters.offset > 0) p.set('offset', String(filters.offset));
	if (filters.limit !== SCRIPTURE_INDEX_MANAGE_PAGE_SIZE) p.set('limit', String(filters.limit));
	return p;
}

/** Format vol:page for set-scope display (volume from books.volume_number). */
export function formatVolumePage(
	volumeNumber: string | null | undefined,
	pageStart: string,
	pageEnd?: string | null
): string {
	const pages =
		pageEnd && pageEnd.trim() && pageEnd.trim() !== pageStart.trim()
			? `${pageStart.trim()}–${pageEnd.trim()}`
			: pageStart.trim();
	const vol = (volumeNumber ?? '').trim();
	if (!vol) return pages;
	return `${vol}:${pages}`;
}

export function passageSearchHref(opts: {
	bibleBook: string;
	chapter?: number | null;
	verse?: number | null;
}): string {
	const p = new URLSearchParams();
	p.set('bible_book', opts.bibleBook);
	if (opts.chapter != null) p.set('chapter', String(opts.chapter));
	if (opts.verse != null) p.set('verse', String(opts.verse));
	return `/library/search-passage?${p.toString()}`;
}
