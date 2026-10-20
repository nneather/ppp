/**
 * Turretin index state machine (book headings, pending flush, accept gate).
 * Column/PDF clustering stays in parse-turretin-text.ts.
 */
import { BIBLE_BOOK_NAMES } from '../../src/lib/library/bible-book-names.ts';
import { validateIndexRows } from '../../src/lib/library/scripture-index-validate.ts';
import { parseIndexEntry, type IndexGoldRow } from './parse-index-line.ts';
import { normalizeTurretinIndexLine } from './turretin-line-normalize.ts';
import {
	APOCRYPHA_BOOKS,
	APOCRYPHA_HEADING_ALIASES,
	isApocryphaBook,
	validateApocryphaRows
} from './turretin-apocrypha.ts';
import type { TurretinRow } from './turretin-gold.ts';
import {
	blockKey,
	correctionsFromBlocks,
	skipKeysFromBlocks,
	type ReviewBlock
} from './turretin-review.ts';

const BOOK_ALIASES: Record<string, string> = {
	'song of solomon': 'Song of Songs'
};

export type ParsedColumnLine = {
	printedPage: number;
	column: number;
	text: string;
};

export type ReviewItem = {
	printedPage: number;
	column: number;
	raw: string;
	reason: string;
	book?: string;
};

export type ParseTurretinResult = {
	linesOut: string[];
	rows: TurretinRow[];
	review: ReviewItem[];
	/** Raw lines dropped via skip: (not written to review). */
	skipped: ReviewItem[];
	rowsByPrinted: Map<number, TurretinRow[]>;
	linesByPrinted: Map<number, string[]>;
};

function normalizeHeading(text: string): string {
	return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

const HEADING_BY_NORM = new Map<string, string>();
for (const name of BIBLE_BOOK_NAMES) {
	HEADING_BY_NORM.set(normalizeHeading(name), name);
}
for (const name of APOCRYPHA_BOOKS) {
	HEADING_BY_NORM.set(normalizeHeading(name), name);
}
for (const [alias, canon] of Object.entries(BOOK_ALIASES)) {
	HEADING_BY_NORM.set(alias, canon);
}
for (const [alias, book] of Object.entries(APOCRYPHA_HEADING_ALIASES)) {
	HEADING_BY_NORM.set(alias, book);
}

export function resolveBookHeading(text: string): string | null {
	const norm = normalizeHeading(text);
	if (HEADING_BY_NORM.has(norm)) return HEADING_BY_NORM.get(norm)!;
	// FineReader sometimes glues a heading to the next entry ("Joel 2:11-…").
	for (const [hn, book] of HEADING_BY_NORM) {
		if (norm.startsWith(hn + ' ')) return book;
	}
	return null;
}

export function isRunningHeader(text: string): boolean {
	const t = text.trim();
	if (/^index\s+of\s+scripture/i.test(t)) return true;
	if (/^index$/i.test(t)) return true;
	if (/^of\s+scripture/i.test(t)) return true;
	if (/apocrypha/i.test(t) && t.length < 40) return true;
	// Glued page number + INDEX (e.g. "754 INDEX").
	if (/^\d{3}\s+index$/i.test(t)) return true;
	return false;
}

export function isPrintedPageNumberLine(text: string, printedPage: number): boolean {
	const t = text.trim();
	if (!/^\d{3}$/.test(t)) return false;
	const n = Number(t);
	return n === printedPage || n === printedPage - 1 || n === printedPage + 1;
}

const ENTRY_START = /^\d+(?::\d+)?(?:\s*[,\-–]\s*\d+)?\s*(?:[—–\-']|\d+:\d+)/;

export function looksLikeEntryStart(text: string): boolean {
	return ENTRY_START.test(text.trim());
}

export function looksLikeContinuation(text: string): boolean {
	const t = text.trim();
	if (!t) return false;
	if (looksLikeEntryStart(t)) return false;
	if (resolveBookHeading(t)) return false;
	if (/^[A-Za-z]/.test(t) && !/^\d/.test(t)) return false;
	return /^[\d:,\s\-–—']+$/.test(t);
}

function stripHeadingPrefix(text: string, headingNorm: string): string {
	const norm = normalizeHeading(text);
	if (!norm.startsWith(headingNorm + ' ')) return text;
	// Reconstruct rest from original by matching case-insensitive prefix length in words.
	const words = headingNorm.split(' ');
	const parts = text.trim().split(/\s+/);
	if (parts.length <= words.length) return '';
	return parts.slice(words.length).join(' ').trim();
}

type CorrectionLookup = {
	byKey: Map<string, ReviewBlock>;
	skipKeys: Set<string>;
};

function buildCorrectionLookup(corrections: ReviewBlock[]): CorrectionLookup {
	const byKey = new Map<string, ReviewBlock>();
	for (const c of correctionsFromBlocks(corrections)) {
		byKey.set(blockKey(c), c);
	}
	return { byKey, skipKeys: skipKeysFromBlocks(corrections) };
}

/**
 * Parse ordered column lines into accepted index lines + rows + review items.
 * Corrections apply in place (same printedPage:column:raw).
 */
export function parseTurretinLines(
	lines: ParsedColumnLine[],
	opts?: { corrections?: ReviewBlock[]; sourceComment?: string }
): ParseTurretinResult {
	const lookup = buildCorrectionLookup(opts?.corrections ?? []);
	const linesOut: string[] = [];
	if (opts?.sourceComment) linesOut.push(opts.sourceComment);

	const review: ReviewItem[] = [];
	const skipped: ReviewItem[] = [];
	const rowsByPrinted = new Map<number, TurretinRow[]>();
	const linesByPrinted = new Map<number, string[]>();
	const allRows: TurretinRow[] = [];

	let currentBook = '';
	let prevChapter = 0;

	function pushReview(item: ReviewItem): void {
		if (!item.book && currentBook) item.book = currentBook;
		const key = blockKey({
			printedPage: item.printedPage,
			column: item.column,
			raw: item.raw
		});
		if (lookup.skipKeys.has(key)) {
			skipped.push(item);
			return;
		}
		const corr = lookup.byKey.get(key);
		if (corr?.corrected && corr.book) {
			const ok = acceptCorrected(
				corr.corrected,
				corr.book,
				item.printedPage,
				item.column,
				item.raw
			);
			if (ok) return;
			review.push({
				printedPage: item.printedPage,
				column: item.column,
				raw: item.raw,
				reason: `corrected still fails: ${item.reason}`,
				book: corr.book
			});
			return;
		}
		review.push(item);
	}

	function tryParseLine(
		line: string,
		book: string,
		printedPage: number,
		column: number
	): IndexGoldRow[] | null {
		try {
			return parseIndexEntry(normalizeTurretinIndexLine(line, book), book);
		} catch (e) {
			const reason = e instanceof Error ? e.message : String(e);
			pushReview({ printedPage, column, raw: line, reason, book });
			return null;
		}
	}

	function recordAccepted(
		line: string,
		book: string,
		parsed: IndexGoldRow[],
		printedPage: number,
		column: number
	): void {
		const chapter = parsed[0]?.chapter_start ?? 0;
		prevChapter = chapter;
		linesOut.push(line);
		const withMeta: TurretinRow[] = parsed.map((r) => ({
			...r,
			printed_page: printedPage,
			column,
			source_line: `${book}\t${line}`
		}));
		allRows.push(...withMeta);
		const pageRows = rowsByPrinted.get(printedPage) ?? [];
		pageRows.push(...withMeta);
		rowsByPrinted.set(printedPage, pageRows);
		const pageLines = linesByPrinted.get(printedPage) ?? [];
		pageLines.push(line);
		linesByPrinted.set(printedPage, pageLines);
	}

	function validateParsed(
		parsed: IndexGoldRow[],
		book: string
	): { ok: true } | { ok: false; reason: string } {
		for (const row of parsed) {
			const vs = row.verse_start;
			if (vs != null && row.bible_book !== 'Psalms' && vs > 100) {
				return { ok: false, reason: 'suspicious_verse_token' };
			}
		}
		const issues = isApocryphaBook(book)
			? validateApocryphaRows(parsed).filter((i) => i.reason !== 'short_page_among_longer')
			: validateIndexRows(parsed).filter((i) => i.reason !== 'short_page_among_longer');
		if (issues.length > 0) {
			return {
				ok: false,
				reason: isApocryphaBook(book)
					? `validateApocryphaRows: ${issues[0]!.reason}`
					: `validateIndexRows: ${issues[0]!.reason}`
			};
		}
		return { ok: true };
	}

	function acceptLine(
		line: string,
		book: string,
		printedPage: number,
		column: number
	): void {
		const key = blockKey({ printedPage, column, raw: line });
		if (lookup.skipKeys.has(key)) {
			skipped.push({ printedPage, column, raw: line, reason: 'skip', book });
			return;
		}
		const corr = lookup.byKey.get(key);
		if (corr?.corrected && corr.book) {
			const ok = acceptCorrected(corr.corrected, corr.book, printedPage, column, line);
			if (ok) return;
			pushReview({
				printedPage,
				column,
				raw: line,
				reason: 'corrected still fails',
				book: corr.book
			});
			return;
		}

		const parsed = tryParseLine(line, book, printedPage, column);
		if (!parsed?.length) return;
		const v = validateParsed(parsed, book);
		if (!v.ok) {
			pushReview({ printedPage, column, raw: line, reason: v.reason, book });
			return;
		}
		recordAccepted(line, book, parsed, printedPage, column);
	}

	/** Apply a corrected line without re-entering the correction lookup (avoids loops). */
	function acceptCorrected(
		line: string,
		book: string,
		printedPage: number,
		column: number,
		_originalRaw: string
	): boolean {
		let parsed: IndexGoldRow[];
		try {
			parsed = parseIndexEntry(normalizeTurretinIndexLine(line, book), book);
		} catch {
			return false;
		}
		if (!parsed.length) return false;
		for (const row of parsed) {
			const vs = row.verse_start;
			if (vs != null && row.bible_book !== 'Psalms' && vs > 100) return false;
		}
		const issues = isApocryphaBook(book)
			? validateApocryphaRows(parsed)
			: validateIndexRows(parsed).filter((i) => i.reason !== 'short_page_among_longer');
		if (issues.length > 0) return false;
		recordAccepted(line, book, parsed, printedPage, column);
		return true;
	}

	function setBook(book: string): void {
		currentBook = book;
		prevChapter = 0;
		linesOut.push(`# book ${book}`);
	}

	// Process in document order; caller must already sort by page → column → y.
	let pending: { text: string; printedPage: number; column: number } | null = null;

	function flushPending(): void {
		if (!pending) return;
		const p = pending;
		pending = null;
		if (!currentBook) {
			pushReview({
				printedPage: p.printedPage,
				column: p.column,
				raw: p.text,
				reason: 'entry before book heading'
			});
			return;
		}
		acceptLine(p.text, currentBook, p.printedPage, p.column);
	}

	for (const { text, printedPage, column } of lines) {
		if (isRunningHeader(text)) continue;
		if (isPrintedPageNumberLine(text, printedPage)) continue;

		const heading = resolveBookHeading(text);
		if (heading) {
			flushPending();
			setBook(heading);
			const norm = normalizeHeading(text);
			const hn = [...HEADING_BY_NORM.keys()].find((k) => norm.startsWith(k + ' '));
			if (hn) {
				// Glued heading+entry ("Joel 2:11—…") or heading that also looksLikeEntryStart.
				const rest = stripHeadingPrefix(text, hn);
				if (rest) {
					if (looksLikeEntryStart(rest) || looksLikeEntryStart(text)) {
						acceptLine(rest, currentBook, printedPage, column);
					} else if (looksLikeContinuation(rest) || /^\d/.test(rest)) {
						acceptLine(rest, currentBook, printedPage, column);
					} else {
						pushReview({
							printedPage,
							column,
							raw: rest,
							reason: 'unrecognized line after glued heading',
							book: currentBook
						});
					}
				}
			}
			continue;
		}

		if (!currentBook && !pending) {
			pushReview({
				printedPage,
				column,
				raw: text,
				reason: 'entry before book heading'
			});
			continue;
		}

		if (pending && looksLikeEntryStart(text)) {
			flushPending();
			pending = { text, printedPage, column };
			continue;
		}

		if (pending && looksLikeContinuation(text)) {
			pending = {
				text: `${pending.text} ${text}`,
				printedPage: pending.printedPage,
				column: pending.column
			};
			continue;
		}

		if (pending) {
			flushPending();
		}

		if (looksLikeContinuation(text)) {
			pushReview({
				printedPage,
				column,
				raw: text,
				reason: 'continuation without prior entry',
				book: currentBook || undefined
			});
			continue;
		}

		if (looksLikeEntryStart(text)) {
			pending = { text, printedPage, column };
		} else {
			pushReview({
				printedPage,
				column,
				raw: text,
				reason: 'unrecognized line',
				book: currentBook || undefined
			});
		}
	}

	flushPending();

	const sorted = sortLinesAndRowsWithinBooks(linesOut, allRows);

	return {
		linesOut: sorted.linesOut,
		rows: sorted.rows,
		review,
		skipped,
		rowsByPrinted: sorted.rowsByPrinted,
		linesByPrinted: sorted.linesByPrinted
	};
}

function lineCanonicalKey(line: string, book: string): number {
	const norm = normalizeTurretinIndexLine(line, book);
	try {
		const p = parseIndexEntry(norm, book)[0];
		return (p.chapter_start ?? 0) * 1000 + (p.verse_start ?? 0);
	} catch {
		return Number.MAX_SAFE_INTEGER - 1;
	}
}

/** Multi-column PDF order can run 10:6 before 10:3; index rows are canonical within each book. */
function sortLinesAndRowsWithinBooks(
	linesOut: string[],
	allRows: TurretinRow[]
): {
	linesOut: string[];
	rows: TurretinRow[];
	rowsByPrinted: Map<number, TurretinRow[]>;
	linesByPrinted: Map<number, string[]>;
} {
	const sortedLines: string[] = [];
	let i = 0;
	while (i < linesOut.length) {
		const line = linesOut[i]!;
		if (!line.startsWith('# book ')) {
			sortedLines.push(line);
			i++;
			continue;
		}
		const book = line.slice('# book '.length).trim();
		sortedLines.push(line);
		i++;
		const entries: string[] = [];
		while (i < linesOut.length && !linesOut[i]!.startsWith('# book ')) {
			const entry = linesOut[i]!;
			if (!entry.startsWith('#')) entries.push(entry);
			else sortedLines.push(entry);
			i++;
		}
		entries.sort((a, b) => lineCanonicalKey(a, book) - lineCanonicalKey(b, book));
		sortedLines.push(...entries);
	}

	const rowsByLine = new Map<string, TurretinRow[]>();
	for (const r of allRows) {
		const key = r.source_line ?? '';
		if (!key) continue;
		const list = rowsByLine.get(key) ?? [];
		list.push(r);
		rowsByLine.set(key, list);
	}

	let sortBook = '';
	const sortedRows: TurretinRow[] = [];
	for (const line of sortedLines) {
		if (line.startsWith('# book ')) {
			sortBook = line.slice('# book '.length).trim();
			continue;
		}
		if (line.startsWith('#')) continue;
		const chunk = rowsByLine.get(`${sortBook}\t${line}`);
		if (chunk) sortedRows.push(...chunk);
	}

	const seenRowKeys = new Set<string>();
	const dedupedRows: TurretinRow[] = [];
	for (const r of sortedRows) {
		const k = [
			r.bible_book,
			r.chapter_start,
			r.verse_start ?? '',
			r.chapter_end ?? '',
			r.verse_end ?? '',
			r.page_start,
			r.page_end ?? '',
			r.volume
		].join('|');
		if (seenRowKeys.has(k)) continue;
		seenRowKeys.add(k);
		dedupedRows.push(r);
	}

	const rowsByPrinted = new Map<number, TurretinRow[]>();
	const linesByPrinted = new Map<number, string[]>();
	for (const r of dedupedRows) {
		const p = r.printed_page;
		if (p == null) continue;
		const pr = rowsByPrinted.get(p) ?? [];
		pr.push(r);
		rowsByPrinted.set(p, pr);
		const sl = r.source_line?.split('\t')[1];
		if (sl) {
			const pl = linesByPrinted.get(p) ?? [];
			if (!pl.includes(sl)) pl.push(sl);
			linesByPrinted.set(p, pl);
		}
	}

	return { linesOut: sortedLines, rows: dedupedRows, rowsByPrinted, linesByPrinted };
}

/** Format review items for turretin.review.txt (open items only; corrections live in the prior file). */
export function formatReviewFile(items: ReviewItem[]): string {
	const out: string[] = [];
	for (const r of items) {
		const pageLabel = r.printedPage > 0 ? `p.${r.printedPage}` : 'p.?';
		out.push(`# ${pageLabel} col ${r.column}`);
		out.push(`reason: ${r.reason}`);
		if (r.book) out.push(`book: ${r.book}`);
		out.push(r.raw);
		out.push('');
	}
	return out.join('\n');
}
