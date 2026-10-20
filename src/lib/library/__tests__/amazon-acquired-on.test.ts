import { describe, expect, it } from 'vitest';
import {
	bookIsDigitalEdition,
	formatAmazonAcquiredReport,
	formatAmazonAcquiredTsv,
	isbnApplyRows,
	matchAmazonAcquiredOn,
	normalizeAmazonTitleKey,
	orderIsKindle,
	parseAmazonOrderDate,
	parseAmazonOrdersCsv,
	type AmazonOrderRow,
	type LibraryAcquiredBook
} from '$lib/library/amazon-acquired-on';

const ISBN10 = '0310205719';
const ISBN13 = '9780310205715';

function book(
	partial: Partial<LibraryAcquiredBook> & Pick<LibraryAcquiredBook, 'id'>
): LibraryAcquiredBook {
	return {
		title: 'The Cost of Discipleship',
		subtitle: null,
		edition: null,
		isbn: ISBN13,
		owned: true,
		acquiredOn: '2026-10-19',
		...partial
	};
}

function order(
	partial: Partial<AmazonOrderRow> & Pick<AmazonOrderRow, 'orderId' | 'orderDate'>
): AmazonOrderRow {
	return {
		line: 2,
		title: 'The Cost of Discipleship',
		asin: ISBN10,
		isbn: ISBN10,
		category: 'Books',
		format: null,
		cancelled: false,
		...partial
	};
}

describe('parseAmazonOrderDate', () => {
	it('accepts ISO, US four-digit, US two-digit, and month names', () => {
		expect(parseAmazonOrderDate('2019-04-15')).toBe('2019-04-15');
		expect(parseAmazonOrderDate('2019-04-15T08:00:00')).toBe('2019-04-15');
		expect(parseAmazonOrderDate('4/15/2019')).toBe('2019-04-15');
		expect(parseAmazonOrderDate('4/15/19')).toBe('2019-04-15');
		expect(parseAmazonOrderDate('4/15/95')).toBe('1995-04-15');
		expect(parseAmazonOrderDate('April 15, 2019')).toBe('2019-04-15');
		expect(parseAmazonOrderDate('02/31/2020')).toBeNull();
	});
});

describe('normalizeAmazonTitleKey / kindle signals', () => {
	it('strips articles, parentheticals, and a Kindle edition tag', () => {
		expect(normalizeAmazonTitleKey('The Cost of Discipleship (Hardcover)')).toBe(
			'cost of discipleship'
		);
		expect(normalizeAmazonTitleKey('The Cost of Discipleship (Kindle Edition)')).toBe(
			'cost of discipleship'
		);
		expect(normalizeAmazonTitleKey('Institutes of Elenctic Theology, Volume 2')).toBe(
			'institutes of elenctic theology volume 2'
		);
	});

	it('treats Kindle Books, a Kindle title, and Audible as digital rows', () => {
		expect(orderIsKindle({ title: 'Foo', category: 'Kindle Books', format: null })).toBe(true);
		expect(orderIsKindle({ title: 'Foo (Kindle Edition)', category: 'Books', format: null })).toBe(
			true
		);
		expect(orderIsKindle({ title: 'Foo', category: 'Audible Audiobooks', format: null })).toBe(
			true
		);
		expect(orderIsKindle({ title: 'Foo', category: 'Books', format: null })).toBe(false);
		expect(bookIsDigitalEdition({ title: 'Foo', subtitle: null, edition: 'Kindle Edition' })).toBe(
			true
		);
		expect(bookIsDigitalEdition({ title: 'Foo', subtitle: null, edition: null })).toBe(false);
	});
});

describe('parseAmazonOrdersCsv', () => {
	it('reads the Items headers, quoted titles, and hyphenated ISBNs', () => {
		const csv = [
			'Order Date,Order ID,Title,Category,ASIN/ISBN,Order Status,Quantity',
			'4/15/19,111-1,"Bonhoeffer, Dietrich: A Life",Books,978-0-310-20571-5,Shipped,1',
			'1/2/2020,111-2,Cable,Electronics,B000000000,Cancelled,1',
			'3/3/2020,111-3,Returned copy,Books,0310205719,Shipped,0'
		].join('\n');
		const parsed = parseAmazonOrdersCsv(csv);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.orders).toHaveLength(3);
		expect(parsed.orders[0]).toMatchObject({
			orderDate: '2019-04-15',
			orderId: '111-1',
			title: 'Bonhoeffer, Dietrich: A Life',
			isbn: ISBN13,
			cancelled: false
		});
		expect(parsed.orders[1]?.cancelled).toBe(true);
		expect(parsed.orders[2]?.cancelled).toBe(true);
	});

	it('rejects a file without the ASIN column', () => {
		const parsed = parseAmazonOrdersCsv('Order Date,Order ID,Title\n1/1/2020,1,Foo\n');
		expect(parsed.ok).toBe(false);
	});
});

describe('matchAmazonAcquiredOn', () => {
	it('ISBN-10 matches an ISBN-13 book and keeps the earliest order', () => {
		const match = matchAmazonAcquiredOn({
			orders: [
				order({ orderId: '111-9', orderDate: '2020-01-02', asin: ISBN13, isbn: ISBN13 }),
				order({ orderId: '111-2', orderDate: '2019-04-15' }),
				order({ orderId: '111-8', orderDate: '2019-04-15' })
			],
			books: [book({ id: 'book-1' })]
		});
		expect(match.isbnMatches).toEqual([
			expect.objectContaining({
				bookId: 'book-1',
				title: 'The Cost of Discipleship',
				acquiredOn: '2026-10-19',
				proposedOn: '2019-04-15',
				orderId: '111-2',
				via: 'isbn',
				earlier: true
			})
		]);
		expect(isbnApplyRows(match).map((row) => row.orderId)).toEqual(['111-2']);
		expect(match.titleSuggestions).toEqual([]);
	});

	it('does not let an earlier Kindle row date a print book', () => {
		const match = matchAmazonAcquiredOn({
			orders: [
				order({
					orderId: 'k-1',
					orderDate: '2018-05-01',
					title: 'The Cost of Discipleship (Kindle Edition)',
					asin: 'B00KINDLE1',
					isbn: null,
					category: 'Kindle Books'
				}),
				order({ orderId: 'p-1', orderDate: '2019-04-15' })
			],
			books: [book({ id: 'book-1' })]
		});
		expect(match.isbnMatches[0]?.proposedOn).toBe('2019-04-15');
		expect(match.skippedKindle).toHaveLength(1);
		expect(match.titleSuggestions).toEqual([]);
	});

	it('matches a Kindle row only when the library edition is digital', () => {
		const kindleOrder = order({
			orderId: 'k-1',
			orderDate: '2018-05-01',
			title: 'The Cost of Discipleship (Kindle Edition)',
			asin: ISBN10,
			isbn: ISBN10,
			category: 'Kindle Books'
		});
		const printOnly = matchAmazonAcquiredOn({
			orders: [kindleOrder],
			books: [book({ id: 'print' })]
		});
		expect(printOnly.isbnMatches).toEqual([]);
		expect(printOnly.skippedKindle).toHaveLength(1);

		const digital = matchAmazonAcquiredOn({
			orders: [kindleOrder],
			books: [book({ id: 'kindle', edition: 'Kindle Edition' })]
		});
		expect(digital.isbnMatches.map((row) => row.bookId)).toEqual(['kindle']);
		expect(digital.skippedKindle).toEqual([]);
	});

	it('suggests a unique title and never puts it on the apply list', () => {
		const match = matchAmazonAcquiredOn({
			orders: [
				order({
					orderId: 't-1',
					orderDate: '2017-06-01',
					title: 'The Cost of Discipleship (Hardcover)',
					asin: 'B06PRINT01',
					isbn: null,
					category: 'ABIS_BOOK'
				})
			],
			books: [book({ id: 'book-1', isbn: null, acquiredOn: '2026-01-01' })]
		});
		expect(match.titleSuggestions).toEqual([
			expect.objectContaining({
				bookId: 'book-1',
				proposedOn: '2017-06-01',
				orderId: 't-1',
				via: 'title'
			})
		]);
		expect(isbnApplyRows(match)).toEqual([]);
		expect(match.isbnMatches).toEqual([]);
	});

	it('keeps an earlier title-only order visible beside a later ISBN match', () => {
		const match = matchAmazonAcquiredOn({
			orders: [
				order({
					orderId: 't-early',
					orderDate: '2016-01-01',
					asin: 'B06PRINT01',
					isbn: null
				}),
				order({ orderId: 'isbn-late', orderDate: '2020-01-01' })
			],
			books: [book({ id: 'book-1' })]
		});
		expect(match.isbnMatches[0]?.orderId).toBe('isbn-late');
		expect(match.titleSuggestions[0]?.orderId).toBe('t-early');
		expect(isbnApplyRows(match).map((row) => row.orderId)).toEqual(['isbn-late']);
	});

	it('drops a title hit that is not earlier than the ISBN match', () => {
		const match = matchAmazonAcquiredOn({
			orders: [
				order({ orderId: 'isbn-early', orderDate: '2016-01-01' }),
				order({
					orderId: 't-late',
					orderDate: '2020-01-01',
					asin: 'B06PRINT01',
					isbn: null
				})
			],
			books: [book({ id: 'book-1' })]
		});
		expect(match.titleSuggestions).toEqual([]);
	});

	it('does not title-match an ISBN that missed', () => {
		const match = matchAmazonAcquiredOn({
			orders: [
				order({
					orderId: 'other-edition',
					orderDate: '2015-01-01',
					asin: '0802827880',
					isbn: '0802827880'
				})
			],
			books: [book({ id: 'book-1' })]
		});
		expect(match.misses.map((row) => row.orderId)).toEqual(['other-edition']);
		expect(match.titleSuggestions).toEqual([]);
		expect(match.isbnMatches).toEqual([]);
	});

	it('leaves acquired_on alone when nothing matches, including unowned stubs', () => {
		const match = matchAmazonAcquiredOn({
			orders: [order({ orderId: '1', orderDate: '2019-01-01' })],
			books: [book({ id: 'stub', owned: false })]
		});
		expect(match.isbnMatches).toEqual([]);
		expect(match.misses).toHaveLength(1);
		expect(isbnApplyRows(match)).toEqual([]);
	});

	it('reports a shared ISBN instead of writing both rows', () => {
		const match = matchAmazonAcquiredOn({
			orders: [order({ orderId: '1', orderDate: '2019-01-01' })],
			books: [book({ id: 'a' }), book({ id: 'b', title: 'Lost Tales' })]
		});
		expect(match.isbnMatches).toEqual([]);
		expect(match.isbnAmbiguous).toEqual([expect.objectContaining({ bookIds: ['a', 'b'] })]);
	});

	it('reports a repeated title instead of suggesting one', () => {
		const match = matchAmazonAcquiredOn({
			orders: [
				order({
					orderId: '1',
					orderDate: '2019-01-01',
					title: 'Romans',
					asin: 'B0ROMANS01',
					isbn: null
				})
			],
			books: [
				book({ id: 'a', title: 'Romans', isbn: null }),
				book({ id: 'b', title: 'Romans', isbn: null, subtitle: 'A Commentary' })
			]
		});
		expect(match.titleSuggestions).toEqual([]);
		expect(match.titleAmbiguous[0]?.bookIds.sort()).toEqual(['a', 'b']);
	});

	it('matches title plus subtitle and skips a different volume', () => {
		const books = [
			book({
				id: 'with-sub',
				title: 'The Cost of Discipleship',
				subtitle: 'A Classic',
				isbn: null
			}),
			book({ id: 'vol', title: 'Institutes of Elenctic Theology', isbn: null })
		];
		const titled = matchAmazonAcquiredOn({
			orders: [
				order({
					orderId: 'sub',
					orderDate: '2018-02-02',
					title: 'The Cost of Discipleship: A Classic',
					asin: '',
					isbn: null
				})
			],
			books
		});
		expect(titled.titleSuggestions.map((row) => row.bookId)).toEqual(['with-sub']);

		const volume = matchAmazonAcquiredOn({
			orders: [
				order({
					orderId: 'vol',
					orderDate: '2018-02-02',
					title: 'Institutes of Elenctic Theology, Volume 2',
					asin: '',
					isbn: null
				})
			],
			books
		});
		expect(volume.titleSuggestions).toEqual([]);
		expect(volume.misses).toHaveLength(1);
	});

	it('skips cancelled rows, quantity zero, and non-book categories', () => {
		const match = matchAmazonAcquiredOn({
			orders: [
				order({ orderId: 'c', orderDate: '2019-01-01', cancelled: true }),
				order({
					orderId: 'q',
					orderDate: '2019-01-01',
					cancelled: true
				}),
				order({
					orderId: 'kitchen',
					orderDate: '2019-01-01',
					title: 'The Cost of Discipleship',
					asin: '',
					isbn: null,
					category: 'Kitchen'
				})
			],
			books: [book({ id: 'book-1', isbn: null })]
		});
		expect(match.skippedCancelled).toBe(2);
		expect(match.skippedNonBook).toBe(1);
		expect(match.titleSuggestions).toEqual([]);
		expect(match.isbnMatches).toEqual([]);
	});

	it('title-matches when the file has no category column', () => {
		const match = matchAmazonAcquiredOn({
			orders: [
				order({
					orderId: 'bare',
					orderDate: '2014-03-03',
					asin: '',
					isbn: null,
					category: null
				})
			],
			books: [book({ id: 'book-1', isbn: null })]
		});
		expect(match.titleSuggestions.map((row) => row.bookId)).toEqual(['book-1']);
	});

	it('does not write when the order date equals acquired_on, and does write a later date', () => {
		const same = matchAmazonAcquiredOn({
			orders: [order({ orderId: 'same', orderDate: '2026-10-19' })],
			books: [book({ id: 'book-1', acquiredOn: '2026-10-19' })]
		});
		expect(same.isbnMatches).toHaveLength(1);
		expect(isbnApplyRows(same)).toEqual([]);

		const later = matchAmazonAcquiredOn({
			orders: [order({ orderId: 'later', orderDate: '2026-10-20' })],
			books: [book({ id: 'book-1', acquiredOn: '2026-01-01' })]
		});
		expect(later.isbnMatches[0]?.earlier).toBe(false);
		expect(isbnApplyRows(later).map((row) => row.orderId)).toEqual(['later']);
	});

	it('preview lists book id, title, current date, proposed date, and order id', () => {
		const parsed = parseAmazonOrdersCsv(
			[
				'Order Date,Order ID,Title,Category,ASIN/ISBN',
				'4/15/19,111-0001,The Cost of Discipleship,Books,0310205719',
				'5/1/18,111-0002,The Cost of Discipleship,Kindle Books,B00KINDLE1',
				'6/1/17,111-0003,Unknown Commentary,Books,0802827880',
				'7/1/16,111-0004,Romans,Books,B0ROMANS01'
			].join('\n')
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		const match = matchAmazonAcquiredOn({
			orders: parsed.orders,
			books: [book({ id: 'book-1' })],
			unparsed: parsed.unparsed
		});
		const report = formatAmazonAcquiredReport(match);
		expect(report).toContain('ISBN match: 1');
		expect(report).toContain('Title suggestion: 0');
		expect(report).toContain('Miss: 2');
		expect(report).toContain('Skipped Kindle: 1');
		expect(report).toContain(
			'book-1\tThe Cost of Discipleship\t2026-10-19\t2019-04-15\t111-0001\tearlier'
		);
		const tsv = formatAmazonAcquiredTsv(match);
		expect(tsv.split('\n')[0]).toBe(
			'kind\tbook_id\ttitle\tacquired_on\tproposed_on\torder_id\torder_title\tdirection'
		);
		expect(tsv).toContain(
			'isbn\tbook-1\tThe Cost of Discipleship\t2026-10-19\t2019-04-15\t111-0001'
		);
	});
});
