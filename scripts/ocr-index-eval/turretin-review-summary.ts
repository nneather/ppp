/**
 * Read-only summary of turretin.review.txt.
 *
 *   npm run turretin:review-summary
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReviewBlocks, summarizeReview } from './turretin-review.ts';

const here = dirname(fileURLToPath(import.meta.url));
const reviewPath = process.argv[2] ?? join(here, 'turretin.review.txt');

if (!existsSync(reviewPath)) {
	console.error(`Review file not found: ${reviewPath}`);
	process.exit(1);
}

const summary = summarizeReview(parseReviewBlocks(readFileSync(reviewPath, 'utf8')));

console.log(`file: ${reviewPath}`);
console.log(
	`blocks: ${summary.total} (open ${summary.open}, corrected ${summary.corrected}, skipped ${summary.skipped})`
);
console.log('by reason prefix:');
for (const [prefix, n] of Object.entries(summary.byReasonPrefix).sort((a, b) => b[1] - a[1])) {
	console.log(`  ${n}\t${prefix}`);
}
console.log('open by printed page:');
for (const [p, n] of Object.entries(summary.openByPrintedPage)
	.map(([page, count]) => [Number(page), count] as const)
	.sort((a, b) => b[1] - a[1] || a[0] - b[0])) {
	console.log(`  p.${p}: ${n}`);
}
const sample = summary.openBlocks.slice(0, 20);
if (sample.length) {
	console.log('first open raws:');
	for (const b of sample) {
		console.log(`  p.${b.printedPage} col ${b.column}: ${b.raw}`);
	}
	if (summary.openBlocks.length > 20) {
		console.log(`  … ${summary.openBlocks.length - 20} more`);
	}
}
