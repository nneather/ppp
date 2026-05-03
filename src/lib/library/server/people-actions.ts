import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * People helpers — shared between the form-side `createPerson` action in
 * `book-actions.ts` and the Pass 1 / Pass 2 importer in
 * `scripts/library-import/importLibrary.ts`. Lifting `findOrCreatePerson`
 * out of `book-actions.ts` is the decision-007 surprise: keep B14 dedup logic
 * in one place so the importer doesn't drift from the form.
 *
 * B14 = "person dedup hint" pattern from the Session 0 audit. Match by:
 *   normalized last_name + first-initial + middle-initial
 * If a confident match is found, return that person's id. Otherwise INSERT a
 * new row.
 *
 * NOTE: this is a fail-open reconcile. The form-side `<PersonAutocomplete>`
 * surfaces an inline warning when a near-match exists; the importer just picks
 * the existing row silently when the match is unambiguous (last_name +
 * first_initial + middle_initial all match), and creates new otherwise. The
 * Session 7 people-merge UI is the manual cleanup path for any false negatives.
 */

export type PersonInput = {
	last_name: string;
	first_name?: string | null;
	middle_name?: string | null;
	suffix?: string | null;
};

export type FindOrCreateResult = {
	personId: string;
	created: boolean;
};

/**
 * Lower + collapse-whitespace + strip diacritics for fuzzy comparison. The
 * source spreadsheet has names like "à Kempis, Thomas" and "Köstenberger,
 * Andreas" — diacritic-fold so they collide cleanly with later edits.
 */
function normalizeName(s: string | null | undefined): string {
	if (!s) return '';
	return s
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.trim()
		.replace(/\s+/g, ' ');
}

function firstInitial(s: string | null | undefined): string {
	const n = normalizeName(s);
	return n.length > 0 ? n.charAt(0) : '';
}

/**
 * Find an existing person via B14 dedup (last_name normalized + first_initial
 * + middle_initial). If none, INSERT and return the new id. The createdBy is
 * stamped onto INSERTs only — never UPDATE.
 */
export async function findOrCreatePerson(
	supabase: SupabaseClient,
	input: PersonInput,
	createdBy: string
): Promise<FindOrCreateResult> {
	const last = input.last_name?.trim();
	if (!last) throw new Error('findOrCreatePerson: last_name is required');

	const targetLastNorm = normalizeName(last);
	const targetFirstInit = firstInitial(input.first_name);
	const targetMiddleInit = firstInitial(input.middle_name);

	// Pull all candidates with a matching normalized last_name. The dataset is
	// small (~few thousand people end-state) so a single SELECT + in-process
	// filter is cheaper than building a server-side normalize() function.
	const { data, error } = await supabase
		.from('people')
		.select('id, first_name, middle_name, last_name, suffix')
		.is('deleted_at', null);
	if (error) throw error;

	for (const row of data ?? []) {
		const r = row as {
			id: string;
			first_name: string | null;
			middle_name: string | null;
			last_name: string;
			suffix: string | null;
		};
		if (normalizeName(r.last_name) !== targetLastNorm) continue;
		if (firstInitial(r.first_name) !== targetFirstInit) continue;
		// Middle-initial match is permissive: if EITHER side has no middle, skip
		// the middle check (the spreadsheet often omits middles where the form
		// recorded them, and vice versa).
		const rMid = firstInitial(r.middle_name);
		if (rMid && targetMiddleInit && rMid !== targetMiddleInit) continue;
		return { personId: r.id, created: false };
	}

	const insertPayload = {
		last_name: last,
		first_name: input.first_name?.trim() || null,
		middle_name: input.middle_name?.trim() || null,
		suffix: input.suffix?.trim() || null,
		created_by: createdBy
	};
	const { data: inserted, error: insErr } = await supabase
		.from('people')
		.insert(insertPayload as never)
		.select('id')
		.single();
	if (insErr || !inserted) {
		throw insErr ?? new Error('findOrCreatePerson: insert returned no row');
	}
	return { personId: (inserted as { id: string }).id, created: true };
}

/**
 * Parse a typed name into structured `{first, middle, last, suffix}` parts.
 * Mirrors the `parseTypedName` shape from `<PersonAutocomplete>` (Session
 * 1.5f) so the importer and the form share the same parser.
 *
 * Supported shapes:
 *   "Smith"                         → { last: 'Smith' }
 *   "John Smith"                    → { first: 'John', last: 'Smith' }
 *   "John Q. Smith"                 → { first: 'John', middle: 'Q', last: 'Smith' }
 *   "Smith, John"                   → { last: 'Smith', first: 'John' }
 *   "Smith, John Q."                → { last: 'Smith', first: 'John', middle: 'Q' }
 *   "John Smith Jr."                → { first: 'John', last: 'Smith', suffix: 'Jr.' }
 *   "Smith, John Q., Jr."           → { last: 'Smith', first: 'John', middle: 'Q', suffix: 'Jr.' }
 *   "à Kempis, Thomas"              → { last: 'à Kempis', first: 'Thomas' }
 *   "Wray Beal, Lissa M."           → { last: 'Wray Beal', first: 'Lissa', middle: 'M' }
 *   "F. F. Bruce"                   → { first: 'F.', middle: 'F.', last: 'Bruce' }
 */
export function parseTypedName(raw: string): PersonInput | null {
	const t = raw?.trim();
	if (!t) return null;

	const SUFFIX_RE = /^(Jr\.?|Sr\.?|II|III|IV|V|VI|VII|VIII|IX|X)$/i;

	// Comma-flip form: "Last, First [Middle] [Suffix]" or "Last, First Middle, Suffix"
	if (t.includes(',')) {
		const parts = t.split(',').map((s) => s.trim()).filter(Boolean);
		const last = parts[0] ?? '';
		const rest = parts.slice(1).join(' ').trim();
		if (!last) return null;

		// Detect trailing suffix: "Last, First Middle, Jr." or "Last, First Jr."
		const restTokens = rest.split(/\s+/).filter(Boolean);
		let suffix: string | null = null;
		if (restTokens.length > 0 && SUFFIX_RE.test(restTokens[restTokens.length - 1])) {
			suffix = restTokens.pop() as string;
		}

		const first = restTokens[0] ?? null;
		const middle = restTokens.length > 1 ? restTokens.slice(1).join(' ') : null;

		return {
			last_name: last,
			first_name: first || null,
			middle_name: middle || null,
			suffix
		};
	}

	// Western form: "First [Middle] Last [Suffix]"
	const tokens = t.split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return null;
	if (tokens.length === 1) return { last_name: tokens[0] };

	let suffix: string | null = null;
	if (SUFFIX_RE.test(tokens[tokens.length - 1])) {
		suffix = tokens.pop() as string;
	}

	if (tokens.length === 1) return { last_name: tokens[0], suffix };
	const last = tokens[tokens.length - 1];
	const first = tokens[0];
	const middle = tokens.length > 2 ? tokens.slice(1, -1).join(' ') : null;
	return {
		last_name: last,
		first_name: first || null,
		middle_name: middle || null,
		suffix
	};
}

/** Bucketing key for B14-style duplicate hints (normalized last + first initial). */
export function b14BucketKey(p: { last_name: string; first_name?: string | null }): string {
	return `${normalizeName(p.last_name)}|${firstInitial(p.first_name)}`;
}

/** Same middle-initial permissive rule as `findOrCreatePerson` when comparing two rows. */
export function b14PairMayBeDuplicate(
	a: { last_name: string; first_name?: string | null; middle_name?: string | null },
	b: { last_name: string; first_name?: string | null; middle_name?: string | null }
): boolean {
	if (normalizeName(a.last_name) !== normalizeName(b.last_name)) return false;
	if (firstInitial(a.first_name) !== firstInitial(b.first_name)) return false;
	const aMid = firstInitial(a.middle_name);
	const bMid = firstInitial(b.middle_name);
	if (aMid && bMid && aMid !== bMid) return false;
	return true;
}

export type B14MergePair<T> = { a: T; b: T; pairKey: string };

/**
 * Suggest unordered person pairs that would collide under B14 (same bucket + compatible middles).
 * Used by `/settings/library/people/merge` — O(n) per bucket, not all-pairs across the whole list.
 */
export function suggestB14MergePairs<
	T extends {
		id: string;
		last_name: string;
		first_name?: string | null;
		middle_name?: string | null;
	}
>(people: T[]): B14MergePair<T>[] {
	const buckets = new Map<string, T[]>();
	for (const p of people) {
		const k = b14BucketKey(p);
		if (!buckets.has(k)) buckets.set(k, []);
		buckets.get(k)!.push(p);
	}
	const out: B14MergePair<T>[] = [];
	const seen = new Set<string>();
	for (const group of buckets.values()) {
		if (group.length < 2) continue;
		for (let i = 0; i < group.length; i++) {
			for (let j = i + 1; j < group.length; j++) {
				const a = group[i];
				const b = group[j];
				if (!b14PairMayBeDuplicate(a, b)) continue;
				const pairKey = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
				if (seen.has(pairKey)) continue;
				seen.add(pairKey);
				out.push({ a, b, pairKey });
			}
		}
	}
	return out;
}
