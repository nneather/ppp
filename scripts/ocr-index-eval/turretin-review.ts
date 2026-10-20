/**
 * Parse and summarize turretin.review.txt blocks.
 *
 * Block shape:
 *   # p.NNN col N
 *   reason: …
 *   book: …
 *   <raw line>
 *   corrected: <fixed line>   — optional; re-parse applies in place
 *   skip: <why>               — optional; drop noise without a corrected line
 */

export type ReviewBlock = {
	printedPage: number;
	column: number;
	reason: string;
	book?: string;
	raw?: string;
	corrected?: string;
	skip?: string;
};

export function blockKey(b: Pick<ReviewBlock, 'printedPage' | 'column' | 'raw'>): string {
	return `${b.printedPage}:${b.column}:${b.raw ?? ''}`;
}

export function isOpenBlock(b: ReviewBlock): boolean {
	if (!b.raw?.trim()) return false;
	if (b.corrected?.trim()) return false;
	if (b.skip?.trim()) return false;
	return true;
}

export function reasonPrefix(reason: string): string {
	const t = reason.trim();
	const colon = t.indexOf(':');
	if (colon <= 0) return t;
	return t.slice(0, colon).trim();
}

export function parseReviewBlocks(text: string): ReviewBlock[] {
	const blocks: ReviewBlock[] = [];
	let current: ReviewBlock | null = null;

	for (const raw of text.split('\n')) {
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
			current.corrected = line.slice('corrected:'.length).trim();
			continue;
		}
		if (line.startsWith('skip:')) {
			current.skip = line.slice('skip:'.length).trim();
			continue;
		}
		if (!line.trim() || line.startsWith('#')) continue;
		if (!current.raw) current.raw = line.trim();
		else if (!current.corrected && line.trim() !== current.raw) {
			// Legacy second-line-as-correction (pre-corrected: directive).
			current.corrected = line.trim();
		}
	}
	if (current) blocks.push(current);
	return blocks;
}

export type ReviewSummary = {
	total: number;
	open: number;
	corrected: number;
	skipped: number;
	byReasonPrefix: Record<string, number>;
	openByPrintedPage: Record<number, number>;
	openBlocks: ReviewBlock[];
};

export function summarizeReview(blocks: ReviewBlock[]): ReviewSummary {
	const byReasonPrefix: Record<string, number> = {};
	const openByPrintedPage: Record<number, number> = {};
	const openBlocks: ReviewBlock[] = [];
	let corrected = 0;
	let skipped = 0;

	for (const b of blocks) {
		const prefix = reasonPrefix(b.reason || '(no reason)');
		byReasonPrefix[prefix] = (byReasonPrefix[prefix] ?? 0) + 1;

		if (b.corrected?.trim()) {
			corrected += 1;
			continue;
		}
		if (b.skip?.trim()) {
			skipped += 1;
			continue;
		}
		if (!b.raw?.trim()) continue;
		openBlocks.push(b);
		openByPrintedPage[b.printedPage] = (openByPrintedPage[b.printedPage] ?? 0) + 1;
	}

	return {
		total: blocks.length,
		open: openBlocks.length,
		corrected,
		skipped,
		byReasonPrefix,
		openByPrintedPage,
		openBlocks
	};
}

/** Corrections usable by the parser: must have book + corrected line. */
export function correctionsFromBlocks(blocks: ReviewBlock[]): ReviewBlock[] {
	return blocks.filter((b) => b.corrected?.trim() && b.book?.trim() && b.raw?.trim());
}

/** Skip directives keyed by page:col:raw. */
export function skipKeysFromBlocks(blocks: ReviewBlock[]): Set<string> {
	const keys = new Set<string>();
	for (const b of blocks) {
		if (b.skip?.trim() && b.raw?.trim()) keys.add(blockKey(b));
	}
	return keys;
}
