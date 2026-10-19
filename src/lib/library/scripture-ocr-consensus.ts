/**
 * Two-pass OCR consensus for scripture-index mode ([252]).
 * Exact-match rows pass; disagreements are flagged for review.
 */

import type { OcrScriptureCandidate } from '$lib/library/ocr-scripture-refs';

export type ConsensusRow = OcrScriptureCandidate & {
	/**
	 * `ok` — writer and checker share this pointer.
	 * `checker_mismatch` — writer row the checker did not confirm. A same-verse
	 * alternate from the checker is on `review_note`, not a second row.
	 * `checker_only` — pointer only the checker saw, for a verse the writer missed.
	 * `pass_a_only` / `pass_b_only` — older same-model merge.
	 */
	consensus_flag?: 'ok' | 'disagree' | 'pass_a_only' | 'pass_b_only' | 'checker_mismatch' | 'checker_only';
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
		(c.volume ?? '').trim(),
		(c.review_note ?? '').trim()
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
	const buckets = new Map<string, OcrScriptureCandidate[]>();
	for (const c of passB) {
		const key = canonicalKey(c);
		const list = buckets.get(key) ?? [];
		list.push(c);
		buckets.set(key, list);
	}

	const out: ConsensusRow[] = [];

	for (const a of passA) {
		const key = canonicalKey(a);
		const list = buckets.get(key);
		const b = list?.shift();
		if (b) {
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

	for (const list of buckets.values()) {
		for (const b of list) {
			out.push({
				...b,
				confidence_score: Math.min(b.confidence_score, 0.75),
				consensus_flag: 'pass_b_only'
			});
		}
	}

	return out;
}

/** Pointer identity. Book name is the writer's; the checker is not trusted for it. */
function pointerKey(c: OcrScriptureCandidate): string {
	return [
		c.chapter_start ?? '',
		c.verse_start ?? '',
		c.chapter_end ?? '',
		c.verse_end ?? '',
		(c.page_start ?? '').trim(),
		(c.page_end ?? '').trim(),
		(c.volume ?? '').trim()
	].join('|');
}

function verseIdentity(c: OcrScriptureCandidate): string {
	return [c.chapter_start ?? '', c.verse_start ?? '', c.chapter_end ?? '', c.verse_end ?? ''].join('|');
}

function formatCheckerPointer(c: OcrScriptureCandidate): string {
	const page = (c.page_start ?? '').trim();
	const end = (c.page_end ?? '').trim();
	const token = end ? `${page}-${end}` : page;
	const vol = (c.volume ?? '').trim();
	return vol ? `${vol}:${token}` : token;
}

/**
 * Index-mode merge. Pass A is the writer (Sonnet 4.6). Pass B is the checker
 * (Sonnet 5.5). Agreement is on the page pointer, not the book name.
 * A disagreed digit stays one writer row, with the checker's pointer in the note.
 * A verse only the checker saw is kept once, book blank, so the running-book carry applies.
 */
export function mergeIndexChecker(
	writer: OcrScriptureCandidate[],
	checker: OcrScriptureCandidate[]
): ConsensusRow[] {
	const buckets = new Map<string, OcrScriptureCandidate[]>();
	for (const c of checker) {
		const key = pointerKey(c);
		const list = buckets.get(key) ?? [];
		list.push(c);
		buckets.set(key, list);
	}

	const out: ConsensusRow[] = [];
	const unmatchedWriter = new Map<string, ConsensusRow[]>();

	for (const a of writer) {
		const list = buckets.get(pointerKey(a));
		const hit = list?.shift();
		if (hit) {
			out.push({
				...a,
				confidence_score: Math.min(a.confidence_score, hit.confidence_score),
				consensus_flag: 'ok'
			});
			continue;
		}
		const row: ConsensusRow = {
			...a,
			confidence_score: Math.min(a.confidence_score, 0.75),
			consensus_flag: 'checker_mismatch'
		};
		out.push(row);
		const verse = verseIdentity(a);
		const group = unmatchedWriter.get(verse) ?? [];
		group.push(row);
		unmatchedWriter.set(verse, group);
	}

	const leftoverByVerse = new Map<string, OcrScriptureCandidate[]>();
	for (const list of buckets.values()) {
		for (const b of list) {
			const verse = verseIdentity(b);
			const group = leftoverByVerse.get(verse) ?? [];
			group.push(b);
			leftoverByVerse.set(verse, group);
		}
	}

	for (const [verse, leftovers] of leftoverByVerse) {
		const writers = unmatchedWriter.get(verse);
		if (writers && writers.length > 0) {
			const note = `checker ${leftovers.map(formatCheckerPointer).join(', ')}`;
			for (const w of writers) {
				w.review_note = w.review_note?.trim() ? `${w.review_note}; ${note}` : note;
			}
			continue;
		}
		for (const b of leftovers) {
			out.push({
				...b,
				bible_book: '',
				continuation_from_previous_page: true,
				confidence_score: Math.min(b.confidence_score, 0.75),
				consensus_flag: 'checker_only'
			});
		}
	}

	return out;
}

/** True when every consensus row agreed on both passes. */
export function consensusAllOk(rows: ConsensusRow[]): boolean {
	return rows.length > 0 && rows.every((r) => r.consensus_flag === 'ok');
}
