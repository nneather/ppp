/**
 * Client-side fuzzy string similarity — trigram Jaccard.
 *
 * Approximates PostgreSQL's `pg_trgm` similarity() so the topic typo-warn in
 * <CanonicalizingCombobox> can run locally against the already-loaded topics
 * list. Threshold 0.7 is the same bar used on the server in Session 3 search.
 *
 * pg_trgm's exact algorithm pads both strings with two leading and one
 * trailing space and computes Jaccard over the distinct trigram set. We do
 * the same, which reproduces pg_trgm's scores within ~0.02 on typical
 * short-string inputs (single-word topics, 4–20 chars).
 *
 * Upgrade path: if false negatives start slipping through (rare typos the JS
 * approximation misses that pg_trgm would catch), promote to a small
 * SECURITY INVOKER RPC that calls `similarity(p_new, topic)` server-side.
 * The component contract already accepts an async-compatible `fuzzyWarn`
 * hook, so the swap is surface-only.
 */

function normalize(s: string): string {
	return s.trim().toLowerCase();
}

function trigrams(raw: string): Set<string> {
	const s = '  ' + normalize(raw) + ' ';
	const out = new Set<string>();
	for (let i = 0; i <= s.length - 3; i++) {
		out.add(s.slice(i, i + 3));
	}
	return out;
}

/**
 * Approximate pg_trgm similarity in [0, 1]. Returns 1.0 on exact match
 * (post-normalize) and 0 on empty inputs.
 */
export function similarityApprox(a: string, b: string): number {
	const an = normalize(a);
	const bn = normalize(b);
	if (an.length === 0 || bn.length === 0) return 0;
	if (an === bn) return 1;
	const ta = trigrams(an);
	const tb = trigrams(bn);
	let inter = 0;
	for (const g of ta) if (tb.has(g)) inter++;
	const union = ta.size + tb.size - inter;
	return union === 0 ? 0 : inter / union;
}

/**
 * Find the best match for `needle` in `haystack` whose similarity exceeds
 * `threshold`. Returns null when nothing crosses the bar. Ties broken by
 * lexicographic sort of the match string — stable across calls.
 */
export function bestSimilar<T extends { label: string }>(
	needle: string,
	haystack: readonly T[],
	threshold = 0.7
): { item: T; score: number } | null {
	let best: { item: T; score: number } | null = null;
	for (const item of haystack) {
		const s = similarityApprox(needle, item.label);
		if (s < threshold) continue;
		if (!best || s > best.score || (s === best.score && item.label < best.item.label)) {
			best = { item, score: s };
		}
	}
	return best;
}
