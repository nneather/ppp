import { describe, expect, it } from 'vitest';
import { formatBibliography, formatFootnote } from '../format';
import { resolveCitationSourceType } from '../dispatch';
import type { BookCitationInput } from '../types';

function book(overrides: Partial<BookCitationInput>): BookCitationInput {
	return {
		id: '00000000-0000-0000-0000-000000000001',
		title: 'Title',
		subtitle: null,
		publisher: 'Publisher',
		publisher_location: 'Grand Rapids, MI',
		year: 1994,
		edition: null,
		total_volumes: null,
		original_year: null,
		reprint_publisher: null,
		reprint_location: null,
		reprint_year: null,
		series_name: null,
		series_abbreviation: null,
		volume_number: null,
		genre: 'Theology',
		language: 'english',
		authors: [
			{
				person_id: 'p1',
				person_label: 'V. Philips Long',
				role: 'author',
				sort_order: 0
			}
		],
		...overrides
	};
}

describe('resolveCitationSourceType', () => {
	it('dispatches bible genre', () => {
		expect(resolveCitationSourceType(book({ genre: 'Bibles' }))).toBe('bible');
	});

	it('dispatches commentary in series', () => {
		expect(
			resolveCitationSourceType(
				book({
					genre: 'Commentary',
					series_name: 'Word Biblical Commentary',
					series_abbreviation: 'WBC'
				})
			)
		).toBe('commentary-in-series');
	});

	it('dispatches edited volume when only editors', () => {
		expect(
			resolveCitationSourceType(
				book({
					authors: [
						{
							person_id: 'e1',
							person_label: 'William S. Barker',
							role: 'editor',
							sort_order: 0
						}
					]
				})
			)
		).toBe('edited-volume');
	});

	it('dispatches translator book', () => {
		expect(
			resolveCitationSourceType(
				book({
					authors: [
						{
							person_id: 'a1',
							person_label: 'Gerhard Maier',
							role: 'author',
							sort_order: 0
						},
						{
							person_id: 't1',
							person_label: 'Robert W. Yarbrough',
							role: 'translator',
							sort_order: 1
						}
					]
				})
			)
		).toBe('book-with-translator');
	});
});

describe('formatFootnote', () => {
	it('formats single-author book (formats.md §1)', () => {
		const b = book({
			title: 'The Art of Biblical History',
			authors: [
				{
					person_id: 'p1',
					person_label: 'V. Philips Long',
					role: 'author',
					sort_order: 0
				}
			],
			publisher_location: 'Grand Rapids, MI',
			publisher: 'Zondervan',
			year: 1994
		});
		const fn = formatFootnote(b, { page: '123' });
		expect(fn.plain).toContain('V. Philips Long');
		expect(fn.plain).toContain('The Art of Biblical History');
		expect(fn.plain).toContain('Grand Rapids, MI: Zondervan, 1994');
		expect(fn.plain).toContain('123');
		expect(fn.html).toContain('<i>The Art of Biblical History</i>');
	});

	it('formats reprint (formats.md §13)', () => {
		const b = book({
			title: 'Sermons for Christian Families',
			authors: [
				{
					person_id: 'p1',
					person_label: 'Edward Payson',
					role: 'author',
					sort_order: 0
				}
			],
			original_year: 1832,
			reprint_location: 'Birmingham, AL',
			reprint_publisher: 'Solid Ground Christian Books',
			reprint_year: 2009,
			year: 2009
		});
		const fn = formatFootnote(b, { page: '55' });
		expect(fn.plain).toContain('1832');
		expect(fn.plain).toContain('repr.');
		expect(fn.plain).toContain('2009');
	});

	it('formats bible footnote only', () => {
		const fn = formatFootnote(book({ genre: 'Bibles' }), { page: 'Gen. 1:1' });
		expect(fn.plain).toContain('Gen. 1:1');
		expect(formatBibliography(book({ genre: 'Bibles' })).plain).toBe('');
	});
});

describe('formatBibliography', () => {
	it('formats single-author bibliography entry', () => {
		const b = book({
			title: 'The Art of Biblical History',
			authors: [
				{
					person_id: 'p1',
					person_label: 'V. Philips Long',
					role: 'author',
					sort_order: 0
				}
			]
		});
		const bib = formatBibliography(b);
		expect(bib.plain).toMatch(/^Long, V\. Philips\./);
		expect(bib.plain).toContain('The Art of Biblical History');
	});

	it('includes translator in bibliography', () => {
		const b = book({
			title: 'Biblical Hermeneutics',
			authors: [
				{
					person_id: 'a1',
					person_label: 'Gerhard Maier',
					role: 'author',
					sort_order: 0
				},
				{
					person_id: 't1',
					person_label: 'Robert W. Yarbrough',
					role: 'translator',
					sort_order: 1
				}
			]
		});
		const bib = formatBibliography(b);
		expect(bib.plain).toContain('Translated by Robert W. Yarbrough');
	});
});
