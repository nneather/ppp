/**
 * Parse Turretin vol. 3 scripture index from the PDF text layer (FineReader).
 * No rasterize, no ocr_scripture_refs.
 *
 *   npx tsx scripts/ocr-index-eval/parse-turretin-text.ts [path-to.pdf]
 *   TURRETIN_PDF=/path/to.pdf npm run turretin:parse
 *
 * Outputs (gitignored): turretin.lines.txt, turretin.review.txt, turretin.rows.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { validateIndexRows } from '../../src/lib/library/scripture-index-validate.ts';
import { isApocryphaBook, validateApocryphaRows } from './turretin-apocrypha.ts';
import { compareGoldLeaves } from './turretin-gold.ts';
import {
	formatReviewFile,
	parseTurretinLines,
	type ParsedColumnLine
} from './turretin-parse-core.ts';
import { isOpenBlock, parseReviewBlocks, type ReviewBlock } from './turretin-review.ts';

const here = dirname(fileURLToPath(import.meta.url));

const DEFAULT_PDF =
	'/Users/Neal/Documents/ppp/PDFs for parsing/Institutes-of-Elenctic-Theology-Francis-Turretin-vol-3-scripture-index.pdf';

const PRINTED_FIRST = 739;
const COLUMN_ANCHORS = [130, 250, 360];

type TextItem = { str: string; x: number; y: number };

type ClusteredLine = {
	printedPage: number;
	column: number;
	y: number;
	text: string;
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

function clusterPageLines(items: TextItem[]): Omit<ClusteredLine, 'printedPage'>[] {
	const buckets = new Map<string, TextItem[]>();
	for (const item of items) {
		const col = columnForX(item.x);
		const yKey = Math.round(item.y / 3) * 3;
		const k = `${col}:${yKey}`;
		const list = buckets.get(k) ?? [];
		list.push(item);
		buckets.set(k, list);
	}
	const rows: Omit<ClusteredLine, 'printedPage'>[] = [];
	for (const [k, parts] of buckets) {
		const [colStr, yStr] = k.split(':');
		parts.sort((a, b) => a.x - b.x);
		const text = parts
			.map((p) => p.str)
			.join('')
			.replace(/\s+/g, ' ')
			.trim();
		if (!text) continue;
		rows.push({
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

function formatReviewPreservingResolved(
	openItems: ReturnType<typeof parseTurretinLines>['review'],
	prior: ReviewBlock[]
): string {
	const parts: string[] = [];
	// Keep prior corrected:/skip: blocks so re-parse stays stable.
	for (const b of prior) {
		if (isOpenBlock(b)) continue;
		if (!b.raw?.trim()) continue;
		if (!b.corrected?.trim() && !b.skip?.trim()) continue;
		parts.push(`# p.${b.printedPage} col ${b.column}`);
		if (b.reason) parts.push(`reason: ${b.reason}`);
		if (b.book) parts.push(`book: ${b.book}`);
		parts.push(b.raw);
		if (b.corrected?.trim()) parts.push(`corrected: ${b.corrected}`);
		if (b.skip?.trim()) parts.push(`skip: ${b.skip}`);
		parts.push('');
	}
	parts.push(formatReviewFile(openItems));
	return parts.join('\n').replace(/\n+$/, '\n');
}

async function main(): Promise<void> {
	const pdfPath = process.argv[2] ?? process.env.TURRETIN_PDF ?? DEFAULT_PDF;
	if (!existsSync(pdfPath)) {
		console.error(`PDF not found: ${pdfPath}`);
		process.exit(1);
	}

	const reviewPath = join(here, 'turretin.review.txt');
	const linesPath = join(here, 'turretin.lines.txt');
	const rowsPath = join(here, 'turretin.rows.json');

	const priorBlocks = existsSync(reviewPath)
		? parseReviewBlocks(readFileSync(reviewPath, 'utf8'))
		: [];

	const data = new Uint8Array(readFileSync(pdfPath));
	const doc = await getDocument({ data, useSystemFonts: true }).promise;
	const printedLast = PRINTED_FIRST + doc.numPages - 1;

	const ordered: ParsedColumnLine[] = [];

	for (let printed = PRINTED_FIRST; printed <= printedLast; printed += 1) {
		const items = await loadPageItems(doc, printed);
		const withPage = clusterPageLines(items).map((l) => ({
			...l,
			printedPage: printed
		}));

		const byColumn: ClusteredLine[][] = [[], [], []];
		for (const l of withPage) {
			byColumn[l.column - 1]?.push(l);
		}

		for (let col = 1; col <= 3; col += 1) {
			const colLines = (byColumn[col - 1] ?? []).sort(
				(a, b) => a.printedPage - b.printedPage || b.y - a.y
			);
			for (const l of colLines) {
				ordered.push({
					printedPage: l.printedPage,
					column: l.column,
					text: l.text
				});
			}
		}
	}

	const result = parseTurretinLines(ordered, {
		corrections: priorBlocks,
		sourceComment: [
			'# source: Turretin vol. 3 scripture index — PDF text layer extract',
			`# pdf: ${pdfPath}`
		].join('\n')
	});

	const canonRows = result.rows.filter((r) => !isApocryphaBook(r.bible_book));
	const apocRows = result.rows.filter((r) => isApocryphaBook(r.bible_book));
	const validateIssues = [
		...validateIndexRows(canonRows),
		...validateApocryphaRows(apocRows)
	];
	if (validateIssues.length > 0) {
		console.log(
			`full-set validators: ${validateIssues.length} issue(s) (not duplicated into review)`
		);
	}

	writeFileSync(linesPath, result.linesOut.join('\n') + '\n');
	writeFileSync(reviewPath, formatReviewPreservingResolved(result.review, priorBlocks));
	writeFileSync(rowsPath, JSON.stringify({ rows: result.rows }, null, 2) + '\n');

	console.log(
		`Wrote ${result.linesOut.length} lines, ${result.rows.length} rows, ${result.review.length} open review items` +
			(result.skipped.length ? `, ${result.skipped.length} skipped` : '')
	);
	console.log(`  ${linesPath}`);
	console.log(`  ${reviewPath}`);
	console.log(`  ${rowsPath}`);

	compareGoldLeaves(result.rowsByPrinted, { log: true });
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
