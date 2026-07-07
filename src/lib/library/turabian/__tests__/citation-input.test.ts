import { describe, expect, it } from 'vitest';
import { formatBibliography, formatFootnote } from '../format';
import { bookDetailToCitationInput, citationAuthorsForBook } from '../types';
import { reviewCardToCitationInput } from '../review-card';
import type { BookDetail, ReviewCard } from '$lib/types/library';

const strayAuthor = {
	person_id: 'p1',
	person_label: 'D. A. Carson',
	role: 'editor' as const,
	sort_order: 0
};

const baseBook: Pick<
	BookDetail,
	| 'id'
	| 'title'
	| 'subtitle'
	| 'publisher'
	| 'publisher_canonical'
	| 'publisher_location'
	| 'publisher_effective_location'
	| 'year'
	| 'edition'
	| 'total_volumes'
	| 'original_year'
	| 'reprint_publisher'
	| 'reprint_location'
	| 'reprint_year'
	| 'series_name'
	| 'series_abbreviation'
	| 'volume_number'
	| 'genre'
	| 'work_type'
	| 'language'
	| 'authors'
	| 'no_attributed_author'
> = {
	id: '00000000-0000-0000-0000-000000000001',
	title: 'Dictionary of Paul and His Letters',
	subtitle: null,
	publisher: 'IVP',
	publisher_canonical: 'IVP',
	publisher_location: 'Downers Grove, IL',
	publisher_effective_location: 'Downers Grove, IL',
	year: 1993,
	edition: null,
	total_volumes: null,
	original_year: null,
	reprint_publisher: null,
	reprint_location: null,
	reprint_year: null,
	series_name: null,
	series_abbreviation: null,
	volume_number: null,
	genre: 'Biblical Reference',
	work_type: 'reference_work',
	language: 'english',
	authors: [strayAuthor],
	no_attributed_author: true
};

describe('citationAuthorsForBook', () => {
	it('drops junction authors when no_attributed_author is set', () => {
		expect(citationAuthorsForBook({ no_attributed_author: true, authors: [strayAuthor] })).toEqual(
			[]
		);
		expect(citationAuthorsForBook({ no_attributed_author: false, authors: [strayAuthor] })).toEqual(
			[strayAuthor]
		);
	});
});

describe('citation input converters', () => {
	it('bookDetailToCitationInput omits authors for authorless reference works', () => {
		const input = bookDetailToCitationInput(baseBook as BookDetail);
		expect(input.authors).toEqual([]);
		const fn = formatFootnote(input, { page: '42' });
		expect(fn.plain).toMatch(/^Dictionary of Paul and His Letters/);
		expect(fn.plain).not.toContain('Carson');
	});

	it('reviewCardToCitationInput omits authors for authorless reference works', () => {
		const card = {
			...baseBook,
			publisher_id: null,
			reading_status: 'unread',
			needs_review: true,
			needs_review_note: null,
			import_match_type: null,
			topics_count: 0,
			scripture_refs_count: 0,
			proposal: null,
			authors_label: null,
			series_abbreviation: null,
			series_name: null
		} as ReviewCard;
		const input = reviewCardToCitationInput(card);
		expect(input.authors).toEqual([]);
		const bib = formatBibliography(input);
		expect(bib.plain).toMatch(/^Dictionary of Paul and His Letters\./);
		expect(bib.plain).not.toContain('Carson');
	});
});
