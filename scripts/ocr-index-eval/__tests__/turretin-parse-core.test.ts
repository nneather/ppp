import { describe, expect, it } from 'vitest';
import { parseIndexEntry } from '../parse-index-line.ts';
import {
	isRunningHeader,
	parseTurretinLines,
	type ParsedColumnLine
} from '../turretin-parse-core.ts';
import type { ReviewBlock } from '../turretin-review.ts';

function lines(...parts: Array<[number, number, string]>): ParsedColumnLine[] {
	return parts.map(([printedPage, column, text]) => ({ printedPage, column, text }));
}

describe('parseTurretinLines', () => {
	it('flushes pending Luke entry before John heading', () => {
		const result = parseTurretinLines(
			lines(
				[760, 1, 'Luke'],
				[760, 1, '24:52—3:100'],
				[760, 1, 'John'],
				[760, 1, '1:1—1:10']
			)
		);
		expect(result.review).toHaveLength(0);
		expect(result.linesOut).toContain('# book Luke');
		expect(result.linesOut).toContain('24:52—3:100');
		expect(result.linesOut).toContain('# book John');
		expect(result.rows.map((r) => r.bible_book)).toEqual(['Luke', 'John']);
	});

	it('treats apocrypha headings as books (Son of Sirach → Sirach)', () => {
		const result = parseTurretinLines(
			lines(
				[753, 3, 'Malachi'],
				[753, 3, '4:5—1:283'],
				[753, 3, '2 Esdras'],
				[753, 3, '4:23—1:59, 98'],
				[754, 1, 'Tobit'],
				[754, 1, '5:12—1:103'],
				[754, 1, 'Son of Sirach'],
				[754, 1, '1:21—2:681'],
				[754, 2, 'Matthew'],
				[754, 2, '1:1—2:309']
			)
		);
		expect(result.review).toHaveLength(0);
		const books = result.rows.map((r) => r.bible_book);
		expect(books).toContain('2 Esdras');
		expect(books).toContain('Tobit');
		expect(books).toContain('Sirach');
		expect(books).not.toContain('Son of Sirach');
		expect(books).toContain('Matthew');
	});

	it('sends apocrypha chapter out of range to review', () => {
		const result = parseTurretinLines(
			lines([754, 1, 'Tobit'], [754, 1, '15:1—1:100'])
		);
		expect(result.rows).toHaveLength(0);
		expect(result.review.some((r) => r.reason.includes('chapter_out_of_range'))).toBe(true);
	});

	it('normalizes FineReader glued 8:141 to 8:1–11', () => {
		const result = parseTurretinLines(
			lines([760, 1, 'John'], [760, 1, '8:141—1:115'])
		);
		expect(result.review).toHaveLength(0);
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]?.verse_start).toBe(1);
		expect(result.rows[0]?.verse_end).toBe(11);
	});

	it('accepts short page among longer siblings (does not reject short_page_among_longer at accept)', () => {
		// Valid index line: verse 1:10 with pages 1:10 and 1:242 (digit lengths 2 and 3).
		// validateIndexRows would flag short_page_among_longer; accept gate must ignore it.
		const result = parseTurretinLines(
			lines([740, 1, 'Genesis'], [740, 1, '1:10—1:10, 242'])
		);
		expect(result.review).toHaveLength(0);
		expect(result.rows).toHaveLength(2);
		expect(result.rows.map((r) => r.page_start)).toEqual(['10', '242']);
	});

	it('reorders chapters within a book after parse (10:6 before 10:3 in PDF)', () => {
		const result = parseTurretinLines(
			lines(
				[740, 1, 'Matthew'],
				[740, 1, '10:6—3:167'],
				[740, 1, '10:3—3:131']
			)
		);
		expect(result.review).toHaveLength(0);
		expect(result.rows).toHaveLength(2);
		expect(result.rows[0]?.chapter_start).toBe(10);
		expect(result.rows[0]?.verse_start).toBe(3);
	});

	it('merges continuation line onto pending entry', () => {
		const result = parseTurretinLines(
			lines(
				[754, 3, 'Malachi'],
				[754, 3, '3:16—1:369,'],
				[754, 3, '3:601']
			)
		);
		expect(result.review).toHaveLength(0);
		expect(result.rows).toHaveLength(2);
		expect(result.rows.map((r) => `${r.volume}:${r.page_start}`)).toEqual(['1:369', '3:601']);
	});

	it('handles glued heading+entry (Joel 2:11—…)', () => {
		const result = parseTurretinLines(lines([750, 1, 'Joel 2:11—1:200']));
		expect(result.review).toHaveLength(0);
		expect(result.linesOut).toContain('# book Joel');
		expect(result.rows[0]?.bible_book).toBe('Joel');
		expect(result.rows[0]?.chapter_start).toBe(2);
		expect(result.rows[0]?.verse_start).toBe(11);
	});

	it('ignores glued page INDEX and Index of Scripture headers', () => {
		expect(isRunningHeader('754 INDEX')).toBe(true);
		expect(isRunningHeader('Index of Scripture')).toBe(true);
		const result = parseTurretinLines(
			lines(
				[754, 1, '754 INDEX'],
				[739, 1, 'Index of Scripture'],
				[739, 1, 'Genesis'],
				[739, 1, '1:1—1:10']
			)
		);
		expect(result.review).toHaveLength(0);
		expect(result.rows).toHaveLength(1);
	});

	it('parses FineReader-glued two-entry lines', () => {
		const rows = parseIndexEntry(
			'22:18, 19—1:76, 22:21—1:631',
			'Jeremiah'
		);
		expect(rows).toHaveLength(2);
		expect(rows.map((r) => r.chapter_start)).toEqual([22, 22]);
	});

	it('applies corrected: in place by page:col:raw', () => {
		const corrections: ReviewBlock[] = [
			{
				printedPage: 760,
				column: 1,
				reason: 'suspicious_verse_token',
				book: 'John',
				raw: '8:141—3:100',
				corrected: '8:1-11—1:115'
			}
		];
		const result = parseTurretinLines(
			lines([760, 1, 'John'], [760, 1, '8:141—3:100']),
			{ corrections }
		);
		expect(result.review).toHaveLength(0);
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]?.verse_start).toBe(1);
		expect(result.rows[0]?.verse_end).toBe(11);
		expect(result.linesOut).toContain('8:1-11—1:115');
	});

	it('honors skip: without emitting review or rows', () => {
		const corrections: ReviewBlock[] = [
			{
				printedPage: 754,
				column: 1,
				reason: 'unrecognized line',
				raw: 'book of—3:49',
				skip: 'whole-book pointer noise'
			}
		];
		const result = parseTurretinLines(
			lines([754, 1, '1 Maccabees'], [754, 1, 'book of—3:49']),
			{ corrections }
		);
		expect(result.review).toHaveLength(0);
		expect(result.skipped).toHaveLength(1);
		expect(result.rows).toHaveLength(0);
	});
});
