import type { SupabaseClient } from '@supabase/supabase-js';

/** Live books referencing each publisher (primary or reprint). */
export async function fetchLiveBookIdsByPublisherId(
	supabase: SupabaseClient,
	publisherIds: string[]
): Promise<{ map: Map<string, number>; error: string | null }> {
	const map = new Map<string, number>();
	if (publisherIds.length === 0) return { map, error: null };

	const { data, error } = await supabase
		.from('books')
		.select('publisher_id, reprint_publisher_id')
		.is('deleted_at', null)
		.eq('owned', true);

	if (error) {
		console.error(error);
		return { map, error: error.message ?? 'Could not load book counts.' };
	}

	for (const row of data ?? []) {
		const r = row as { publisher_id: string | null; reprint_publisher_id: string | null };
		if (r.publisher_id && publisherIds.includes(r.publisher_id)) {
			map.set(r.publisher_id, (map.get(r.publisher_id) ?? 0) + 1);
		}
		if (r.reprint_publisher_id && publisherIds.includes(r.reprint_publisher_id)) {
			map.set(
				r.reprint_publisher_id,
				(map.get(r.reprint_publisher_id) ?? 0) + 1
			);
		}
	}

	return { map, error: null };
}
