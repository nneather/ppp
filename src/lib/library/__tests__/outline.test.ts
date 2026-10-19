import { describe, expect, it } from 'vitest';
import {
	formatSystematicPointerDisplay,
	groupSystematicHits,
	pageNumberFromText,
	parseOutlineTsv,
	parseOutlineTsvLine,
	resolveOutlineLabel,
	type OutlineSectionInput
} from '../outline';

describe('pageNumberFromText', () => {
	it('parses plain pages and ranges', () => {
		expect(pageNumberFromText('620')).toBe(620);
		expect(pageNumberFromText('620–23')).toBe(620);
		expect(pageNumberFromText('106n21')).toBe(106);
		expect(pageNumberFromText('pp. 249ff')).toBe(249);
	});

	it('returns null for empty / non-numeric', () => {
		expect(pageNumberFromText(null)).toBeNull();
		expect(pageNumberFromText('')).toBeNull();
		expect(pageNumberFromText('n/a')).toBeNull();
	});
});

describe('resolveOutlineLabel', () => {
	const sections: OutlineSectionInput[] = [
		{
			id: 'broad',
			book_id: 'b1',
			parent_id: null,
			sort_order: 1,
			locator: 'XV',
			label: 'Faith and Justification',
			page_start: 500,
			page_end: 700
		},
		{
			id: 'tight',
			book_id: 'b1',
			parent_id: 'broad',
			sort_order: 2,
			locator: 'XV.17',
			label: 'Full Assurance',
			page_start: 610,
			page_end: 630
		}
	];

	it('picks the deepest enclosing node', () => {
		const r = resolveOutlineLabel(sections, 620);
		expect(r?.id).toBe('tight');
		expect(r?.label).toBe('Full Assurance');
	});

	it('returns null when page is outside all ranges', () => {
		expect(resolveOutlineLabel(sections, 10)).toBeNull();
	});
});

describe('formatSystematicPointerDisplay', () => {
	it('formats volume:page with heading', () => {
		expect(
			formatSystematicPointerDisplay({
				volume: '2',
				pageStart: '620',
				pageEnd: null,
				locator: 'XV.17',
				label: 'Full Assurance'
			})
		).toBe('2:620 (XV.17 Full Assurance)');
	});

	it('formats page-only when no volume', () => {
		expect(
			formatSystematicPointerDisplay({
				volume: null,
				pageStart: '136',
				pageEnd: '140',
				locator: null,
				label: 'Repentance'
			})
		).toBe('p. 136–140 (Repentance)');
	});
});

describe('groupSystematicHits', () => {
	it('groups by series and sorts by volume then page', () => {
		const blocks = groupSystematicHits([
			{
				refId: 'r2',
				bookId: 'tur-2',
				bookTitle: 'Institutes of Elenctic Theology',
				volumeNumber: 'II',
				seriesId: 'ser-tur',
				seriesName: 'Institutes of Elenctic Theology (Turretin)',
				authorLabel: 'Francis Turretin',
				pageStart: '620',
				pageEnd: null,
				outline: {
					id: 'o1',
					locator: 'XV.17',
					label: 'Full Assurance',
					page_start: 610,
					page_end: 630
				}
			},
			{
				refId: 'r1',
				bookId: 'tur-2',
				bookTitle: 'Institutes of Elenctic Theology',
				volumeNumber: 'II',
				seriesId: 'ser-tur',
				seriesName: 'Institutes of Elenctic Theology (Turretin)',
				authorLabel: 'Francis Turretin',
				pageStart: '100',
				pageEnd: null,
				outline: null
			}
		]);

		expect(blocks).toHaveLength(1);
		expect(blocks[0]!.seriesName).toContain('Turretin');
		expect(blocks[0]!.pointers[0]!.pageStart).toBe('100');
		expect(blocks[0]!.pointers[1]!.display).toBe('II:620 (XV.17 Full Assurance)');
	});
});

describe('parseOutlineTsv', () => {
	it('parses locator\\tlabel\\tpages', () => {
		expect(parseOutlineTsvLine('XV.17\tFull Assurance\t610-630')).toEqual({
			locator: 'XV.17',
			label: 'Full Assurance',
			pageStart: 610,
			pageEnd: 630
		});
	});

	it('parses label\\tpages when no locator', () => {
		expect(parseOutlineTsvLine('Repentance\t136')).toEqual({
			locator: null,
			label: 'Repentance',
			pageStart: 136,
			pageEnd: 136
		});
	});

	it('counts skipped bad lines', () => {
		const { rows, skipped } = parseOutlineTsv(
			'XV.17\tFull Assurance\t610-630\nbad line\n\nRepentance\t136'
		);
		expect(rows).toHaveLength(2);
		expect(skipped).toBe(1);
	});
});
