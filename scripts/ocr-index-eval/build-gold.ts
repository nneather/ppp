/**
 * Build gold/page-0N.json from the hand transcription in gold/page-0N.lines.txt.
 *
 *   npx tsx scripts/ocr-index-eval/build-gold.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIndexEntry, type IndexGoldRow } from './parse-index-line.ts';

const goldDir = join(dirname(fileURLToPath(import.meta.url)), 'gold');

function build(name: string): void {
	const text = readFileSync(join(goldDir, name), 'utf8');
	let source = '';
	let runningBook = '';
	let book = '';
	const rows: IndexGoldRow[] = [];
	let prevChapter = 0;
	for (const raw of text.split('\n')) {
		const line = raw.trim();
		if (!line) continue;
		if (line.startsWith('# source:')) {
			source = line.slice('# source:'.length).trim();
			continue;
		}
		if (line.startsWith('# running_book:')) {
			runningBook = line.slice('# running_book:'.length).trim();
			book = runningBook;
			prevChapter = 0;
			continue;
		}
		if (line.startsWith('# book ')) {
			book = line.slice('# book '.length).trim();
			prevChapter = 0;
			continue;
		}
		if (line.startsWith('#')) continue;
		if (!book) throw new Error(`${name}: entry before a book heading: ${line}`);
		const parsed = parseIndexEntry(line, book);
		const chapter = parsed[0]?.chapter_start ?? 0;
		if (chapter < prevChapter) {
			throw new Error(`${name}: chapter went backwards (${prevChapter} → ${chapter}) at ${line}`);
		}
		prevChapter = chapter;
		rows.push(...parsed);
	}
	const id = name.replace(/\.lines\.txt$/, '');
	const out = {
		id,
		source,
		running_book: runningBook,
		rows
	};
	writeFileSync(join(goldDir, `${id}.json`), JSON.stringify(out, null, 2) + '\n');
	console.log(`${id}: ${rows.length} rows (running ${runningBook})`);
}

const files = readdirSync(goldDir)
	.filter((f) => /^page-\d+\.lines\.txt$/.test(f))
	.sort();
if (files.length === 0) {
	console.error('No gold/page-NN.lines.txt files.');
	process.exit(1);
}
for (const f of files) build(f);
