import { describe, expect, it } from 'vitest';
import {
	assignPassageBands,
	rangesOverlap,
	searchPassageAbsBounds
} from '../passage-search-bands';

describe('searchPassageAbsBounds', () => {
	it('treats bible-book-only as whole book', () => {
		expect(
			searchPassageAbsBounds({
				chapter: null,
				verse: null,
				chapterEnd: null,
				verseEnd: null
			})
		).toEqual({ start: 0, end: 999999 });
	});

	it('uses chapter span when only chapter is set', () => {
		expect(
			searchPassageAbsBounds({
				chapter: 5,
				verse: null,
				chapterEnd: null,
				verseEnd: null
			})
		).toEqual({ start: 5000, end: 5999 });
	});

	it('uses same-chapter verse range', () => {
		expect(
			searchPassageAbsBounds({
				chapter: 6,
				verse: 25,
				chapterEnd: null,
				verseEnd: 34
			})
		).toEqual({ start: 6025, end: 6034 });
	});

	it('uses cross-chapter end bounds', () => {
		expect(
			searchPassageAbsBounds({
				chapter: 5,
				verse: 1,
				chapterEnd: 7,
				verseEnd: 29
			})
		).toEqual({ start: 5001, end: 7029 });
	});
});

describe('rangesOverlap', () => {
	it('detects Matt 5–7 overlapping Matt 6:25', () => {
		expect(rangesOverlap(5000, 7999, 6025, 6025)).toBe(true);
	});

	it('rejects non-overlapping ranges', () => {
		expect(rangesOverlap(5000, 5999, 8000, 8999)).toBe(false);
	});
});

describe('assignPassageBands', () => {
	it('puts Commentary coverage first and keeps index rows', () => {
		const bands = assignPassageBands({
			coverages: [
				{ bookId: 'comm-1', genre: 'Commentary' },
				{ bookId: 'theo-1', genre: 'Theology' }
			],
			sections: [{ bookId: 'bonhoeffer' }, { bookId: 'comm-1' }],
			indexHits: [{ bookId: 'comm-1' }, { bookId: 'index-only' }]
		});

		expect([...bands.commentaryBookIds]).toEqual(['comm-1']);
		// Commentary wins over a section for the same book.
		expect(bands.sectionBookIds.has('comm-1')).toBe(false);
		expect([...bands.sectionBookIds]).toEqual(['bonhoeffer']);
		expect([...bands.coverageBookIds]).toEqual(['theo-1']);
	});

	it('omits section books from other coverage', () => {
		const bands = assignPassageBands({
			coverages: [{ bookId: 'bonhoeffer', genre: 'Theology' }],
			sections: [{ bookId: 'bonhoeffer' }],
			indexHits: []
		});
		expect([...bands.sectionBookIds]).toEqual(['bonhoeffer']);
		expect(bands.coverageBookIds.size).toBe(0);
	});
});
