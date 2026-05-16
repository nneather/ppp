import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { PassageResult } from '$lib/types/library';

function parseIntOrNull(v: string | null): number | null {
	if (v == null || v.trim() === '') return null;
	const n = parseInt(v, 10);
	return Number.isFinite(n) ? n : null;
}

type RefRpcRow = {
	ref_id: string;
	book_id: string | null;
	essay_id: string | null;
	book_title: string | null;
	book_subtitle: string | null;
	bible_book: string;
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
	page_start: string;
	page_end: string | null;
	confidence_score: number | null;
	needs_review: boolean;
	review_note: string | null;
	manual_entry: boolean;
};

type CoverageRow = {
	id: string;
	book_id: string;
	bible_book: string;
	books:
		| { id: string; title: string | null; subtitle: string | null; deleted_at: string | null }
		| { id: string; title: string | null; subtitle: string | null; deleted_at: string | null }[]
		| null;
};

export const load: PageServerLoad = async ({ url, locals, parent }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');

	const supabase = locals.supabase;
	const { bibleBookNames } = await parent();

	const bibleBookParam = url.searchParams.get('bible_book');
	const bible_book =
		bibleBookParam && bibleBookNames.includes(bibleBookParam) ? bibleBookParam : null;
	const chapter = parseIntOrNull(url.searchParams.get('chapter'));
	const verse = parseIntOrNull(url.searchParams.get('verse'));

	let results: PassageResult[] = [];
	let queryError: string | null = null;

	if (bible_book) {
		// Parallel: scripture_references overlap via RPC + book_bible_coverage
		// for the same bible_book. Session 5 Track D — app-layer merge keeps
		// the schema untouched; promote to a SQL UNION if another module needs
		// coverage-aware search.
		const [refsRes, covRes] = await Promise.all([
			supabase.rpc('search_scripture_refs', {
				p_bible_book: bible_book,
				p_chapter: chapter ?? undefined,
				p_verse: verse ?? undefined
			}),
			supabase
				.from('book_bible_coverage')
				.select(
					'id, book_id, bible_book, books!inner ( id, title, subtitle, deleted_at )'
				)
				.eq('bible_book', bible_book)
		]);

		if (refsRes.error) {
			console.error('[search-passage] rpc error', refsRes.error);
			queryError = refsRes.error.message;
		}
		if (covRes.error) {
			console.error('[search-passage] coverage error', covRes.error);
			// Non-fatal: coverage is additive. Keep refs if they worked.
			if (!queryError) queryError = covRes.error.message;
		}

		const refRows: PassageResult[] = ((refsRes.data ?? []) as RefRpcRow[]).map((r) => ({
			source_kind: 'ref' as const,
			ref_id: r.ref_id,
			book_id: r.book_id,
			essay_id: r.essay_id,
			book_title: r.book_title,
			book_subtitle: r.book_subtitle,
			bible_book: r.bible_book,
			chapter_start: r.chapter_start,
			verse_start: r.verse_start,
			chapter_end: r.chapter_end,
			verse_end: r.verse_end,
			page_start: r.page_start,
			page_end: r.page_end,
			confidence_score: r.confidence_score,
			needs_review: r.needs_review,
			review_note: r.review_note,
			manual_entry: r.manual_entry
		}));

		// Dedupe coverage rows against books that already appeared in the ref
		// hits (the specific entry is more useful than the blanket coverage).
		const refBookIds = new Set(refRows.map((r) => r.book_id).filter(Boolean) as string[]);

		const covRaw = (covRes.data ?? []) as unknown as CoverageRow[];
		const covRows: PassageResult[] = [];
		for (const raw of covRaw) {
			const b = Array.isArray(raw.books) ? raw.books[0] : raw.books;
			if (!b || b.deleted_at) continue;
			if (refBookIds.has(raw.book_id)) continue;
			covRows.push({
				source_kind: 'coverage' as const,
				ref_id: `cov-${raw.id}`,
				book_id: raw.book_id,
				essay_id: null,
				book_title: b.title ?? null,
				book_subtitle: b.subtitle ?? null,
				bible_book: raw.bible_book,
				chapter_start: null,
				verse_start: null,
				chapter_end: null,
				verse_end: null,
				page_start: null,
				page_end: null,
				confidence_score: null,
				needs_review: false,
				review_note: null,
				manual_entry: true
			});
		}

		// Sort coverage rows alphabetically by title for stability; refs keep
		// the RPC-side order (manual first, then confidence, then start).
		covRows.sort((a, b) =>
			(a.book_title ?? '').localeCompare(b.book_title ?? '')
		);

		results = [...refRows, ...covRows];
	}

	return {
		bibleBookNames,
		results,
		query: { bible_book, chapter, verse },
		queryError
	};
};
