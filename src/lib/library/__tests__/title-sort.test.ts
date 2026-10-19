import { describe, expect, it } from 'vitest';
import { stripLeadingArticleDisplay, titleSortKey } from '../title-sort';

describe('titleSortKey', () => {
	it('ignores English and German articles for ordering', () => {
		const titles = [
			'The Odyssey',
			'A Greek Grammar',
			'An Introduction to the New Testament',
			'Der Römerbrief',
			'Die Kirche',
			'Das Kapital',
			'BDAG',
			'Odyssey without article'
		];
		const sorted = titles.slice().sort((a, b) => titleSortKey(a).localeCompare(titleSortKey(b)));
		expect(sorted.map((t) => titleSortKey(t))).toEqual([
			'bdag',
			'greek grammar',
			'introduction to the new testament',
			'kapital',
			'kirche',
			'odyssey',
			'odyssey without article',
			'römerbrief'
		]);
		expect(sorted[0]).toBe('BDAG');
		expect(sorted.findIndex((t) => t === 'The Odyssey')).toBeLessThan(
			sorted.findIndex((t) => t === 'Der Römerbrief')
		);
	});

	it('keeps the displayed title unchanged at call sites (key only)', () => {
		expect(titleSortKey('The Odyssey')).toBe('odyssey');
		expect(titleSortKey('Der Römerbrief')).toBe('römerbrief');
	});
});

describe('stripLeadingArticleDisplay', () => {
	it('strips English when language is english', () => {
		expect(stripLeadingArticleDisplay('The Odyssey', 'english')).toBe('Odyssey');
	});

	it('strips German when language is german', () => {
		expect(stripLeadingArticleDisplay('Der Römerbrief', 'german')).toBe('Römerbrief');
	});
});
