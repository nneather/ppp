/**
 * Match an Amazon "Download order reports" Items CSV to owned library books
 * and propose `books.acquired_on` from the earliest matching order date.
 *
 * ISBN-10/13 (via `isbnMatchKeys`) is the only path `--apply` may write.
 * Title hits are suggestions. Kindle / ebook / audiobook rows are skipped
 * unless the library row is clearly that edition. No match leaves the
 * current date alone. Unowned stubs are ignored.
 *
 * CSV text never leaves this module's caller — do not commit order reports.
 */

import { parseDelimitedRows } from '$lib/library/server/books-csv';
import { isbnMatchKeys, normalizeIsbnDigits } from '$lib/library/isbn';
import { stripArticlesForImporterMatchKey } from '$lib/library/title-sort';

export type AmazonOrderRow = {
	line: number;
	orderId: string;
	/** Civil date `YYYY-MM-DD`. */
	orderDate: string;
	title: string;
	asin: string;
	/** Normalized ISBN-10 or ISBN-13 when the ASIN cell is one. */
	isbn: string | null;
	/** Null when the CSV has no Category column. Blank cell is `''`. */
	category: string | null;
	/** Null when the CSV has no Format column (legacy Items reports). */
	format: string | null;
	cancelled: boolean;
};

export type LibraryAcquiredBook = {
	id: string;
	title: string | null;
	subtitle: string | null;
	edition: string | null;
	isbn: string | null;
	owned: boolean;
	/** Civil date `YYYY-MM-DD`, or null. */
	acquiredOn: string | null;
};

export type AcquiredProposal = {
	bookId: string;
	title: string;
	acquiredOn: string | null;
	proposedOn: string;
	orderId: string;
	orderTitle: string;
	via: 'isbn' | 'title';
	/** Proposed date is strictly before the current `acquired_on` (null current counts). */
	earlier: boolean;
};

export type AmazonIsbnAmbiguous = {
	orderId: string;
	orderTitle: string;
	orderDate: string;
	bookIds: string[];
};

export type AmazonTitleAmbiguous = {
	orderId: string;
	orderTitle: string;
	orderDate: string;
	bookIds: string[];
};

export type AmazonAcquiredMatch = {
	/** Every unique book an ISBN order resolved to, including same-date no-ops. */
	isbnMatches: AcquiredProposal[];
	/** Unique-title hits. Never written by `--apply`. */
	titleSuggestions: AcquiredProposal[];
	misses: AmazonOrderRow[];
	skippedKindle: AmazonOrderRow[];
	skippedCancelled: number;
	skippedNonBook: number;
	isbnAmbiguous: AmazonIsbnAmbiguous[];
	titleAmbiguous: AmazonTitleAmbiguous[];
	/** Rows the CSV parser dropped (bad date, blank title or order id). */
	unparsed: number;
};

const MONTHS: Readonly<Record<string, number>> = {
	jan: 1,
	feb: 2,
	mar: 3,
	apr: 4,
	may: 5,
	jun: 6,
	jul: 7,
	aug: 8,
	sep: 9,
	oct: 10,
	nov: 11,
	dec: 12
};

function normHeader(header: string): string {
	return header
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
}

function findHeader(headers: string[], names: readonly string[]): number {
	const norm = headers.map(normHeader);
	for (const name of names) {
		const i = norm.indexOf(name);
		if (i >= 0) return i;
	}
	return -1;
}

function cell(row: string[], idx: number): string {
	if (idx < 0 || idx >= row.length) return '';
	return (row[idx] ?? '').trim();
}

function civilDateOrNull(year: number, month: number, day: number): string | null {
	if (month < 1 || month > 12 || day < 1 || day > 31) return null;
	const dt = new Date(Date.UTC(year, month - 1, day));
	if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
		return null;
	}
	const y = String(year).padStart(4, '0');
	const m = String(month).padStart(2, '0');
	const d = String(day).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/**
 * Amazon Items dates are ISO (`2020-01-15`), US `M/D/YYYY`, or US `M/D/YY`
 * (two-digit years: 70–99 → 1970–1999, 00–69 → 2000–2069).
 */
export function parseAmazonOrderDate(raw: string): string | null {
	const t = raw.trim();
	const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(t);
	if (iso) return civilDateOrNull(Number(iso[1]), Number(iso[2]), Number(iso[3]));

	const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t);
	if (us) {
		let year = Number(us[3]);
		if (us[3].length === 2) year += year >= 70 ? 1900 : 2000;
		return civilDateOrNull(year, Number(us[1]), Number(us[2]));
	}

	const named = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(t);
	if (named) {
		const month = MONTHS[named[1]!.slice(0, 3).toLowerCase()];
		if (!month) return null;
		return civilDateOrNull(Number(named[3]), month, Number(named[2]));
	}
	return null;
}

function isCancelledStatus(status: string): boolean {
	return /\bcancell?ed\b/i.test(status);
}

function parseQuantity(raw: string): number | null {
	if (raw.trim().length === 0) return null;
	const n = Number(raw);
	return Number.isFinite(n) ? n : null;
}

/** Category or format marks a Kindle, ebook, or audiobook line. */
export function orderIsKindle(
	order: Pick<AmazonOrderRow, 'title' | 'category' | 'format'>
): boolean {
	if (/\bkindle edition\b/i.test(order.title)) return true;
	const blob = `${order.category ?? ''} ${order.format ?? ''}`;
	if (/kindle|e-?book|audiobook|audible/i.test(blob)) return true;
	if (/digital/i.test(blob) && /book/i.test(blob)) return true;
	return false;
}

function isPhysicalBookCategory(category: string): boolean {
	const c = category.toLowerCase().replace(/[^a-z]/g, '');
	if (!c) return false;
	if (/kindle|ebook|audiobook|audible/.test(c)) return false;
	return c === 'book' || c === 'books' || c === 'abisbook';
}

function isPhysicalFormat(format: string): boolean {
	return /paperback|hardcover|hardback|mass market|board book|library binding/i.test(format);
}

/**
 * Title suggestions run only for physical-book rows (Category `Books` /
 * `ABIS_BOOK`, or a legacy print Format). When the file has neither column,
 * title matching stays on — the caller reviews suggestions and nothing is written.
 */
export function orderAllowsTitleMatch(order: AmazonOrderRow): boolean {
	if (orderIsKindle(order)) return false;
	if (order.category == null && order.format == null) return true;
	if (order.category && isPhysicalBookCategory(order.category)) return true;
	if (order.format && isPhysicalFormat(order.format)) return true;
	return false;
}

/** Library row is itself a Kindle / ebook / audiobook edition. */
export function bookIsDigitalEdition(
	book: Pick<LibraryAcquiredBook, 'title' | 'subtitle' | 'edition'>
): boolean {
	const blob = `${book.title ?? ''} ${book.subtitle ?? ''} ${book.edition ?? ''}`;
	return /\bkindle\b|\be-?books?\b|\baudiobooks?\b/i.test(blob);
}

/**
 * Match key: lowercased, diacritics stripped, parentheticals removed,
 * colon treated as a space, punctuation collapsed, leading articles stripped.
 */
export function normalizeAmazonTitleKey(title: string): string {
	let s = title.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
	s = s.replace(/\s*[([\{][^)\]\}]*[)\]\}]\s*/g, ' ');
	s = s.replace(/\bkindle edition\b/g, ' ');
	s = s.replace(/:/g, ' ');
	s = s
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return stripArticlesForImporterMatchKey(s);
}

function bookTitleKeys(book: LibraryAcquiredBook): string[] {
	const title = book.title?.trim() ?? '';
	if (!title) return [];
	const keys = new Set<string>();
	keys.add(normalizeAmazonTitleKey(title));
	const subtitle = book.subtitle?.trim();
	if (subtitle) keys.add(normalizeAmazonTitleKey(`${title}: ${subtitle}`));
	return [...keys].filter((k) => k.length >= 3);
}

function delimiterFor(text: string): ',' | '\t' {
	const first = text.split(/\r?\n/, 1)[0] ?? '';
	if (first.includes('\t') && !first.includes(',')) return '\t';
	return ',';
}

/**
 * Parse an Amazon Items CSV. Required headers: Order Date, Order ID, Title,
 * and ASIN/ISBN (or ASIN, or ISBN).
 */
export function parseAmazonOrdersCsv(
	text: string
): { ok: true; orders: AmazonOrderRow[]; unparsed: number } | { ok: false; message: string } {
	const matrix = parseDelimitedRows(text, delimiterFor(text));
	if (matrix.length === 0) return { ok: false, message: 'CSV is empty.' };
	const headers = matrix[0] ?? [];
	const dateIdx = findHeader(headers, ['orderdate']);
	const idIdx = findHeader(headers, ['orderid', 'amazonorderid']);
	const titleIdx = findHeader(headers, ['title', 'productname']);
	const asinIdx = findHeader(headers, ['asinisbn', 'asin', 'isbn']);
	const missing: string[] = [];
	if (dateIdx < 0) missing.push('Order Date');
	if (idIdx < 0) missing.push('Order ID');
	if (titleIdx < 0) missing.push('Title');
	if (asinIdx < 0) missing.push('ASIN/ISBN');
	if (missing.length > 0) {
		return { ok: false, message: `CSV is missing ${missing.join(', ')}.` };
	}
	const categoryIdx = findHeader(headers, ['category']);
	const formatIdx = findHeader(headers, ['format']);
	const statusIdx = findHeader(headers, ['orderstatus', 'shipmentordercondition']);
	const qtyIdx = findHeader(headers, ['quantity']);

	const orders: AmazonOrderRow[] = [];
	let unparsed = 0;
	for (let i = 1; i < matrix.length; i++) {
		const row = matrix[i] ?? [];
		if (row.every((c) => c.trim() === '')) continue;
		const title = cell(row, titleIdx);
		const orderId = cell(row, idIdx);
		const orderDate = parseAmazonOrderDate(cell(row, dateIdx));
		if (!title || !orderId || !orderDate) {
			unparsed += 1;
			continue;
		}
		const asin = cell(row, asinIdx);
		const isbn = asin ? normalizeIsbnDigits(asin) : null;
		const status = statusIdx >= 0 ? cell(row, statusIdx) : '';
		const qty = qtyIdx >= 0 ? parseQuantity(cell(row, qtyIdx)) : null;
		orders.push({
			line: i + 1,
			orderId,
			orderDate,
			title,
			asin,
			isbn,
			category: categoryIdx >= 0 ? cell(row, categoryIdx) : null,
			format: formatIdx >= 0 ? cell(row, formatIdx) : null,
			cancelled: isCancelledStatus(status) || qty === 0
		});
	}
	if (orders.length === 0 && unparsed === 0) {
		return { ok: false, message: 'CSV has a header but no item rows.' };
	}
	return { ok: true, orders, unparsed };
}

function addToMap(
	map: Map<string, LibraryAcquiredBook[]>,
	key: string,
	book: LibraryAcquiredBook
): void {
	if (key.length < 3) return;
	const list = map.get(key);
	if (!list) {
		map.set(key, [book]);
		return;
	}
	if (!list.some((b) => b.id === book.id)) list.push(book);
}

function booksForIsbn(
	isbn: string,
	poolIds: Set<string>,
	byIsbn: Map<string, LibraryAcquiredBook[]>
): LibraryAcquiredBook[] {
	const found = new Map<string, LibraryAcquiredBook>();
	for (const key of isbnMatchKeys(isbn)) {
		for (const book of byIsbn.get(key) ?? []) {
			if (poolIds.has(book.id)) found.set(book.id, book);
		}
	}
	return [...found.values()];
}

function booksForTitle(
	title: string,
	poolIds: Set<string>,
	byTitle: Map<string, LibraryAcquiredBook[]>
): LibraryAcquiredBook[] {
	const key = normalizeAmazonTitleKey(title);
	if (key.length < 3) return [];
	return (byTitle.get(key) ?? []).filter((b) => poolIds.has(b.id));
}

type Hit = { book: LibraryAcquiredBook; order: AmazonOrderRow };

function earliestHit(hits: Hit[]): Hit {
	return hits.reduce((best, hit) => {
		if (hit.order.orderDate < best.order.orderDate) return hit;
		if (hit.order.orderDate === best.order.orderDate && hit.order.orderId < best.order.orderId) {
			return hit;
		}
		return best;
	});
}

function groupEarliest(hits: Hit[]): Map<string, Hit> {
	const grouped = new Map<string, Hit[]>();
	for (const hit of hits) {
		const list = grouped.get(hit.book.id);
		if (list) list.push(hit);
		else grouped.set(hit.book.id, [hit]);
	}
	const out = new Map<string, Hit>();
	for (const [id, list] of grouped) out.set(id, earliestHit(list));
	return out;
}

function asCivil(raw: string | null): string | null {
	if (!raw) return null;
	const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
	return m ? m[1]! : raw.trim();
}

function toProposal(hit: Hit, via: 'isbn' | 'title'): AcquiredProposal {
	const acquiredOn = asCivil(hit.book.acquiredOn);
	return {
		bookId: hit.book.id,
		title: hit.book.title?.trim() || '(untitled)',
		acquiredOn,
		proposedOn: hit.order.orderDate,
		orderId: hit.order.orderId,
		orderTitle: hit.order.title,
		via,
		earlier: acquiredOn == null || hit.order.orderDate < acquiredOn
	};
}

function byProposedThenTitle(a: AcquiredProposal, b: AcquiredProposal): number {
	if (a.proposedOn !== b.proposedOn) return a.proposedOn < b.proposedOn ? -1 : 1;
	const title = a.title.localeCompare(b.title);
	if (title !== 0) return title;
	return a.bookId < b.bookId ? -1 : a.bookId > b.bookId ? 1 : 0;
}

/**
 * Match orders to owned books.
 * An ISBN that does not hit a book is a miss — it is not retried as a title
 * (that would date a different edition). Several orders for one book keep the
 * earliest date. A same-day tie keeps the lower order id.
 */
export function matchAmazonAcquiredOn(args: {
	orders: AmazonOrderRow[];
	books: LibraryAcquiredBook[];
	unparsed?: number;
}): AmazonAcquiredMatch {
	const owned = args.books.filter((b) => b.owned === true);
	const digital = owned.filter((b) => bookIsDigitalEdition(b));
	const digitalIds = new Set(digital.map((b) => b.id));
	const ownedIds = new Set(owned.map((b) => b.id));

	const byIsbn = new Map<string, LibraryAcquiredBook[]>();
	const byTitle = new Map<string, LibraryAcquiredBook[]>();
	for (const book of owned) {
		const normalized = book.isbn ? normalizeIsbnDigits(book.isbn) : null;
		if (normalized) {
			for (const key of isbnMatchKeys(normalized)) addToMap(byIsbn, key, book);
		}
		for (const key of bookTitleKeys(book)) addToMap(byTitle, key, book);
	}

	const isbnHits: Hit[] = [];
	const titleHits: Hit[] = [];
	const misses: AmazonOrderRow[] = [];
	const skippedKindle: AmazonOrderRow[] = [];
	const isbnAmbiguous: AmazonIsbnAmbiguous[] = [];
	const titleAmbiguous: AmazonTitleAmbiguous[] = [];
	let skippedCancelled = 0;
	let skippedNonBook = 0;

	for (const order of args.orders) {
		if (order.cancelled) {
			skippedCancelled += 1;
			continue;
		}

		if (orderIsKindle(order)) {
			if (order.isbn) {
				const found = booksForIsbn(order.isbn, digitalIds, byIsbn);
				if (found.length === 1) isbnHits.push({ book: found[0]!, order });
				else if (found.length > 1) {
					isbnAmbiguous.push({
						orderId: order.orderId,
						orderTitle: order.title,
						orderDate: order.orderDate,
						bookIds: found.map((b) => b.id).sort()
					});
				} else skippedKindle.push(order);
			} else {
				const found = booksForTitle(order.title, digitalIds, byTitle);
				if (found.length === 1) titleHits.push({ book: found[0]!, order });
				else if (found.length > 1) {
					titleAmbiguous.push({
						orderId: order.orderId,
						orderTitle: order.title,
						orderDate: order.orderDate,
						bookIds: found.map((b) => b.id).sort()
					});
				} else skippedKindle.push(order);
			}
			continue;
		}

		if (order.isbn) {
			const found = booksForIsbn(order.isbn, ownedIds, byIsbn);
			if (found.length === 1) isbnHits.push({ book: found[0]!, order });
			else if (found.length > 1) {
				isbnAmbiguous.push({
					orderId: order.orderId,
					orderTitle: order.title,
					orderDate: order.orderDate,
					bookIds: found.map((b) => b.id).sort()
				});
			} else misses.push(order);
			continue;
		}

		if (!orderAllowsTitleMatch(order)) {
			skippedNonBook += 1;
			continue;
		}

		const found = booksForTitle(order.title, ownedIds, byTitle);
		if (found.length === 1) titleHits.push({ book: found[0]!, order });
		else if (found.length > 1) {
			titleAmbiguous.push({
				orderId: order.orderId,
				orderTitle: order.title,
				orderDate: order.orderDate,
				bookIds: found.map((b) => b.id).sort()
			});
		} else misses.push(order);
	}

	const isbnByBook = groupEarliest(isbnHits);
	const titleByBook = groupEarliest(titleHits);
	const isbnMatches = [...isbnByBook.values()]
		.map((hit) => toProposal(hit, 'isbn'))
		.sort(byProposedThenTitle);

	const titleSuggestions: AcquiredProposal[] = [];
	for (const [id, hit] of titleByBook) {
		const isbnHit = isbnByBook.get(id);
		if (isbnHit && hit.order.orderDate >= isbnHit.order.orderDate) continue;
		titleSuggestions.push(toProposal(hit, 'title'));
	}
	titleSuggestions.sort(byProposedThenTitle);

	return {
		isbnMatches,
		titleSuggestions,
		misses,
		skippedKindle,
		skippedCancelled,
		skippedNonBook,
		isbnAmbiguous,
		titleAmbiguous,
		unparsed: args.unparsed ?? 0
	};
}

/** ISBN proposals whose date differs from the current `acquired_on`. */
export function isbnApplyRows(match: AmazonAcquiredMatch): AcquiredProposal[] {
	return match.isbnMatches.filter((row) => row.proposedOn !== (row.acquiredOn ?? ''));
}

function tsvCell(value: string): string {
	return value.replace(/[\t\r\n]/g, ' ');
}

function direction(row: AcquiredProposal): 'earlier' | 'later' | 'same' {
	if (row.proposedOn === (row.acquiredOn ?? '')) return 'same';
	return row.earlier ? 'earlier' : 'later';
}

function proposalTsv(kind: string, row: AcquiredProposal): string {
	return [
		kind,
		row.bookId,
		tsvCell(row.title),
		row.acquiredOn ?? '',
		row.proposedOn,
		row.orderId,
		tsvCell(row.orderTitle),
		direction(row)
	].join('\t');
}

/** Spreadsheet preview. `kind` is `isbn` (eligible to write) or `title` (suggestion only). */
export function formatAmazonAcquiredTsv(match: AmazonAcquiredMatch): string {
	const lines = [
		[
			'kind',
			'book_id',
			'title',
			'acquired_on',
			'proposed_on',
			'order_id',
			'order_title',
			'direction'
		].join('\t')
	];
	for (const row of match.isbnMatches) lines.push(proposalTsv('isbn', row));
	for (const row of match.titleSuggestions) lines.push(proposalTsv('title', row));
	return `${lines.join('\n')}\n`;
}

/** Counts plus the ISBN and title preview lists. */
export function formatAmazonAcquiredReport(match: AmazonAcquiredMatch): string {
	const writes = isbnApplyRows(match);
	const unchanged = match.isbnMatches.length - writes.length;
	const laterWrites = writes.filter((row) => !row.earlier).length;
	const lines = [
		`ISBN match: ${match.isbnMatches.length}`,
		`Title suggestion: ${match.titleSuggestions.length}`,
		`Miss: ${match.misses.length}`,
		`Skipped Kindle: ${match.skippedKindle.length}`,
		`Would write: ${writes.length}`,
		`Would write later than current: ${laterWrites}`,
		`ISBN unchanged: ${unchanged}`,
		`ISBN ambiguous: ${match.isbnAmbiguous.length}`,
		`Title ambiguous: ${match.titleAmbiguous.length}`,
		`Skipped cancelled: ${match.skippedCancelled}`,
		`Skipped non-book: ${match.skippedNonBook}`,
		`Unparsed: ${match.unparsed}`,
		'',
		'ISBN matches (apply writes these when the date differs):',
		'book_id\ttitle\tacquired_on\tproposed_on\torder_id\tdirection'
	];
	if (match.isbnMatches.length === 0) lines.push('(none)');
	for (const row of match.isbnMatches) {
		lines.push(
			[
				row.bookId,
				tsvCell(row.title),
				row.acquiredOn ?? '',
				row.proposedOn,
				row.orderId,
				direction(row)
			].join('\t')
		);
	}
	lines.push(
		'',
		'Title suggestions (not applied):',
		'book_id\ttitle\tacquired_on\tproposed_on\torder_id\tdirection'
	);
	if (match.titleSuggestions.length === 0) lines.push('(none)');
	for (const row of match.titleSuggestions) {
		lines.push(
			[
				row.bookId,
				tsvCell(row.title),
				row.acquiredOn ?? '',
				row.proposedOn,
				row.orderId,
				direction(row)
			].join('\t')
		);
	}
	return `${lines.join('\n')}\n`;
}
