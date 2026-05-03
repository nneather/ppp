import type { SupabaseClient } from '@supabase/supabase-js';

/** Stay under PostgREST / proxy header limits (see people-settings-book-counts). */
export const SERIES_ID_IN_CHUNK = 100;

/**
 * Live book count per `series_id` (non-deleted books only).
 */
export async function fetchLiveBookCountsBySeriesId(
	supabase: SupabaseClient,
	seriesIds: string[]
): Promise<{ map: Map<string, number>; error: string | null }> {
	const map = new Map<string, number>();
	if (seriesIds.length === 0) return { map, error: null };

	let error: string | null = null;

	for (let i = 0; i < seriesIds.length; i += SERIES_ID_IN_CHUNK) {
		const chunk = seriesIds.slice(i, i + SERIES_ID_IN_CHUNK);
		const { data, error: qErr } = await supabase
			.from('books')
			.select('series_id')
			.is('deleted_at', null)
			.not('series_id', 'is', null)
			.in('series_id', chunk);

		if (qErr) {
			console.error(qErr);
			error = qErr.message ?? 'Could not load book counts.';
			map.clear();
			break;
		}

		for (const row of data ?? []) {
			const sid = row.series_id as string | null;
			if (!sid) continue;
			map.set(sid, (map.get(sid) ?? 0) + 1);
		}
	}

	return { map, error };
}
