import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadBibleBookNames } from '$lib/library/server/loaders';
import type { PassageResult } from '$lib/types/library';

function parseIntOrNull(v: string | null): number | null {
	if (v == null || v.trim() === '') return null;
	const n = parseInt(v, 10);
	return Number.isFinite(n) ? n : null;
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;
	const bibleBookNames = await loadBibleBookNames(supabase);

	const bibleBookParam = url.searchParams.get('bible_book');
	const bible_book =
		bibleBookParam && bibleBookNames.includes(bibleBookParam) ? bibleBookParam : null;
	const chapter = parseIntOrNull(url.searchParams.get('chapter'));
	const verse = parseIntOrNull(url.searchParams.get('verse'));

	let results: PassageResult[] = [];
	let queryError: string | null = null;

	if (bible_book) {
		const { data, error } = await supabase.rpc('search_scripture_refs', {
			p_bible_book: bible_book,
			p_chapter: chapter ?? undefined,
			p_verse: verse ?? undefined
		});
		if (error) {
			console.error('[search-passage] rpc error', error);
			queryError = error.message;
		} else {
			results = (data ?? []) as PassageResult[];
		}
	}

	return {
		bibleBookNames,
		results,
		query: { bible_book, chapter, verse },
		queryError
	};
};
