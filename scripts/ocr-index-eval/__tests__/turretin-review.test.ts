import { describe, expect, it } from 'vitest';
import {
	isOpenBlock,
	parseReviewBlocks,
	reasonPrefix,
	summarizeReview
} from '../turretin-review.ts';

describe('turretin-review', () => {
	it('parses open, corrected, and skip blocks', () => {
		const text = [
			'# p.760 col 1',
			'reason: suspicious_verse_token',
			'book: John',
			'8:141—3:100',
			'',
			'# p.766 col 2',
			'reason: suspicious_verse_token',
			'book: Romans',
			'7:1749—2:100',
			'corrected: 7:17–19—2:100',
			'',
			'# p.754 col 1',
			'reason: unrecognized line',
			'book: 1 Maccabees',
			'book of—3:49',
			'skip: whole-book pointer',
			''
		].join('\n');

		const blocks = parseReviewBlocks(text);
		expect(blocks).toHaveLength(3);
		expect(isOpenBlock(blocks[0]!)).toBe(true);
		expect(isOpenBlock(blocks[1]!)).toBe(false);
		expect(blocks[1]!.corrected).toBe('7:17–19—2:100');
		expect(isOpenBlock(blocks[2]!)).toBe(false);
		expect(blocks[2]!.skip).toBe('whole-book pointer');
	});

	it('summarizes by reason prefix and open pages', () => {
		const blocks = parseReviewBlocks(
			[
				'# p.760 col 1',
				'reason: validateIndexRows: chapter_out_of_range',
				'book: Psalms',
				'200:1—1:1',
				'',
				'# p.760 col 2',
				'reason: suspicious_verse_token',
				'book: John',
				'8:141—3:1',
				'',
				'# p.754 col 1',
				'reason: unrecognized line',
				'noise',
				'skip: header',
				''
			].join('\n')
		);
		const summary = summarizeReview(blocks);
		expect(summary.open).toBe(2);
		expect(summary.skipped).toBe(1);
		expect(summary.byReasonPrefix['validateIndexRows']).toBe(1);
		expect(summary.byReasonPrefix['suspicious_verse_token']).toBe(1);
		expect(summary.openByPrintedPage[760]).toBe(2);
		expect(reasonPrefix('validateIndexRows: chapter_out_of_range')).toBe('validateIndexRows');
	});

	it('treats legacy second differing line as corrected', () => {
		const blocks = parseReviewBlocks(
			['# p.1 col 1', 'reason: bad', 'book: John', '8:141—3:1', '8:1–11—3:1', ''].join('\n')
		);
		expect(blocks[0]!.corrected).toBe('8:1–11—3:1');
		expect(isOpenBlock(blocks[0]!)).toBe(false);
	});
});
