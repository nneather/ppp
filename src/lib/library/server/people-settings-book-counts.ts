import type { SupabaseClient } from '@supabase/supabase-js';

/** Stay under PostgREST / proxy header limits (see library-module.mdc). */
export const PERSON_ID_IN_CHUNK = 100;

/**
 * Distinct live `book_id` per `person_id` via `book_authors` joined to non-deleted `books`.
 */
export async function fetchLiveBookIdsByPersonId(
	supabase: SupabaseClient,
	personIds: string[]
): Promise<{ map: Map<string, Set<string>>; error: string | null }> {
	const map = new Map<string, Set<string>>();
	if (personIds.length === 0) return { map, error: null };

	let error: string | null = null;

	for (let i = 0; i < personIds.length; i += PERSON_ID_IN_CHUNK) {
		const chunk = personIds.slice(i, i + PERSON_ID_IN_CHUNK);
		const { data, error: qErr } = await supabase
			.from('book_authors')
			.select('person_id, book_id, books!inner(deleted_at)')
			.is('books.deleted_at', null)
			.in('person_id', chunk);

		if (qErr) {
			console.error(qErr);
			error = qErr.message ?? 'Could not load book counts.';
			map.clear();
			break;
		}

		for (const row of data ?? []) {
			const pid = row.person_id as string;
			const bid = row.book_id as string;
			if (!map.has(pid)) map.set(pid, new Set());
			map.get(pid)!.add(bid);
		}
	}

	return { map, error };
}
