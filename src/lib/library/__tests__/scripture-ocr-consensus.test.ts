import { describe, expect, it } from 'vitest';
import { consensusAllOk, mergeOcrConsensus } from '../scripture-ocr-consensus';

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
});
