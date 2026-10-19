import { describe, expect, it } from 'vitest';
import { consensusAllOk, mergeIndexChecker, mergeOcrConsensus } from '../scripture-ocr-consensus';

describe('mergeOcrConsensus', () => {
	it('marks exact matches ok and singles as pass-only', () => {
		const a = [
			{
				bible_book: 'Romans',
				chapter_start: 8,
				verse_start: 1,
				page_start: '100',
				confidence_score: 0.95
			},
			{
				bible_book: 'Romans',
				chapter_start: 8,
				verse_start: 28,
				page_start: '110',
				confidence_score: 0.9
			}
		];
		const b = [
			{
				bible_book: 'Romans',
				chapter_start: 8,
				verse_start: 1,
				page_start: '100',
				confidence_score: 0.92
			},
			{
				bible_book: 'Romans',
				chapter_start: 8,
				verse_start: 29,
				page_start: '111',
				confidence_score: 0.88
			}
		];
		const merged = mergeOcrConsensus(a, b);
		expect(merged.filter((r) => r.consensus_flag === 'ok')).toHaveLength(1);
		expect(merged.filter((r) => r.consensus_flag === 'pass_a_only')).toHaveLength(1);
		expect(merged.filter((r) => r.consensus_flag === 'pass_b_only')).toHaveLength(1);
		expect(consensusAllOk(merged)).toBe(false);
	});

	it('keeps two identical printed lines when both passes saw both', () => {
		const row = {
			bible_book: 'Genesis',
			chapter_start: 1,
			verse_start: 27,
			page_start: '2.1.1',
			confidence_score: 0.9
		};
		const merged = mergeOcrConsensus([row, row], [row, row]);
		expect(merged).toHaveLength(2);
		expect(merged.every((r) => r.consensus_flag === 'ok')).toBe(true);
	});
});

describe('mergeIndexChecker', () => {
	it('keeps the writer book when the checker names a different book', () => {
		const merged = mergeIndexChecker(
			[
				{
					bible_book: 'John',
					chapter_start: 6,
					verse_start: 54,
					page_start: '516',
					volume: '3',
					confidence_score: 0.95
				}
			],
			[
				{
					bible_book: 'Matthew',
					chapter_start: 6,
					verse_start: 54,
					page_start: '516',
					volume: '3',
					confidence_score: 0.9
				}
			]
		);
		expect(merged).toHaveLength(1);
		expect(merged[0]!.bible_book).toBe('John');
		expect(merged[0]!.consensus_flag).toBe('ok');
	});

	it('keeps one writer row when the checker read a different page', () => {
		const merged = mergeIndexChecker(
			[
				{
					bible_book: 'Romans',
					chapter_start: 1,
					verse_start: 3,
					page_start: '32',
					volume: '2',
					confidence_score: 0.9
				}
			],
			[
				{
					bible_book: 'Romans',
					chapter_start: 1,
					verse_start: 3,
					page_start: '320',
					volume: '2',
					confidence_score: 0.9
				}
			]
		);
		expect(merged).toHaveLength(1);
		expect(merged[0]!.page_start).toBe('32');
		expect(merged[0]!.consensus_flag).toBe('checker_mismatch');
		expect(merged[0]!.review_note).toBe('checker 2:320');
	});

	it('adds a book-blank row for a verse only the checker saw', () => {
		const merged = mergeIndexChecker(
			[],
			[
				{
					bible_book: 'Matthew',
					chapter_start: 6,
					verse_start: 55,
					page_start: '512',
					volume: '3',
					confidence_score: 0.9
				}
			]
		);
		expect(merged).toHaveLength(1);
		expect(merged[0]!.bible_book).toBe('');
		expect(merged[0]!.continuation_from_previous_page).toBe(true);
		expect(merged[0]!.page_start).toBe('512');
		expect(merged[0]!.consensus_flag).toBe('checker_only');
	});
});
