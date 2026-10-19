/**
 * Compare hand-transcribed gold JSON to OCR candidate dumps.
 * Usage: npx tsx scripts/ocr-index-eval/compare.ts
 *
 * Expects pairs: gold/page-NN.json + gold/page-NN.ocr.json
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

type Row = {
	bible_book: string;
	chapter_start?: number | null;
	verse_start?: number | null;
	chapter_end?: number | null;
	verse_end?: number | null;
	page_start?: string | null;
	page_end?: string | null;
	volume?: string | null;
};

type GoldFile = { id: string; source?: string; running_book?: string; rows: Row[] };
type OcrFile = { candidates?: Row[]; rows?: Row[] };

/** Fill a blank book from the running heading, the way the batch merge carries a book across a page that does not reprint it. */
function fillRunningBook(rows: Row[], runningBook: string): Row[] {
	let book = runningBook.trim();
	return rows.map((r) => {
		const named = r.bible_book?.trim() ?? '';
		if (named) {
			book = named;
			return r;
		}
		if (!book) return r;
		return { ...r, bible_book: book };
	});
}

function key(r: Row): string {
	return [
		r.bible_book?.trim() ?? '',
		r.chapter_start ?? '',
		r.verse_start ?? '',
		r.chapter_end ?? '',
		r.verse_end ?? '',
		(r.page_start ?? '').toString().trim(),
		(r.page_end ?? '').toString().trim(),
		(r.volume ?? '').toString().trim()
	].join('|');
}

function loadRows(path: string): Row[] {
	const raw = JSON.parse(readFileSync(path, 'utf8')) as GoldFile | OcrFile;
	if ('rows' in raw && Array.isArray(raw.rows)) return raw.rows;
	if ('candidates' in raw && Array.isArray(raw.candidates)) return raw.candidates;
	return [];
}

const here = dirname(fileURLToPath(import.meta.url));
const goldDir = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(here, 'gold');

if (!existsSync(goldDir)) {
	console.error('No gold/ directory yet. See README.md.');
	process.exit(1);
}

const goldFiles = readdirSync(goldDir)
	.filter((f) => /^page-\d+\.json$/.test(f))
	.sort();

if (goldFiles.length === 0) {
	console.error('No gold/page-NN.json files found. Transcribe 3 pages first.');
	process.exit(1);
}

let totalGold = 0;
let totalMatch = 0;
let pagesCompared = 0;

for (const gf of goldFiles) {
	const base = gf.replace(/\.json$/, '');
	const ocrPath = join(goldDir, `${base}.ocr.json`);
	if (!existsSync(ocrPath)) {
		console.warn(`skip ${gf}: missing ${base}.ocr.json`);
		continue;
	}
	const goldRaw = JSON.parse(readFileSync(join(goldDir, gf), 'utf8')) as GoldFile;
	const running = goldRaw.running_book ?? '';
	const gold = fillRunningBook(loadRows(join(goldDir, gf)), running);
	const ocr = fillRunningBook(loadRows(ocrPath), running);
	const ocrKeys = new Set(ocr.map(key));
	const goldKeys = new Set(gold.map(key));
	let match = 0;
	const misses: string[] = [];
	for (const g of gold) {
		const k = key(g);
		if (ocrKeys.has(k)) match += 1;
		else misses.push(k);
	}
	const extras = [...ocrKeys].filter((k) => !goldKeys.has(k));
	const rate = gold.length === 0 ? 0 : match / gold.length;
	console.log(
		`${base}: ${match}/${gold.length} exact (${(rate * 100).toFixed(2)}%)${misses.length ? ` — ${misses.length} miss` : ''}${extras.length ? `, ${extras.length} extra` : ''}`
	);
	for (const m of misses.slice(0, 40)) console.log(`  miss: ${m}`);
	if (misses.length > 40) console.log(`  … ${misses.length - 40} more misses`);
	for (const m of extras.slice(0, 20)) console.log(`  extra: ${m}`);
	if (extras.length > 20) console.log(`  … ${extras.length - 20} more extras`);
	totalGold += gold.length;
	totalMatch += match;
	pagesCompared += 1;
}

if (pagesCompared === 0) {
	console.error('No OCR dumps paired with gold files.');
	process.exit(1);
}

const overall = totalGold === 0 ? 0 : totalMatch / totalGold;
const practice = Boolean(process.argv[2]);
console.log('---');
console.log(
	`overall: ${totalMatch}/${totalGold} exact (${(overall * 100).toFixed(3)}%) across ${pagesCompared} page(s)`
);
if (practice) {
	console.log(
		overall >= 0.995
			? 'PRACTICE PASS — this directory is not the page-index bulk gate'
			: 'PRACTICE FAIL'
	);
} else {
	console.log(overall >= 0.995 ? 'GATE PASS (≥99.5%)' : 'GATE FAIL — iterate before bulk capture');
}
process.exit(overall >= 0.995 ? 0 : 2);
