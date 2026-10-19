/**
 * Parse Turretin vol. 3 scripture index from the PDF text layer (FineReader).
 * No rasterize, no ocr_scripture_refs.
 *
 *   npx tsx scripts/ocr-index-eval/parse-turretin-text.ts [path-to.pdf]
 *
 * Outputs (gitignored): turretin.lines.txt, turretin.review.txt, turretin.rows.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { BIBLE_BOOK_NAMES } from '../../src/lib/library/bible-book-names.ts';
import { validateIndexRows } from '../../src/lib/library/scripture-index-validate.ts';
import { parseIndexEntry, type IndexGoldRow } from './parse-index-line.ts';

const here = dirname(fileURLToPath(import.meta.url));

const DEFAULT_PDF =
	'/Users/Neal/Documents/ppp/PDFs for parsing/Institutes-of-Elenctic-Theology-Francis-Turretin-vol-3-scripture-index.pdf';

const PRINTED_FIRST = 739;
const COLUMN_ANCHORS = [130, 250, 360];

const APOCRYPHA_HEADINGS = [
	'2 Esdras',
	'Tobit',
	'Judith',
	'Wisdom of Solomon',
	'Son of Sirach',
	'Baruch',
	'1 Maccabees',
	'2 Maccabees'
] as const;

const BOOK_ALIASES: Record<string, string> = {
	'song of solomon': 'Song of Songs'
};

const GOLD_LEAF_PAGES: { printed: number; goldId: string }[] = [
	{ printed: 760, goldId: 'page-03' },
	{ printed: 764, goldId: 'page-01' },
	{ printed: 766, goldId: 'page-02' }
];

type TextItem = { str: string; x: number; y: number };

type ParsedLine = {
	printedPage: number;
	column: number;
	y: number;
	text: string;
};

type ReviewItem = {
	printedPage: number;
	column: number;
	raw: string;
	reason: string;
	book?: string;
};

function columnForX(x: number): number {
	let col = 0;
	for (const anchor of COLUMN_ANCHORS) {
		if (x >= anchor - 15) col += 1;
	}
	return Math.min(Math.max(col, 1), 3);
}

function pdfPageNumber(printedPage: number): number {
	return printedPage - PRINTED_FIRST + 1;
}

function clusterPageLines(items: TextItem[]): ParsedLine[] {
	const buckets = new Map<string, TextItem[]>();
	for (const item of items) {
		const col = columnForX(item.x);
		const yKey = Math.round(item.y / 3) * 3;
		const k = `${col}:${yKey}`;
		const list = buckets.get(k) ?? [];
		list.push(item);
		buckets.set(k, list);
	}
	const rows: ParsedLine[] = [];
	for (const [k, parts] of buckets) {
		const [colStr, yStr] = k.split(':');
		parts.sort((a, b) => a.x - b.x);
		const text = parts.map((p) => p.str).join('').replace(/\s+/g, ' ').trim();
		if (!text) continue;
		rows.push({
			printedPage: 0,
			column: Number(colStr),
			y: Number(yStr),
			text
		});
	}
	rows.sort((a, b) => a.column - b.column || b.y - a.y);
	return rows;
}

async function loadPageItems(
	doc: Awaited<ReturnType<typeof getDocument>>['promise'],
	printedPage: number
): Promise<TextItem[]> {
	const page = await doc.getPage(pdfPageNumber(printedPage));
	const tc = await page.getTextContent();
	const out: TextItem[] = [];
	for (const raw of tc.items) {
		if (!('str' in raw) || typeof raw.str !== 'string') continue;
		const t = raw.transform;
		if (!Array.isArray(t) || t.length < 6) continue;
		out.push({ str: raw.str, x: t[4], y: t[5] });
	}
	return out;
}

function normalizeHeading(text: string): string {
	return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

const HEADING_BY_NORM = new Map<string, string>();
for (const name of BIBLE_BOOK_NAMES) {
	HEADING_BY_NORM.set(normalizeHeading(name), name);
}
for (const name of APOCRYPHA_HEADINGS) {
	HEADING_BY_NORM.set(normalizeHeading(name), name);
}
for (const [alias, canon] of Object.entries(BOOK_ALIASES)) {
	HEADING_BY_NORM.set(alias, canon);
}

function resolveBookHeading(text: string): string | null {
	const norm = normalizeHeading(text);
	if (HEADING_BY_NORM.has(norm)) return HEADING_BY_NORM.get(norm)!;
	// FineReader sometimes glues a heading to the next entry ("Joel 2:11-…").
	for (const [hn, book] of HEADING_BY_NORM) {
		if (norm.startsWith(hn + ' ')) return book;
	}
	return null;
}

function isRunningHeader(text: string): boolean {
	const t = text.trim();
	if (/^index\s+of\s+scripture/i.test(t)) return true;
	if (/^index$/i.test(t)) return true;
	if (/^of\s+scripture/i.test(t)) return true;
	if (/apocrypha/i.test(t) && t.length < 40) return true;
	return false;
}

function isPrintedPageNumberLine(text: string, printedPage: number): boolean {
	const t = text.trim();
	if (!/^\d{3}$/.test(t)) return false;
	const n = Number(t);
	return n === printedPage || n === printedPage - 1 || n === printedPage + 1;
}

const ENTRY_START =
	/^\d+(?::\d+)?(?:\s*[,\-–]\s*\d+)?\s*(?:[—–\-']|\d+:\d+)/;

function looksLikeEntryStart(text: string): boolean {
	const t = text.trim();
	if (!ENTRY_START.test(t)) return false;
	// Apostrophe-as-dash damage (18:24'32) — do not treat as a clean start for merge; still attempt parse later.
	return true;
}

function looksLikeContinuation(text: string): boolean {
	const t = text.trim();
	if (!t) return false;
	if (looksLikeEntryStart(t)) return false;
	if (resolveBookHeading(t)) return false;
	if (/^[A-Za-z]/.test(t) && !/^\d/.test(t)) return false;
	return /^[\d:,\s\-–—']+$/.test(t);
}

function apocryphaZone(printedPage: number, column: number): boolean {
	return (printedPage === 753 || printedPage === 754) && column === 1;
}

function apocryphaHeading(text: string): string | null {
	const norm = normalizeHeading(text);
	for (const name of APOCRYPHA_HEADINGS) {
		if (normalizeHeading(name) === norm) return name;
	}
	return null;
}

function isApocryphaBook(name: string): boolean {
	return (APOCRYPHA_HEADINGS as readonly string[]).includes(name);
}

type ReviewBlock = {
	printedPage: number;
	column: number;
	reason: string;
	book?: string;
	raw?: string;
	correctedLine?: string;
};

function loadReviewCorrections(path: string): ReviewBlock[] {
	if (!existsSync(path)) return [];
	const blocks: ReviewBlock[] = [];
	let current: ReviewBlock | null = null;
	for (const raw of readFileSync(path, 'utf8').split('\n')) {
		const line = raw.trimEnd();
		const header = line.match(/^# p\.(\d+)\s+col\s+(\d+)(?:\s+(.+))?$/);
		if (header) {
			if (current) blocks.push(current);
			current = {
				printedPage: Number(header[1]),
				column: Number(header[2]),
				reason: header[3]?.trim() ?? ''
			};
			continue;
		}
		if (!current) continue;
		if (line.startsWith('reason:')) {
			current.reason = line.slice('reason:'.length).trim();
			continue;
		}
		if (line.startsWith('book:')) {
			current.book = line.slice('book:'.length).trim();
			continue;
		}
		if (line.startsWith('corrected:')) {
			current.correctedLine = line.slice('corrected:'.length).trim();
			continue;
		}
		if (!line.trim() || line.startsWith('#')) continue;
		if (!current.raw) current.raw = line.trim();
		else if (!current.correctedLine && line.trim() !== current.raw) {
			current.correctedLine = line.trim();
		}
	}
	if (current) blocks.push(current);
	return blocks.filter((b) => b.correctedLine && b.book);
}

function rowKey(r: IndexGoldRow): string {
	return [
		r.bible_book,
		r.chapter_start,
		r.verse_start ?? '',
		r.chapter_end ?? '',
		r.verse_end ?? '',
		r.page_start,
		r.page_end ?? '',
		r.volume
	].join('|');
}

function compareGoldLeaves(
	rowsByPrinted: Map<number, IndexGoldRow[]>,
	linesByPrinted: Map<number, string[]>
): void {
	console.log('--- Gold leaf diff (exact keys as compare.ts) ---');
	let totalGold = 0;
	let totalMatch = 0;
	for (const { printed, goldId } of GOLD_LEAF_PAGES) {
		const goldPath = join(here, 'gold', `${goldId}.json`);
		const goldRaw = JSON.parse(readFileSync(goldPath, 'utf8')) as {
			running_book?: string;
			rows: IndexGoldRow[];
		};
		const goldRows = goldRaw.rows;
		const parsedRows = rowsByPrinted.get(printed) ?? [];
		const goldKeys = new Set(goldRows.map(rowKey));
		const parsedKeys = new Set(parsedRows.map(rowKey));
		let match = 0;
		const misses: string[] = [];
		for (const g of goldRows) {
			const k = rowKey(g);
			if (parsedKeys.has(k)) match += 1;
			else misses.push(k);
		}
		const extras = [...parsedKeys].filter((k) => !goldKeys.has(k));
		const rate = goldRows.length === 0 ? 0 : match / goldRows.length;
		console.log(
			`printed p.${printed} vs ${goldId}: ${match}/${goldRows.length} exact (${(rate * 100).toFixed(2)}%)` +
				(misses.length ? ` — ${misses.length} miss` : '') +
				(extras.length ? `, ${extras.length} extra` : '')
		);
		for (const m of misses) console.log(`  miss: ${m}`);
		for (const e of extras.slice(0, 20)) console.log(`  extra: ${e}`);
		if (extras.length > 20) console.log(`  … ${extras.length - 20} more extras`);
		const lineCount = linesByPrinted.get(printed)?.length ?? 0;
		console.log(`  (${lineCount} parsed index lines on this printed page)`);
		totalGold += goldRows.length;
		totalMatch += match;
	}
	const overall = totalGold === 0 ? 0 : totalMatch / totalGold;
	console.log('---');
	console.log(
		`gold leaves overall: ${totalMatch}/${totalGold} exact (${(overall * 100).toFixed(3)}%)`
	);
}

async function main(): Promise<void> {
	const pdfPath = process.argv[2] ?? DEFAULT_PDF;
	if (!existsSync(pdfPath)) {
		console.error(`PDF not found: ${pdfPath}`);
		process.exit(1);
	}

	const reviewPath = join(here, 'turretin.review.txt');
	const linesPath = join(here, 'turretin.lines.txt');
	const rowsPath = join(here, 'turretin.rows.json');

	// Re-run: only blocks with `book:` + `corrected:` (or a second line differing from raw).
	const corrections = loadReviewCorrections(reviewPath);

	const data = new Uint8Array(readFileSync(pdfPath));
	const doc = await getDocument({ data, useSystemFonts: true }).promise;
	const printedLast = PRINTED_FIRST + doc.numPages - 1;

	const linesOut: string[] = [
		'# source: Turretin vol. 3 scripture index — PDF text layer extract',
		`# pdf: ${pdfPath}`
	];
	const review: ReviewItem[] = [];
	const rowsByPrinted = new Map<number, IndexGoldRow[]>();
	const linesByPrinted = new Map<number, string[]>();
	const allRows: IndexGoldRow[] = [];

	let currentBook = '';
	let prevChapter = 0;
	let inApocryphaCol1 = false;

	function pushReview(item: ReviewItem): void {
		if (!item.book && currentBook) item.book = currentBook;
		review.push(item);
	}

	function tryParseLine(
		line: string,
		book: string,
		printedPage: number,
		column: number
	): IndexGoldRow[] | null {
		try {
			return parseIndexEntry(line, book);
		} catch (e) {
			const reason = e instanceof Error ? e.message : String(e);
			pushReview({ printedPage, column, raw: line, reason });
			return null;
		}
	}

	function acceptLine(
		line: string,
		book: string,
		printedPage: number,
		column: number
	): void {
		const parsed = tryParseLine(line, book, printedPage, column);
		if (!parsed?.length) return;
		for (const row of parsed) {
			const vs = row.verse_start;
			if (vs != null && row.bible_book !== 'Psalms' && vs > 100) {
				pushReview({
					printedPage,
					column,
					raw: line,
					reason: 'suspicious_verse_token'
				});
				return;
			}
		}
		const rowIssues = validateIndexRows(parsed).filter(
			(i) => i.reason !== 'short_page_among_longer'
		);
		if (rowIssues.length > 0) {
			pushReview({
				printedPage,
				column,
				raw: line,
				reason: `validateIndexRows: ${rowIssues[0]!.reason}`
			});
			return;
		}
		const chapter = parsed[0]?.chapter_start ?? 0;
		if (chapter < prevChapter) {
			pushReview({
				printedPage,
				column,
				raw: line,
				reason: `chapter went backwards (${prevChapter} → ${chapter})`
			});
			return;
		}
		prevChapter = chapter;
		linesOut.push(line);
		allRows.push(...parsed);
		const pageRows = rowsByPrinted.get(printedPage) ?? [];
		pageRows.push(...parsed);
		rowsByPrinted.set(printedPage, pageRows);
		const pageLines = linesByPrinted.get(printedPage) ?? [];
		pageLines.push(line);
		linesByPrinted.set(printedPage, pageLines);
	}

	function setBook(book: string): void {
		currentBook = book;
		prevChapter = 0;
		linesOut.push(`# book ${book}`);
	}

	for (let printed = PRINTED_FIRST; printed <= printedLast; printed += 1) {
		const items = await loadPageItems(doc, printed);
		const withPage = clusterPageLines(items).map((l) => ({ ...l, printedPage: printed }));

		const byColumn: ParsedLine[][] = [[], [], []];
		for (const l of withPage) {
			byColumn[l.column - 1]?.push(l);
		}

		for (let col = 1; col <= 3; col += 1) {
			if (!apocryphaZone(printed, col)) inApocryphaCol1 = false;
			const colLines = (byColumn[col - 1] ?? []).sort(
				(a, b) => a.printedPage - b.printedPage || b.y - a.y
			);
			let pending: string | null = null;

			for (const { text } of colLines) {
				if (isRunningHeader(text)) continue;
				if (isPrintedPageNumberLine(text, printed)) continue;

				const apocHead = apocryphaHeading(text);
				if (apocryphaZone(printed, col) && apocHead) {
					inApocryphaCol1 = true;
					pushReview({
						printedPage: printed,
						column: col,
						raw: text,
						reason: 'apocrypha (skipped)'
					});
					continue;
				}

				const heading = resolveBookHeading(text);
				if (heading && !looksLikeEntryStart(text)) {
					if (pending) {
						acceptLine(pending, currentBook, printed, col);
						pending = null;
					}
					if (apocryphaZone(printed, col) && isApocryphaBook(heading)) {
						inApocryphaCol1 = true;
						pushReview({
							printedPage: printed,
							column: col,
							raw: text,
							reason: 'apocrypha (skipped)'
						});
						continue;
					}
					setBook(heading);
					continue;
				}

				if (heading && looksLikeEntryStart(text)) {
					if (pending) {
						acceptLine(pending, currentBook, printed, col);
						pending = null;
					}
					// e.g. "Joel 2:11-…" — set book and fall through with remainder.
					setBook(heading);
					const norm = normalizeHeading(text);
					const hn = [...HEADING_BY_NORM.keys()].find((k) => norm.startsWith(k + ' '));
					if (hn) {
						const rest = text.slice(hn.length).trim();
						if (rest) {
							if (pending) {
								pushReview({
									printedPage: printed,
									column: col,
									raw: pending,
									reason: 'orphan continuation before glued heading+entry'
								});
								pending = null;
							}
							if (inApocryphaCol1 && apocryphaZone(printed, col)) {
								pushReview({
									printedPage: printed,
									column: col,
									raw: rest,
									reason: 'apocrypha (skipped)'
								});
							} else if (!currentBook) {
								pushReview({
									printedPage: printed,
									column: col,
									raw: rest,
									reason: 'entry before book heading'
								});
							} else {
								acceptLine(rest, currentBook, printed, col);
							}
						}
					}
					continue;
				}

				if (inApocryphaCol1 && apocryphaZone(printed, col)) {
					pushReview({
						printedPage: printed,
						column: col,
						raw: text,
						reason: 'apocrypha (skipped)'
					});
					continue;
				}

				if (!currentBook) {
					pushReview({
						printedPage: printed,
						column: col,
						raw: text,
						reason: 'entry before book heading'
					});
					continue;
				}

				if (pending && looksLikeEntryStart(text)) {
					acceptLine(pending, currentBook, printed, col);
					pending = text;
					continue;
				}

				if (pending && looksLikeContinuation(text)) {
					pending = `${pending} ${text}`;
					continue;
				}

				if (pending) {
					acceptLine(pending, currentBook, printed, col);
					pending = null;
				}

				if (looksLikeContinuation(text)) {
					pushReview({
						printedPage: printed,
						column: col,
						raw: text,
						reason: 'continuation without prior entry'
					});
					continue;
				}

				if (looksLikeEntryStart(text)) {
					pending = text;
				} else {
					pushReview({
						printedPage: printed,
						column: col,
						raw: text,
						reason: 'unrecognized line'
					});
				}
			}

			if (pending) {
				acceptLine(pending, currentBook, printed, col);
				pending = null;
			}
		}
	}

	for (const block of corrections) {
		if (!block.correctedLine || !block.book) continue;
		const parsed = tryParseLine(
			block.correctedLine,
			block.book,
			block.printedPage,
			block.column
		);
		if (!parsed?.length) continue;
		const rowIssues = validateIndexRows(parsed).filter(
			(i) => i.reason !== 'short_page_among_longer'
		);
		if (rowIssues.length > 0) continue;
		if (
			parsed.some(
				(row) =>
					row.verse_start != null &&
					row.bible_book !== 'Psalms' &&
					row.verse_start > 100
			)
		) {
			continue;
		}
		linesOut.push(block.correctedLine);
		allRows.push(...parsed);
		const pageRows = rowsByPrinted.get(block.printedPage) ?? [];
		pageRows.push(...parsed);
		rowsByPrinted.set(block.printedPage, pageRows);
		const pageLines = linesByPrinted.get(block.printedPage) ?? [];
		pageLines.push(block.correctedLine);
		linesByPrinted.set(block.printedPage, pageLines);
	}

	const validateIssues = validateIndexRows(allRows);
	if (validateIssues.length > 0) {
		console.log(
			`validateIndexRows: ${validateIssues.length} issue(s) on full row set (not duplicated into review)`
		);
	}

	const correctedRaw = new Set(
		corrections.filter((c) => c.correctedLine && c.book).map((c) => `${c.printedPage}:${c.column}:${c.reason}`)
	);
	const reviewOut: string[] = [];
	for (const r of review) {
		if (correctedRaw.has(`${r.printedPage}:${r.column}:${r.reason}`)) continue;
		const pageLabel = r.printedPage > 0 ? `p.${r.printedPage}` : 'p.?';
		reviewOut.push(`# ${pageLabel} col ${r.column}`);
		reviewOut.push(`reason: ${r.reason}`);
		if (r.book) reviewOut.push(`book: ${r.book}`);
		reviewOut.push(r.raw);
		reviewOut.push('');
	}

	writeFileSync(linesPath, linesOut.join('\n') + '\n');
	writeFileSync(reviewPath, reviewOut.join('\n'));
	writeFileSync(rowsPath, JSON.stringify({ rows: allRows }, null, 2) + '\n');

	console.log(`Wrote ${linesOut.length} lines, ${allRows.length} rows, ${review.length} review items`);
	console.log(`  ${linesPath}`);
	console.log(`  ${reviewPath}`);
	console.log(`  ${rowsPath}`);

	compareGoldLeaves(rowsByPrinted, linesByPrinted);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
