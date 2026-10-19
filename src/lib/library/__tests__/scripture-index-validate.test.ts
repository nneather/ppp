import { describe, expect, it } from 'vitest';
import { flagIndexCandidates, validateIndexRows } from '../scripture-index-validate';

describe('validateIndexRows', () => {
	it('flags chapter out of range and out-of-order rows', () => {
		const issues = validateIndexRows([
			{ bible_book: 'Romans', chapter_start: 8, verse_start: 1, page_start: '10' },
			{ bible_book: 'Romans', chapter_start: 99, verse_start: 1, page_start: '11' },
			{ bible_book: 'Matthew', chapter_start: 1, verse_start: 1, page_start: '12' }
		]);
		expect(issues.some((i) => i.reason === 'chapter_out_of_range')).toBe(true);
		expect(issues.some((i) => i.reason === 'out_of_canonical_order')).toBe(true);
	});

	it('flags consensus misses and lowers confidence', () => {
		const flagged = flagIndexCandidates([
			{
				bible_book: 'Romans',
				chapter_start: 8,
				verse_start: 1,
				page_start: '100',
				confidence_score: 0.95,
				consensus_flag: 'pass_a_only'
			}
		]);
		expect(flagged[0]!.confidence_score).toBeLessThan(0.8);
		expect(flagged[0]!.review_note).toContain('pass_a_only');
	});

	it('does not treat a section locator as a page number', () => {
		const issues = validateIndexRows(
			[{ bible_book: 'Romans', chapter_start: 5, verse_start: 5, page_start: 'III.2.12' }],
			{ pageMin: 10, pageMax: 500 }
		);
		expect(issues.some((i) => i.reason.startsWith('page_'))).toBe(false);
	});

	it('keeps a version tag and flags an edition marker', () => {
		const flagged = flagIndexCandidates([
			{
				bible_book: 'Genesis',
				chapter_start: 1,
				verse_start: 2,
				page_start: '1.13.14',
				review_note: 'cf Vg',
				confidence_score: 0.95
			},
			{
				bible_book: 'Genesis',
				chapter_start: 1,
				verse_start: 1,
				page_start: 'PA 3',
				confidence_score: 0.95
			}
		]);
		expect(flagged[0]!.confidence_score).toBe(0.95);
		expect(flagged[0]!.review_note).toBe('cf Vg');
		expect(flagged[1]!.confidence_score).toBeLessThan(0.8);
		expect(flagged[1]!.review_note).toContain('edition_PA');
	});

	it('flags a one-digit page among three-digit pages in the same volume', () => {
		const issues = validateIndexRows([
			{
				bible_book: 'John',
				chapter_start: 6,
				verse_start: 54,
				page_start: '475',
				volume: '3'
			},
			{
				bible_book: 'John',
				chapter_start: 6,
				verse_start: 54,
				page_start: '5',
				volume: '3'
			},
			{
				bible_book: 'John',
				chapter_start: 6,
				verse_start: 54,
				page_start: '516',
				volume: '3'
			},
			{
				bible_book: 'Romans',
				chapter_start: 1,
				verse_start: 1,
				page_start: '7',
				volume: '1'
			},
			{
				bible_book: 'Romans',
				chapter_start: 1,
				verse_start: 1,
				page_start: '214',
				volume: '2'
			}
		]);
		const shorts = issues.filter((i) => i.reason === 'short_page_among_longer');
		expect(shorts).toEqual([{ index: 1, reason: 'short_page_among_longer' }]);
	});

	it('flags pages outside outline bounds', () => {
		const issues = validateIndexRows(
			[{ bible_book: 'Romans', chapter_start: 1, verse_start: 1, page_start: '5' }],
			{ pageMin: 10, pageMax: 500 }
		);
		expect(issues.some((i) => i.reason === 'page_below_outline')).toBe(true);
	});
});
