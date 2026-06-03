import type { SupabaseClient } from '@supabase/supabase-js';

const SMOKE_TITLE_PREFIX = 'rls-smoke-';

/** Service-role cleanup of disposable smoke rows on staging. */
export async function cleanupSmokeRows(service: SupabaseClient): Promise<void> {
	const { data: books, error: listErr } = await service
		.from('books')
		.select('id, title')
		.like('title', `${SMOKE_TITLE_PREFIX}%`);

	if (listErr) {
		console.warn('cleanup: list books failed:', listErr.message);
		return;
	}
	const bookIds = (books ?? []).map((b) => b.id as string);
	if (bookIds.length === 0) return;

	for (const table of [
		'scripture_references',
		'book_authors',
		'book_topics',
		'book_bible_coverage',
		'book_ancient_coverage'
	] as const) {
		const { error } = await service.from(table).delete().in('book_id', bookIds);
		if (error) console.warn(`cleanup: ${table}:`, error.message);
	}

	const { error: delBooks } = await service.from('books').delete().in('id', bookIds);
	if (delBooks) console.warn('cleanup: books:', delBooks.message);

	const { data: people } = await service
		.from('people')
		.select('id')
		.like('last_name', `${SMOKE_TITLE_PREFIX}%`);
	const peopleIds = (people ?? []).map((p) => p.id as string);
	if (peopleIds.length > 0) {
		await service.from('book_authors').delete().in('person_id', peopleIds);
		await service.from('people').delete().in('id', peopleIds);
	}

	const { data: series } = await service
		.from('series')
		.select('id')
		.like('name', `${SMOKE_TITLE_PREFIX}%`);
	const seriesIds = (series ?? []).map((s) => s.id as string);
	if (seriesIds.length > 0) {
		await service.from('books').update({ series_id: null }).in('series_id', seriesIds);
		await service.from('series').delete().in('id', seriesIds);
	}
}

export function smokeTitle(suite: string): string {
	return `${SMOKE_TITLE_PREFIX}${suite}-${Date.now()}`;
}
