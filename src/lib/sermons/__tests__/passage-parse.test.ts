import { describe, expect, it } from 'vitest';
import {
	formatPassageRow,
	librarySearchHref,
	parsePassageDisplay
} from '../passage-parse';

describe('parsePassageDisplay', () => {
	it('parses a simple verse range', () => {
		expect(parsePassageDisplay('Mark 1:16-34')).toEqual([
			{
				bible_book: 'Mark',
				chapter_start: 1,
				verse_start: 16,
				chapter_end: 1,
				verse_end: 34
			}
		]);
	});

	it('parses chapter-only', () => {
		expect(parsePassageDisplay('Genesis 15')).toEqual([
			{
				bible_book: 'Genesis',
				chapter_start: 15,
				verse_start: null,
				chapter_end: null,
				verse_end: null
			}
		]);
	});

	it('parses numbered books', () => {
		expect(parsePassageDisplay('1 John 1:1-4')[0]?.bible_book).toBe('1 John');
		expect(parsePassageDisplay('2 Corinthians 5:1-10')[0]?.bible_book).toBe('2 Corinthians');
	});

	it('expands Proverbs-style clusters', () => {
		const rows = parsePassageDisplay(
			'Proverbs 14:17, 29; 15:1; 16:32; 19:11-12; 22:24-25; 25:28'
		);
		expect(rows.length).toBe(7);
		expect(rows[0]).toMatchObject({ chapter_start: 14, verse_start: 17, verse_end: null });
		expect(rows[1]).toMatchObject({ chapter_start: 14, verse_start: 29 });
		expect(rows[4]).toMatchObject({ chapter_start: 19, verse_start: 11, verse_end: 12 });
	});

	it('returns empty for unknown book', () => {
		expect(parsePassageDisplay('NotABook 1:1')).toEqual([]);
	});
});

describe('librarySearchHref', () => {
	it('builds search-passage URL', () => {
		expect(
			librarySearchHref({
				bible_book: 'Mark',
				chapter_start: 1,
				verse_start: 16,
				chapter_end: 1,
				verse_end: 34
			})
		).toBe('/library/search-passage?bible_book=Mark&chapter=1&verse=16');
	});
});

describe('formatPassageRow', () => {
	it('formats ranges', () => {
		expect(
			formatPassageRow({
				bible_book: 'Mark',
				chapter_start: 1,
				verse_start: 16,
				chapter_end: 1,
				verse_end: 34
			})
		).toBe('Mark 1:16–34');
	});
});
