import { describe, expect, it } from 'vitest';
import {
	BATCH_SAVE_CHUNK_SIZE,
	buildRowsJsonPayload,
	chunkArray,
	collapseRowsAfterMerge,
	computeRowWindow,
	continuationNeedsBookRow,
	isRowSaveableFields
} from './scripture-batch-upload';

describe('collapseRowsAfterMerge', () => {
	it('collapses all except continuation-needs-book', () => {
		const rows = [
			{
				continuation_from_previous_page: false,
				bible_book: 'Genesis',
				expanded: true,
				needs_review: true
			},
			{
				continuation_from_previous_page: true,
				bible_book: '',
				expanded: false,
				needs_review: true
			}
		];
		const out = collapseRowsAfterMerge(rows);
		expect(out[0]!.expanded).toBe(false);
		expect(out[1]!.expanded).toBe(true);
	});
});

describe('continuationNeedsBookRow', () => {
	it('detects empty book with continuation flag', () => {
		expect(continuationNeedsBookRow(true, '')).toBe(true);
		expect(continuationNeedsBookRow(true, 'John')).toBe(false);
	});
});

describe('buildRowsJsonPayload', () => {
	it('includes only included saveable rows', () => {
		const payload = buildRowsJsonPayload([
			{
				included: true,
				bible_book: 'John',
				page_start: '1',
				chapter_start: '',
				verse_start: '',
				chapter_end: '',
				verse_end: '',
				page_end: '',
				needs_review: false,
				review_note: '',
				confidence_score: 0.9,
				source_image_url: 'path/a.jpg'
			},
			{
				included: false,
				bible_book: 'John',
				page_start: '2',
				chapter_start: '',
				verse_start: '',
				chapter_end: '',
				verse_end: '',
				page_end: '',
				needs_review: false,
				review_note: '',
				confidence_score: null,
				source_image_url: ''
			},
			{
				included: true,
				bible_book: '',
				page_start: '',
				chapter_start: '',
				verse_start: '',
				chapter_end: '',
				verse_end: '',
				page_end: '',
				needs_review: true,
				review_note: '',
				confidence_score: null,
				source_image_url: ''
			}
		]);
		expect(payload).toHaveLength(1);
		expect(payload[0]!.bible_book).toBe('John');
		expect(payload[0]!.source_image_url).toBe('path/a.jpg');
	});
});

describe('chunkArray', () => {
	it('splits at chunk size', () => {
		expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
	});

	it('uses BATCH_SAVE_CHUNK_SIZE convention', () => {
		const items = Array.from({ length: 80 }, (_, i) => i);
		const chunks = chunkArray(items, BATCH_SAVE_CHUNK_SIZE);
		expect(chunks).toHaveLength(2);
		expect(chunks[0]).toHaveLength(75);
		expect(chunks[1]).toHaveLength(5);
	});
});

describe('computeRowWindow', () => {
	it('returns a slice with spacers for long lists', () => {
		const rows = Array.from({ length: 100 }, (_, i) => ({
			expanded: false,
			pageJobOrder: 1,
			prevPageJobOrder: 1
		}));
		const w = computeRowWindow(rows, 500, 400, 5);
		expect(w.start).toBeGreaterThan(0);
		expect(w.end).toBeLessThan(100);
		expect(w.topSpacer).toBeGreaterThan(0);
		expect(w.bottomSpacer).toBeGreaterThan(0);
	});
});

describe('isRowSaveableFields', () => {
	it('requires book and page', () => {
		expect(isRowSaveableFields('Romans', '12')).toBe(true);
		expect(isRowSaveableFields('', '12')).toBe(false);
	});
});
