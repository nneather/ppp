/**
 * Polymorphic `(book_id OR essay_id)` primitive.
 *
 * Four library tables enforce a CHECK that exactly one of `book_id` /
 * `essay_id` is non-null:
 *
 *   - scripture_references
 *   - book_topics
 *   - book_bible_coverage
 *   - book_ancient_coverage
 *
 * Per `.cursor/rules/library-module.mdc`: build ONE picker, ONE validator, ONE
 * insert helper. Reuse across all four tables. Do NOT invent four versions.
 *
 * The essay branch is gated behind FEATURE_ESSAYS_UI per the Session 2
 * decision (essay UI is post-fall per Tracker_1 PostBuild #1). The picker
 * compiles the essay branch but renders it disabled until the flag flips.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** When false, essay branches in pickers/forms render as disabled placeholders. */
export const FEATURE_ESSAYS_UI = false;

export type PolymorphicParent =
	| { kind: 'book'; book_id: string }
	| { kind: 'essay'; essay_id: string };

export type PolymorphicParentInput =
	| { kind: 'book'; book_id?: string | null }
	| { kind: 'essay'; essay_id?: string | null };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * App-layer XOR validator. Mirrors the schema CHECK on each of the four
 * polymorphic tables. Returns the narrowed `PolymorphicParent` on success.
 */
export function validateXor(input: PolymorphicParentInput): PolymorphicParent {
	if (input.kind === 'book') {
		const id = (input.book_id ?? '').trim();
		if (!UUID_RE.test(id)) throw new Error('PolymorphicParent: book_id is required and must be a UUID.');
		return { kind: 'book', book_id: id };
	}
	if (input.kind === 'essay') {
		if (!FEATURE_ESSAYS_UI) {
			throw new Error('PolymorphicParent: essay branch is disabled until FEATURE_ESSAYS_UI ships.');
		}
		const id = (input.essay_id ?? '').trim();
		if (!UUID_RE.test(id)) throw new Error('PolymorphicParent: essay_id is required and must be a UUID.');
		return { kind: 'essay', essay_id: id };
	}
	throw new Error('PolymorphicParent: kind must be "book" or "essay".');
}

/** Convert a validated PolymorphicParent into the `{ book_id, essay_id }` shape the DB rows use. */
export function polymorphicToColumns(parent: PolymorphicParent): {
	book_id: string | null;
	essay_id: string | null;
} {
	if (parent.kind === 'book') return { book_id: parent.book_id, essay_id: null };
	return { book_id: null, essay_id: parent.essay_id };
}

/**
 * Insert helper for any of the four polymorphic-bearing tables.
 *
 * Validates XOR at the app layer (so a friendly message comes back instead of
 * a CHECK violation), then forwards to supabase-js. The caller still has to
 * provide table-specific extras (page_start, topic, bible_book, etc.).
 *
 * Returns the inserted row id, or an error message.
 */
export async function insertPolymorphicRow<T extends Record<string, unknown>>(
	supabase: SupabaseClient,
	table:
		| 'scripture_references'
		| 'book_topics'
		| 'book_bible_coverage'
		| 'book_ancient_coverage',
	parent: PolymorphicParent,
	extras: T
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
	const cols = polymorphicToColumns(parent);
	const payload = { ...extras, ...cols };
	const { data, error } = await supabase
		.from(table)
		.insert(payload as never)
		.select('id')
		.single();
	if (error) {
		return { ok: false, message: error.message ?? `Insert into ${table} failed.` };
	}
	if (!data) {
		return { ok: false, message: `Insert into ${table} returned no row.` };
	}
	return { ok: true, id: (data as { id: string }).id };
}
