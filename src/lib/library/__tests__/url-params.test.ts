import { describe, expect, it } from 'vitest';
import {
	bookListFiltersAreDefault,
	bookListFiltersToSearchParams,
	parseBookListFilters
} from '$lib/library/server/url-params';

describe('parseBookListFilters', () => {
	it('parses bible_book facet (repeated + CSV) and drops unknown names', () => {
		const url = new URL(
			'https://example.test/library?bible_book=Romans&bible_book=Genesis,NotABook'
		);
		const filters = parseBookListFilters(url);
		expect(filters.bible_book).toEqual(['Romans', 'Genesis']);
	});

	it('round-trips bible_book through search params', () => {
		const params = bookListFiltersToSearchParams({
			bible_book: ['Mark', 'John']
		});
		expect(params.getAll('bible_book')).toEqual(['Mark', 'John']);
		expect(bookListFiltersAreDefault({ bible_book: ['Mark'] })).toBe(false);
		expect(bookListFiltersAreDefault({})).toBe(true);
	});
});
