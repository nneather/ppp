import type { SupabaseClient } from '@supabase/supabase-js';

export const ANCIENT_TEXT_ID_IN_CHUNK = 100;

/**
 * Count of `book_ancient_coverage` rows per `ancient_text_id`.
 */
export async function fetchCoverageCountsByAncientTextId(
	supabase: SupabaseClient,
	ancientTextIds: string[]
): Promise<{ map: Map<string, number>; error: string | null }> {
	const map = new Map<string, number>();
	if (ancientTextIds.length === 0) return { map, error: null };

	let error: string | null = null;

	for (let i = 0; i < ancientTextIds.length; i += ANCIENT_TEXT_ID_IN_CHUNK) {
		const chunk = ancientTextIds.slice(i, i + ANCIENT_TEXT_ID_IN_CHUNK);
		const { data, error: qErr } = await supabase
			.from('book_ancient_coverage')
			.select('ancient_text_id')
			.in('ancient_text_id', chunk);

		if (qErr) {
			console.error(qErr);
			error = qErr.message ?? 'Could not load coverage counts.';
			map.clear();
			break;
		}

		for (const row of data ?? []) {
			const aid = row.ancient_text_id as string;
			map.set(aid, (map.get(aid) ?? 0) + 1);
		}
	}

	return { map, error };
}
