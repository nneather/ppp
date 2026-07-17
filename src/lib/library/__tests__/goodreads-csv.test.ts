import { describe, expect, it } from 'vitest';
import {
	combineGoodreadsNotes,
	matchGoodreadsRatings,
	parseGoodreadsIsbnCell,
	type GoodreadsBookCandidate,
	type GoodreadsExportRow
} from '$lib/library/goodreads-csv';
import { isbn10ToIsbn13, isbnMatchKeys } from '$lib/library/isbn';
import { parseGoodreadsExportCsv } from '$lib/library/server/goodreads-import';

describe('parseGoodreadsIsbnCell', () => {
	it('strips Goodreads formula wrapping', () => {
		expect(parseGoodreadsIsbnCell('="9780310205715"')).toBe('9780310205715');
		expect(parseGoodreadsIsbnCell('=""')).toBeNull();
		expect(parseGoodreadsIsbnCell('0310205719')).toBe('0310205719');
	});
});

describe('isbn10ToIsbn13 / isbnMatchKeys', () => {
	it('converts ISBN-10 and includes twins in match keys', () => {
		const as13 = isbn10ToIsbn13('0310205719');
		expect(as13).toBe('9780310205715');
		expect(isbnMatchKeys('0310205719')).toEqual(expect.arrayContaining(['0310205719', as13!]));
		expect(isbnMatchKeys('9780310205715')).toEqual(
			expect.arrayContaining(['9780310205715', '0310205719'])
		);
	});
});

describe('parseGoodreadsExportCsv', () => {
	it('parses a minimal Goodreads export', () => {
		const csv = [
			'Book Id,Title,Author,ISBN,ISBN13,My Rating,My Review,Private Notes,Exclusive Shelf',
			'1,"Mere Christianity","C. S. Lewis",="0310205719",="9780310205715",5,"Great.","",read',
			'2,"Unread Book","Someone",="",="",0,"","",to-read'
		].join('\n');
		const parsed = parseGoodreadsExportCsv(csv);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.rows).toHaveLength(2);
		expect(parsed.rows[0]?.myRating).toBe(5);
		expect(parsed.rows[0]?.isbn).toBe('9780310205715');
		expect(parsed.rows[1]?.myRating).toBeNull();
	});
});

describe('matchGoodreadsRatings', () => {
	const books: GoodreadsBookCandidate[] = [
		{
			id: 'b1',
			title: 'Mere Christianity',
			isbn: '9780310205715',
			rating: null,
			personal_notes: null
		},
		{
			id: 'b2',
			title: 'Already rated',
			isbn: '9780000000002',
			rating: 3,
			personal_notes: 'keep me'
		}
	];

	function row(partial: Partial<GoodreadsExportRow> & Pick<GoodreadsExportRow, 'isbn' | 'myRating'>): GoodreadsExportRow {
		return {
			line: 2,
			title: 't',
			author: 'a',
			myReview: null,
			privateNotes: null,
			exclusiveShelf: 'read',
			...partial
		};
	}

	it('matches ISBN-10 export to ISBN-13 library row', () => {
		const summary = matchGoodreadsRatings({
			grRows: [row({ isbn: '0310205719', myRating: 5, myReview: 'Great.' })],
			books,
			fillEmptyNotes: true
		});
		expect(summary.apply).toHaveLength(1);
		expect(summary.apply[0]?.bookId).toBe('b1');
		expect(summary.apply[0]?.rating).toBe(5);
		expect(summary.apply[0]?.notesToSet).toBe('Great.');
	});

	it('skips existing ratings unless overwrite', () => {
		const gr = row({ isbn: '9780000000002', myRating: 4 });
		const skip = matchGoodreadsRatings({ grRows: [gr], books });
		expect(skip.skipExisting).toHaveLength(1);
		const over = matchGoodreadsRatings({
			grRows: [gr],
			books,
			overwriteExisting: true
		});
		expect(over.apply).toHaveLength(1);
		expect(over.apply[0]?.rating).toBe(4);
	});

	it('counts unrated and unmatched', () => {
		const summary = matchGoodreadsRatings({
			grRows: [
				row({ isbn: null, myRating: 4, title: 'No isbn' }),
				row({ isbn: '9789999999999', myRating: 2 }),
				row({ isbn: null, myRating: null })
			],
			books
		});
		expect(summary.unmatched).toHaveLength(2);
		expect(summary.unrated).toBe(1);
	});
});

describe('combineGoodreadsNotes', () => {
	it('joins review and private notes', () => {
		expect(combineGoodreadsNotes('A', 'B')).toBe('A\n\nB');
		expect(combineGoodreadsNotes(null, null)).toBeNull();
	});
});
