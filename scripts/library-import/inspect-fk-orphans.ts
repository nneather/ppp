import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
config({ path: resolve(ROOT, '.env') });
config({ path: resolve(ROOT, '.env.local'), override: true });
const sb = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function fetchAll<T>(
	tableSelect: () => Promise<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
	// Helper unused; left for future. We paginate inline below.
	return [];
}
void fetchAll;

async function paginatedSelect(table: string, cols: string): Promise<Record<string, unknown>[]> {
	const out: Record<string, unknown>[] = [];
	let from = 0;
	const PAGE = 1000;
	while (true) {
		const { data, error } = await sb.from(table).select(cols).range(from, from + PAGE - 1);
		if (error) throw error;
		const batch = (data ?? []) as Record<string, unknown>[];
		out.push(...batch);
		if (batch.length < PAGE) break;
		from += PAGE;
	}
	return out;
}

async function main() {
	const allBookRows = (await paginatedSelect('books', 'id, deleted_at')) as { id: string; deleted_at: string | null }[];
	const allIds = new Set(allBookRows.map((r) => r.id));
	const liveIds = new Set(allBookRows.filter((r) => r.deleted_at === null).map((r) => r.id));
	const deletedIds = new Set(allBookRows.filter((r) => r.deleted_at !== null).map((r) => r.id));
	console.log('total books:', allIds.size, '(live', liveIds.size, '/ soft-deleted', deletedIds.size, ')');

	const ba = (await paginatedSelect('book_authors', 'book_id')) as { book_id: string }[];
	const baMissing = ba.filter((r) => !allIds.has(r.book_id));
	const baSoftDeleted = ba.filter((r) => deletedIds.has(r.book_id));
	console.log(
		'book_authors rows:', ba.length,
		' → missing book:', baMissing.length,
		' → soft-deleted book:', baSoftDeleted.length
	);

	const bc = (await paginatedSelect('book_categories', 'book_id')) as { book_id: string }[];
	const bcMissing = bc.filter((r) => !allIds.has(r.book_id));
	const bcSoftDeleted = bc.filter((r) => deletedIds.has(r.book_id));
	console.log(
		'book_categories rows:', bc.length,
		' → missing book:', bcMissing.length,
		' → soft-deleted book:', bcSoftDeleted.length
	);

	const bSeries = (await paginatedSelect('books', 'series_id')) as { series_id: string | null }[];
	const bsIds = new Set(bSeries.map((r) => r.series_id).filter((x): x is string => x != null));
	const liveSeries = (await paginatedSelect('series', 'id, deleted_at')) as {
		id: string;
		deleted_at: string | null;
	}[];
	const liveSeriesIds = new Set(liveSeries.filter((r) => r.deleted_at === null).map((r) => r.id));
	const seriesOrphans = [...bsIds].filter((id) => !liveSeriesIds.has(id));
	console.log('books → series_id (live) orphans:', seriesOrphans.length);

	const bCat = (await paginatedSelect('books', 'primary_category_id')) as {
		primary_category_id: string | null;
	}[];
	const bcatIds = new Set(
		bCat.map((r) => r.primary_category_id).filter((x): x is string => x != null)
	);
	const cats = (await paginatedSelect('categories', 'id')) as { id: string }[];
	const catIds = new Set(cats.map((r) => r.id));
	const catOrphans = [...bcatIds].filter((id) => !catIds.has(id));
	console.log('books → primary_category_id orphans:', catOrphans.length);
}
main().catch((e) => {
	console.error(e);
	process.exit(1);
});
