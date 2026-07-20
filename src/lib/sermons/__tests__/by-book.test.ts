import { describe, expect, it } from 'vitest';
import {
	byBookFiltersToSearchParams,
	compareCommentaryHits,
	defaultSortDir,
	emptyByBookRows,
	filterByBookRows,
	OT_BOOK_COUNT,
	parseByBookListFilters,
	sortByBookRows,
	summarizeByBookRows,
	testamentForCanonIndex
} from '$lib/sermons/by-book';
import type { ByBookListFilters, ByBookRow, ByBookShelfHit } from '$lib/types/sermons';

function hit(partial: Partial<ByBookShelfHit> & { title: string }): ByBookShelfHit {
	return {
		kind: 'book',
		bookId: partial.bookId ?? 'b1',
		essayId: null,
		title: partial.title,
		authorShort: partial.authorShort ?? null,
		rating: partial.rating ?? null,
		genre: partial.genre ?? 'Commentary',
		href: partial.href ?? '/library/books/b1'
	};
}

function baseFilters(over: Partial<ByBookListFilters> = {}): ByBookListFilters {
	return {
		sort: 'canon',
		sortDir: 'asc',
		testament: null,
		hasSermons: false,
		noCommentaries: false,
		hasFourStar: false,
		...over
	};
}

describe('by-book canon spine', () => {
	it('builds 66 rows with OT/NT split', () => {
		const rows = emptyByBookRows();
		expect(rows).toHaveLength(66);
		expect(rows[0]?.bibleBook).toBe('Genesis');
		expect(rows[OT_BOOK_COUNT - 1]?.testament).toBe('ot');
		expect(rows[OT_BOOK_COUNT]?.bibleBook).toBe('Matthew');
		expect(rows[OT_BOOK_COUNT]?.testament).toBe('nt');
		expect(testamentForCanonIndex(0)).toBe('ot');
		expect(testamentForCanonIndex(65)).toBe('nt');
	});
});

describe('compareCommentaryHits', () => {
	it('orders rated high→low, unrated last, then title', () => {
		const a = hit({ title: 'Zebra', rating: 3, bookId: 'a' });
		const b = hit({ title: 'Alpha', rating: 5, bookId: 'b' });
		const c = hit({ title: 'Beta', rating: null, bookId: 'c' });
		const d = hit({ title: 'Gamma', rating: 5, bookId: 'd' });
		const sorted = [a, b, c, d].sort(compareCommentaryHits);
		expect(sorted.map((h) => h.title)).toEqual(['Alpha', 'Gamma', 'Zebra', 'Beta']);
	});
});

describe('filter + sort', () => {
	const rows: ByBookRow[] = emptyByBookRows().map((r) => {
		if (r.bibleBook === 'Genesis') {
			return {
				...r,
				sermonCount: 2,
				commentaryCount: 1,
				fourStarCount: 1,
				commentaries: [hit({ title: 'Wenham', rating: 5, bookId: 'w' })],
				alsoOnShelf: []
			};
		}
		if (r.bibleBook === 'Matthew') {
			return {
				...r,
				sermonCount: 0,
				commentaryCount: 0,
				fourStarCount: 0,
				commentaries: [],
				alsoOnShelf: []
			};
		}
		if (r.bibleBook === 'Romans') {
			return {
				...r,
				sermonCount: 5,
				commentaryCount: 3,
				fourStarCount: 0,
				commentaries: [
					hit({ title: 'Moo', rating: 3, bookId: 'm' }),
					hit({ title: 'Cranfield', rating: 2, bookId: 'c' }),
					hit({ title: 'Dunn', rating: null, bookId: 'd' })
				],
				alsoOnShelf: []
			};
		}
		return r;
	});

	it('filters OT / has sermons / no commentaries / has 4★+', () => {
		expect(filterByBookRows(rows, baseFilters({ testament: 'ot' })).every((r) => r.testament === 'ot'))
			.toBe(true);
		expect(filterByBookRows(rows, baseFilters({ hasSermons: true })).map((r) => r.bibleBook)).toEqual(
			['Genesis', 'Romans']
		);
		expect(
			filterByBookRows(rows, baseFilters({ noCommentaries: true, testament: 'nt' })).some(
				(r) => r.bibleBook === 'Matthew'
			)
		).toBe(true);
		expect(
			filterByBookRows(rows, baseFilters({ hasFourStar: true })).map((r) => r.bibleBook)
		).toEqual(['Genesis']);
	});

	it('sorts metrics bidirectionally with canon tiebreak', () => {
		const subset = rows.filter((r) =>
			['Genesis', 'Matthew', 'Romans'].includes(r.bibleBook)
		);
		const most = sortByBookRows(subset, 'sermons', 'desc');
		expect(most.map((r) => r.bibleBook)).toEqual(['Romans', 'Genesis', 'Matthew']);
		const least = sortByBookRows(subset, 'sermons', 'asc');
		expect(least.map((r) => r.bibleBook)).toEqual(['Matthew', 'Genesis', 'Romans']);
		const canon = sortByBookRows(subset, 'canon', 'asc');
		expect(canon.map((r) => r.bibleBook)).toEqual(['Genesis', 'Matthew', 'Romans']);
	});
});

describe('URL filters', () => {
	it('parses and round-trips non-default params', () => {
		const url = new URL(
			'https://example.test/sermons/by-book?sort=sermons&dir=asc&testament=nt&has_sermons=1&no_commentaries=1&has_4star=1'
		);
		const f = parseByBookListFilters(url);
		expect(f).toEqual({
			sort: 'sermons',
			sortDir: 'asc',
			testament: 'nt',
			hasSermons: true,
			noCommentaries: true,
			hasFourStar: true
		});
		expect(byBookFiltersToSearchParams(f).toString()).toBe(
			'sort=sermons&dir=asc&testament=nt&has_sermons=1&no_commentaries=1&has_4star=1'
		);
	});

	it('defaults metric sort dir to desc and canon to asc', () => {
		expect(defaultSortDir('canon')).toBe('asc');
		expect(defaultSortDir('four_star')).toBe('desc');
		expect(parseByBookListFilters(new URL('https://x/sermons/by-book?sort=commentaries')).sortDir).toBe(
			'desc'
		);
	});
});

describe('summarizeByBookRows', () => {
	it('counts distinct commentaries and 4★+ books', () => {
		const rows = emptyByBookRows().map((r) => {
			if (r.bibleBook === 'Genesis' || r.bibleBook === 'Exodus') {
				return {
					...r,
					commentaries: [hit({ title: 'Shared', rating: 5, bookId: 'same' })]
				};
			}
			if (r.bibleBook === 'Matthew') {
				return {
					...r,
					commentaries: [hit({ title: 'Other', rating: 3, bookId: 'other' })]
				};
			}
			return r;
		});
		const s = summarizeByBookRows(rows, 12);
		expect(s.sermonTotal).toBe(12);
		expect(s.commentaryTotal).toBe(2);
		expect(s.fourStarTotal).toBe(1);
	});
});
