import { describe, expect, it } from 'vitest';
import {
	bookListFiltersAreDefault,
	bookListFiltersToSearchParams,
	libraryListFormAction,
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

describe('libraryListFormAction', () => {
	it('is a bare named action when the list URL has no search', () => {
		const url = new URL('https://example.test/library');
		expect(libraryListFormAction('updateReadingStatus', url)).toBe('?/updateReadingStatus');
	});

	it('keeps q and facets, and strips a prior action name', () => {
		const url = new URL(
			'https://example.test/library?/updateReadingStatus&q=Calvin&reading_status=unread&deleted=abc'
		);
		expect(libraryListFormAction('updateReadingStatus', url)).toBe(
			'?/updateReadingStatus&q=Calvin&reading_status=unread&deleted=abc'
		);
		expect(libraryListFormAction('bulkUpdateBooks', url)).toBe(
			'?/bulkUpdateBooks&q=Calvin&reading_status=unread&deleted=abc'
		);
	});
});
