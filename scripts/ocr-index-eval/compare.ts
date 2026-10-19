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

type GoldFile = { id: string; source?: string; rows: Row[] };
type OcrFile = { candidates?: Row[]; rows?: Row[] };

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
const goldDir = join(here, 'gold');

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
	const gold = loadRows(join(goldDir, gf));
	const ocr = loadRows(ocrPath);
	const ocrKeys = new Set(ocr.map(key));
	let match = 0;
	const misses: string[] = [];
	for (const g of gold) {
		const k = key(g);
		if (ocrKeys.has(k)) match += 1;
		else misses.push(k);
	}
	const rate = gold.length === 0 ? 0 : match / gold.length;
	console.log(
		`${base}: ${match}/${gold.length} exact (${(rate * 100).toFixed(2)}%)${misses.length ? ` — ${misses.length} miss` : ''}`
	);
	if (misses.length > 0 && misses.length <= 15) {
		for (const m of misses) console.log(`  miss: ${m}`);
	}
	totalGold += gold.length;
	totalMatch += match;
	pagesCompared += 1;
}

if (pagesCompared === 0) {
	console.error('No OCR dumps paired with gold files.');
	process.exit(1);
}

const overall = totalGold === 0 ? 0 : totalMatch / totalGold;
console.log('---');
console.log(
	`overall: ${totalMatch}/${totalGold} exact (${(overall * 100).toFixed(3)}%) across ${pagesCompared} page(s)`
);
console.log(overall >= 0.995 ? 'GATE PASS (≥99.5%)' : 'GATE FAIL — iterate before bulk capture');
process.exit(overall >= 0.995 ? 0 : 2);
