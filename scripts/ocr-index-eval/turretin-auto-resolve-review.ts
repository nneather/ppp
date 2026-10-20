/**
 * One-shot: suggest corrected:/skip: for open turretin.review.txt blocks.
 *   npx tsx scripts/ocr-index-eval/turretin-auto-resolve-review.ts [--write]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIndexEntry } from './parse-index-line.ts';
import { normalizeTurretinIndexLine } from './turretin-line-normalize.ts';
import { isApocryphaBook, validateApocryphaRows } from './turretin-apocrypha.ts';
import { validateIndexRows } from '../../src/lib/library/scripture-index-validate.ts';
import {
	formatReviewBlock,
	isOpenBlock,
	parseReviewBlocks,
	type ReviewBlock
} from './turretin-review.ts';
import { manualFixForBlock } from './turretin-manual-corrections.ts';

const here = dirname(fileURLToPath(import.meta.url));
const reviewPath = join(here, 'turretin.review.txt');

function shouldSkip(raw: string, reason: string): string | null {
	const t = raw.trim();
	if (/^index of/i.test(t) || /^index$/i.test(t)) return 'header fragment';
	if (/^cripture and a/i.test(t) || /^pocrypha$/i.test(t)) return 'header fragment';
	if (/^index$/i.test(t) || /INDEX$/i.test(t)) return 'running header';
	if (t === 'Index of S' || t.startsWith('Index of S')) return 'header fragment';
	if (/^book of/i.test(t)) return 'whole-book pointer';
	if (/^'/.test(t)) return 'OCR garbage';
	if (/^B:/i.test(t) || /^D:/i.test(t) || /^D9:/i.test(t)) return 'OCR letter for digit';
	if (/^Ill INDEX$/i.test(t)) return 'running header';
	if (/^l:?\d*ff/i.test(t)) return 'OCR l→1';
	if (/^12:lff/i.test(t)) return 'OCR l→1';
	if (/^B:32/i.test(t)) return 'OCR B→8';
	if (/^21:lfF/i.test(t)) return 'OCR l→1';
	if (reason.includes('entry before book heading') && t.length < 20) return 'header fragment';
	return null;
}

function tryCorrect(block: ReviewBlock): string | null {
	const book = block.book ?? '';
	if (!book) return null;
	const skip = shouldSkip(block.raw, block.reason);
	if (skip) return null;
	const norm = normalizeTurretinIndexLine(block.raw, book);
	try {
		const parsed = parseIndexEntry(norm, book);
		const issues = isApocryphaBook(book)
			? validateApocryphaRows(parsed).filter((i) => i.reason !== 'short_page_among_longer')
			: validateIndexRows(parsed).filter((i) => i.reason !== 'short_page_among_longer');
		if (issues.length) return null;
		for (const row of parsed) {
			const vs = row.verse_start;
			if (vs != null && row.bible_book !== 'Psalms' && vs > 100) return null;
		}
		return norm;
	} catch {
		return null;
	}
}

function main(): void {
	if (!existsSync(reviewPath)) {
		console.error(`Missing ${reviewPath}`);
		process.exit(1);
	}
	const write = process.argv.includes('--write');
	const blocks = parseReviewBlocks(readFileSync(reviewPath, 'utf8'));
	let corrected = 0;
	let skipped = 0;
	let stillOpen = 0;

	const out: string[] = [];
	for (const block of blocks) {
		if (!isOpenBlock(block)) {
			out.push(formatReviewBlock(block));
			continue;
		}
		const manual = manualFixForBlock(block);
		if (manual.skip) {
			block.skip = manual.skip;
			skipped++;
		} else if (manual.corrected) {
			block.corrected = manual.corrected;
			corrected++;
		} else {
		const skipWhy = shouldSkip(block.raw, block.reason);
		if (skipWhy) {
			block.skip = skipWhy;
			skipped++;
		} else {
			const line = tryCorrect(block);
			if (line) {
				block.corrected = line;
				corrected++;
			} else {
				stillOpen++;
			}
		}
		}
		out.push(formatReviewBlock(block));
	}

	console.log(`resolved: ${corrected} corrected, ${skipped} skipped, ${stillOpen} still open`);
	if (write) {
		writeFileSync(reviewPath, out.join('\n').trimEnd() + '\n');
		console.log(`Wrote ${reviewPath}`);
	} else {
		console.log('Dry run — pass --write to update turretin.review.txt');
	}
}

main();
