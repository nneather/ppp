import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_CONCURRENCY = 8;

/**
 * Sign storage object paths with bounded parallelism so book-detail loads
 * do not fan out N simultaneous Storage API calls.
 */
export async function signStorageUrlsLimited(
	supabase: SupabaseClient,
	bucket: string,
	paths: (string | null | undefined)[],
	ttlSeconds: number,
	concurrency = DEFAULT_CONCURRENCY
): Promise<(string | null)[]> {
	const out: (string | null)[] = new Array(paths.length).fill(null);
	let next = 0;

	async function worker() {
		while (next < paths.length) {
			const i = next++;
			const path = paths[i];
			if (!path) continue;
			const { data, error } = await supabase.storage
				.from(bucket)
				.createSignedUrl(path, ttlSeconds);
			if (error) {
				console.error('[signStorageUrlsLimited]', error);
				continue;
			}
			out[i] = data?.signedUrl ?? null;
		}
	}

	const workers = Array.from({ length: Math.min(concurrency, paths.length) }, () => worker());
	await Promise.all(workers);
	return out;
}
