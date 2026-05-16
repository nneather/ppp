/**
 * Shared person typeahead scoring: substring on name tokens + light fuzzy
 * (trigram Jaccard via `similarityApprox`) for typos. Middle names/initials
 * are omitted from the compact key so "John Doe" matches "John T. Doe".
 */

import { similarityApprox } from '$lib/library/fuzzy';
import { formatPersonFullName } from '$lib/library/match';
import type { PersonRow } from '$lib/types/library';

function normToken(s: string): string {
	return s
		.trim()
		.toLowerCase()
		.replace(/\s+/g, ' ');
}

/** First + last + suffix + aliases; middle omitted — fuzzy target. */
export function personSearchKey(p: PersonRow): string {
	const parts = [p.first_name, p.last_name, p.suffix, ...(p.aliases ?? [])]
		.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
		.map((x) => x.trim());
	return normToken(parts.join(' '));
}

function fullNameNoMiddle(p: PersonRow): string {
	const parts = [p.first_name, p.last_name, p.suffix]
		.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
		.map((x) => x.trim());
	return normToken(parts.join(' '));
}

function fullNameWithMiddle(p: PersonRow): string {
	return normToken(formatPersonFullName(p));
}

/** Haystack strings for substring matching. */
export function personSearchTokens(p: PersonRow): string[] {
	const last = normToken(p.last_name);
	const first = p.first_name ? normToken(p.first_name) : '';
	const noMid = fullNameNoMiddle(p);
	const withMid = fullNameWithMiddle(p);
	const out = new Set<string>();
	for (const t of [last, first, noMid, withMid, ...(p.aliases ?? []).map((a) => normToken(a))]) {
		if (t.length > 0) out.add(t);
	}
	return [...out];
}

const DEFAULT_FUZZY_MIN = 0.55;

export type ScorePersonMatchOpts = {
	/** Min similarity for fuzzy branch (q length >= 4). Default 0.55. */
	fuzzyMin?: number;
};

/**
 * Match score in [0, 1]. Higher = better. 0 = no match.
 * - Substring of any token → ~0.95, boosted when query is a prefix of last_name.
 * - Else if q.length >= 4, trigram similarity vs `personSearchKey` ≥ fuzzyMin.
 */
export function scorePersonMatch(
	q: string,
	p: PersonRow,
	opts?: ScorePersonMatchOpts
): number {
	const query = normToken(q);
	if (!query) return 0;

	const fuzzyMin = opts?.fuzzyMin ?? DEFAULT_FUZZY_MIN;
	const lastLower = normToken(p.last_name);

	for (const token of personSearchTokens(p)) {
		if (!token) continue;
		if (token.includes(query)) {
			let score = 0.95;
			if (lastLower.startsWith(query)) score = Math.min(1, score + 0.04);
			return score;
		}
	}

	if (query.length >= 4) {
		const sim = similarityApprox(query, personSearchKey(p));
		if (sim >= fuzzyMin) return sim;
	}

	return 0;
}

export function filterPeople(
	q: string,
	people: readonly PersonRow[],
	limit: number,
	opts?: ScorePersonMatchOpts
): PersonRow[] {
	const query = normToken(q);
	if (!query) return [...people].slice(0, limit);

	const scored = people
		.map((p) => ({ p, s: scorePersonMatch(query, p, opts) }))
		.filter((x) => x.s > 0)
		.sort((a, b) => b.s - a.s || a.p.last_name.localeCompare(b.p.last_name));

	const out: PersonRow[] = [];
	for (const { p } of scored) {
		out.push(p);
		if (out.length >= limit) break;
	}
	return out;
}
