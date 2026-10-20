/**
 * Dedupe turretin.review.txt by page:col:raw (keeps best corrected/skip).
 *   npx tsx scripts/ocr-index-eval/turretin-prune-review.ts [--write]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	dedupeReviewBlocks,
	formatReviewBlock,
	parseReviewBlocks
} from './turretin-review.ts';

const here = dirname(fileURLToPath(import.meta.url));
const reviewPath = join(here, 'turretin.review.txt');

function main(): void {
	if (!existsSync(reviewPath)) {
		console.error(`Missing ${reviewPath}`);
		process.exit(1);
	}
	const write = process.argv.includes('--write');
	const before = parseReviewBlocks(readFileSync(reviewPath, 'utf8'));
	const after = dedupeReviewBlocks(before);
	console.log(`blocks: ${before.length} → ${after.length} (${before.length - after.length} removed)`);
	if (write) {
		writeFileSync(reviewPath, after.map(formatReviewBlock).join('\n').trimEnd() + '\n');
		console.log(`Wrote ${reviewPath}`);
	} else {
		console.log('Dry run — pass --write to update turretin.review.txt');
	}
}

main();
