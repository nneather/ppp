/**
 * Two-pass OCR consensus for scripture-index mode ([252]).
 * Exact-match rows pass; disagreements are flagged for review.
 */

import type { OcrScriptureCandidate } from '$lib/library/ocr-scripture-refs';

export type ConsensusRow = OcrScriptureCandidate & {
	/** Set when the two passes disagreed on this row. */
	consensus_flag?: 'ok' | 'disagree' | 'pass_a_only' | 'pass_b_only';
};

function canonicalKey(c: OcrScriptureCandidate): string {
	return [
		c.bible_book.trim(),
		c.chapter_start ?? '',
		c.verse_start ?? '',
		c.chapter_end ?? '',
		c.verse_end ?? '',
		(c.page_start ?? '').trim(),
		(c.page_end ?? '').trim(),
		(c.volume ?? '').trim()
	].join('|');
}

/**
 * Merge two OCR passes. Rows present in both with identical keys pass.
 * Rows only in one pass, or with mismatched sibling ordering, are flagged.
 */
export function mergeOcrConsensus(
	passA: OcrScriptureCandidate[],
	passB: OcrScriptureCandidate[]
): ConsensusRow[] {
	const mapB = new Map<string, OcrScriptureCandidate>();
	for (const c of passB) mapB.set(canonicalKey(c), c);

	const usedB = new Set<string>();
	const out: ConsensusRow[] = [];

	for (const a of passA) {
		const key = canonicalKey(a);
		const b = mapB.get(key);
		if (b) {
			usedB.add(key);
			out.push({
				...a,
				confidence_score: Math.min(a.confidence_score, b.confidence_score),
				consensus_flag: 'ok'
			});
		} else {
			out.push({
				...a,
				confidence_score: Math.min(a.confidence_score, 0.75),
				consensus_flag: 'pass_a_only'
			});
		}
	}

	for (const b of passB) {
		const key = canonicalKey(b);
		if (usedB.has(key)) continue;
		out.push({
			...b,
			confidence_score: Math.min(b.confidence_score, 0.75),
			consensus_flag: 'pass_b_only'
		});
	}

	return out;
}

/** True when every consensus row agreed on both passes. */
export function consensusAllOk(rows: ConsensusRow[]): boolean {
	return rows.length > 0 && rows.every((r) => r.consensus_flag === 'ok');
}
