import { describe, expect, it } from 'vitest';
import {
	aggregateScriptureCounts,
	formatVolumePage,
	parsePageFilter,
	parsePassageFilter,
	parseScriptureManageFilters,
	passageSearchHref,
	scriptureManageFiltersToSearchParams,
	shouldUseInlineList,
	type ScriptureCountRow
} from '../scripture-index';

const rows: ScriptureCountRow[] = [
	{ book_id: 'v1', bible_book: 'Genesis', chapter_start: 1, n: 10 },
	{ book_id: 'v1', bible_book: 'Genesis', chapter_start: 2, n: 5 },
	{ book_id: 'v2', bible_book: 'Genesis', chapter_start: 1, n: 3 },
	{ book_id: 'v2', bible_book: 'John', chapter_start: 8, n: 20 },
	{ book_id: 'v2', bible_book: 'Romans', chapter_start: null, n: 2 },
	{ book_id: 'v3', bible_book: 'Tobit', chapter_start: 5, n: 1 }
];

describe('aggregateScriptureCounts', () => {
	it('sums totals and groups by canon order with chapter chips', () => {
		const t = aggregateScriptureCounts(rows);
		expect(t.total).toBe(41);
		expect(t.bibleBookCount).toBe(4);
		expect(t.books.map((b) => b.bible_book)).toEqual(['Genesis', 'John', 'Romans', 'Tobit']);
		expect(t.ot.map((b) => b.bible_book)).toEqual(['Genesis']);
		expect(t.nt.map((b) => b.bible_book)).toEqual(['John', 'Romans']);
		expect(t.other.map((b) => b.bible_book)).toEqual(['Tobit']);
		const gen = t.books.find((b) => b.bible_book === 'Genesis')!;
		expect(gen.count).toBe(18);
		expect(gen.chapters).toEqual([
			{ chapter: 1, count: 13 },
			{ chapter: 2, count: 5 }
		]);
		const rom = t.books.find((b) => b.bible_book === 'Romans')!;
		expect(rom.count).toBe(2);
		expect(rom.chapters).toEqual([{ chapter: null, count: 2 }]);
	});

	it('scopes to a volume book id set', () => {
		const t = aggregateScriptureCounts(rows, new Set(['v2']));
		expect(t.total).toBe(25);
		expect(t.books.map((b) => b.bible_book)).toEqual(['Genesis', 'John', 'Romans']);
	});
});

describe('shouldUseInlineList', () => {
	it('is true at or below the threshold', () => {
		expect(shouldUseInlineList(150)).toBe(true);
		expect(shouldUseInlineList(151)).toBe(false);
		expect(shouldUseInlineList(0)).toBe(true);
	});
});

describe('parsePassageFilter', () => {
	it('parses a full book passage', () => {
		expect(parsePassageFilter('Romans 9:1-5')).toMatchObject({
			bible_book: 'Romans',
			chapter_start: 9,
			verse_start: 1,
			chapter_end: 9,
			verse_end: 5
		});
	});

	it('parses bare chapter:verse', () => {
		expect(parsePassageFilter('9:1-5')).toEqual({
			bible_book: null,
			chapter_start: 9,
			verse_start: 1,
			chapter_end: 9,
			verse_end: 5
		});
		expect(parsePassageFilter('12')).toEqual({
			bible_book: null,
			chapter_start: 12,
			verse_start: null,
			chapter_end: null,
			verse_end: null
		});
	});

	it('returns null for empty / nonsense', () => {
		expect(parsePassageFilter('')).toBeNull();
		expect(parsePassageFilter('   ')).toBeNull();
		expect(parsePassageFilter('zzz')).toBeNull();
	});
});

describe('parsePageFilter', () => {
	it('detects arabic and exact tokens', () => {
		expect(parsePageFilter('620')).toEqual({ kind: 'arabic', page: 620 });
		expect(parsePageFilter('III.2.12')).toEqual({ kind: 'exact', token: 'III.2.12' });
		expect(parsePageFilter('')).toBeNull();
	});
});

describe('manage filters URL round-trip', () => {
	it('parses and serializes', () => {
		const params = new URLSearchParams(
			'scope=set&bible_book=John&chapter=8&passage=8%3A11&page=112&needs_review=1&offset=100'
		);
		const f = parseScriptureManageFilters(params);
		expect(f).toMatchObject({
			scope: 'set',
			bibleBook: 'John',
			chapter: 8,
			passage: '8:11',
			page: '112',
			needsReview: true,
			offset: 100
		});
		expect(scriptureManageFiltersToSearchParams(f).toString()).toBe(
			'scope=set&bible_book=John&chapter=8&passage=8%3A11&page=112&needs_review=1&offset=100'
		);
	});

	it('defaults scope to volume', () => {
		expect(parseScriptureManageFilters(new URLSearchParams()).scope).toBe('volume');
	});
});

describe('formatVolumePage / passageSearchHref', () => {
	it('prefixes volume when present', () => {
		expect(formatVolumePage('II', '620')).toBe('II:620');
		expect(formatVolumePage('2', '211', '12')).toBe('2:211–12');
		expect(formatVolumePage(null, 'xiv')).toBe('xiv');
	});

	it('builds a passage-search URL', () => {
		expect(passageSearchHref({ bibleBook: '1 Thessalonians', chapter: 1, verse: 5 })).toBe(
			'/library/search-passage?bible_book=1+Thessalonians&chapter=1&verse=5'
		);
	});
});
