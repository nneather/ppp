import { describe, expect, it } from 'vitest';
import {
	combineGoodreadsNotes,
	goodreadsAuthorLastKey,
	matchGoodreadsRatings,
	normalizeGoodreadsTitleKey,
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

describe('normalizeGoodreadsTitleKey / goodreadsAuthorLastKey', () => {
	it('strips series parens and articles', () => {
		expect(normalizeGoodreadsTitleKey('Harry Potter and the Deathly Hallows (Harry Potter, #7)')).toBe(
			'harry potter and the deathly hallows'
		);
		expect(normalizeGoodreadsTitleKey('The Advantage: Why Organizational Health')).toContain(
			'advantage'
		);
	});

	it('prefers Author l-f last name', () => {
		expect(goodreadsAuthorLastKey('J.K. Rowling', 'Rowling, J.K.')).toBe('rowling');
		expect(goodreadsAuthorLastKey('Michael Scott Horton', 'Horton, Michael Scott')).toBe('horton');
	});
});

describe('parseGoodreadsExportCsv', () => {
	it('parses a minimal Goodreads export', () => {
		const csv = [
			'Book Id,Title,Author,Author l-f,ISBN,ISBN13,My Rating,My Review,Private Notes,Exclusive Shelf',
			'1,"Mere Christianity","C. S. Lewis","Lewis, C. S.",="0310205719",="9780310205715",5,"Great.","",read',
			'2,"Unread Book","Someone","Someone, A",="",="",0,"","",to-read'
		].join('\n');
		const parsed = parseGoodreadsExportCsv(csv);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.rows).toHaveLength(2);
		expect(parsed.rows[0]?.myRating).toBe(5);
		expect(parsed.rows[0]?.isbn).toBe('9780310205715');
		expect(parsed.rows[0]?.authorLf).toBe('Lewis, C. S.');
		expect(parsed.rows[1]?.myRating).toBeNull();
	});
});

describe('matchGoodreadsRatings', () => {
	const books: GoodreadsBookCandidate[] = [
		{
			id: 'b1',
			title: 'Mere Christianity',
			subtitle: null,
			isbn: '9780310205715',
			author_display: 'C. S. Lewis',
			rating: null,
			personal_notes: null
		},
		{
			id: 'b2',
			title: 'Already rated',
			subtitle: null,
			isbn: '9780000000002',
			author_display: 'Someone',
			rating: 3,
			personal_notes: 'keep me'
		},
		{
			id: 'b3',
			title: 'Project Hail Mary',
			subtitle: null,
			isbn: '9780593135204',
			author_display: 'Andy Weir',
			rating: null,
			personal_notes: null
		},
		{
			id: 'b4',
			title: 'The Advantage',
			subtitle: null,
			isbn: null,
			author_display: 'Patrick Lencioni',
			rating: null,
			personal_notes: null
		}
	];

	function row(
		partial: Partial<GoodreadsExportRow> & Pick<GoodreadsExportRow, 'myRating'>
	): GoodreadsExportRow {
		return {
			line: 2,
			title: 't',
			author: 'a',
			authorLf: '',
			isbn: null,
			myReview: null,
			privateNotes: null,
			exclusiveShelf: 'read',
			...partial
		};
	}

	it('matches ISBN-10 export to ISBN-13 library row', () => {
		const summary = matchGoodreadsRatings({
			grRows: [
				row({
					title: 'Mere Christianity',
					author: 'C. S. Lewis',
					authorLf: 'Lewis, C. S.',
					isbn: '0310205719',
					myRating: 5,
					myReview: 'Great.'
				})
			],
			books,
			fillEmptyNotes: true
		});
		expect(summary.apply).toHaveLength(1);
		expect(summary.apply[0]?.bookId).toBe('b1');
		expect(summary.apply[0]?.matchedVia).toBe('isbn');
		expect(summary.apply[0]?.rating).toBe(5);
		expect(summary.apply[0]?.notesToSet).toBe('Great.');
		expect(summary.matchedViaIsbn).toBe(1);
	});

	it('falls back to unique title + author when ISBN differs', () => {
		const summary = matchGoodreadsRatings({
			grRows: [
				row({
					title: 'Project Hail Mary',
					author: 'Andy Weir',
					authorLf: 'Weir, Andy',
					isbn: '9780593395561',
					myRating: 5
				})
			],
			books
		});
		expect(summary.apply).toHaveLength(1);
		expect(summary.apply[0]?.bookId).toBe('b3');
		expect(summary.apply[0]?.matchedVia).toBe('title_author');
		expect(summary.matchedViaTitleAuthor).toBe(1);
	});

	it('matches missing ISBN via title + author (subtitle stripped)', () => {
		const summary = matchGoodreadsRatings({
			grRows: [
				row({
					title: 'The Advantage: Why Organizational Health Trumps Everything Else In Business (J-B Lencioni Series)',
					author: 'Patrick Lencioni',
					authorLf: 'Lencioni, Patrick',
					isbn: null,
					myRating: 4
				})
			],
			books
		});
		expect(summary.apply).toHaveLength(1);
		expect(summary.apply[0]?.bookId).toBe('b4');
		expect(summary.apply[0]?.matchedVia).toBe('title_author');
	});

	it('skips existing ratings unless overwrite', () => {
		const gr = row({
			title: 'Already rated',
			author: 'Someone',
			authorLf: 'Someone, A',
			isbn: '9780000000002',
			myRating: 4
		});
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
				row({ isbn: null, myRating: 4, title: 'No isbn', author: 'Nobody' }),
				row({ isbn: '9789999999999', myRating: 2, title: 'Missing', author: 'Ghost' }),
				row({ isbn: null, myRating: null, title: 'Unread' })
			],
			books
		});
		expect(summary.unmatched).toHaveLength(2);
		expect(summary.unrated).toBe(1);
	});

	it('does not title-only match when author last names differ', () => {
		const summary = matchGoodreadsRatings({
			grRows: [
				row({
					title: 'Mere Christianity',
					author: 'Someone Else',
					authorLf: 'Else, Someone',
					isbn: null,
					myRating: 5
				})
			],
			books
		});
		expect(summary.unmatched).toHaveLength(1);
		expect(summary.apply).toHaveLength(0);
	});
});

describe('combineGoodreadsNotes', () => {
	it('joins review and private notes', () => {
		expect(combineGoodreadsNotes('A', 'B')).toBe('A\n\nB');
		expect(combineGoodreadsNotes(null, null)).toBeNull();
	});
});
