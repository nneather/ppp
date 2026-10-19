import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { PassageResult } from '$lib/types/library';
import { assignPassageBands } from '$lib/library/passage-search-bands';
import { loadPassageSectionsOverlapping } from '$lib/library/server/loaders';

function parseIntOrNull(v: string | null): number | null {
	if (v == null || v.trim() === '') return null;
	const n = parseInt(v, 10);
	return Number.isFinite(n) ? n : null;
}

/** Allow only same-origin relative paths we deep-link from. */
function parseReturnTo(raw: string | null): string | null {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
	if (raw === '/sermons' || raw.startsWith('/sermons?')) return raw;
	if (raw === '/sermons/by-book' || raw.startsWith('/sermons/by-book?')) return raw;
	if (raw === '/studies/sermons' || raw.startsWith('/studies/sermons?')) return raw;
	if (raw === '/studies/by-book' || raw.startsWith('/studies/by-book?')) return raw;
	if (raw === '/library' || raw.startsWith('/library?')) return raw;
	return null;
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
		| {
				id: string;
				title: string | null;
				subtitle: string | null;
				genre: string | null;
				deleted_at: string | null;
		  }
		| {
				id: string;
				title: string | null;
				subtitle: string | null;
				genre: string | null;
				deleted_at: string | null;
		  }[]
		| null;
};

function asResult(
	partial: Omit<PassageResult, 'section_label' | 'manual_entry'> &
		Partial<Pick<PassageResult, 'section_label' | 'manual_entry'>>
): PassageResult {
	return {
		...partial,
		section_label: partial.section_label ?? null,
		manual_entry: partial.manual_entry ?? true
	};
}

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
	const chapter_end = parseIntOrNull(url.searchParams.get('chapter_end'));
	const verse_end = parseIntOrNull(url.searchParams.get('verse_end'));
	const returnTo = parseReturnTo(url.searchParams.get('returnTo'));

	let results: PassageResult[] = [];
	let queryError: string | null = null;

	if (bible_book) {
		// Parallel: scripture index RPC + bible coverage + passage sections.
		// App-layer merge ([249]); documented third round trip (same class as
		// prior coverage merge).
		const [refsRes, covRes, sections] = await Promise.all([
			supabase.rpc('search_scripture_refs', {
				p_bible_book: bible_book,
				p_chapter: chapter ?? undefined,
				p_verse: verse ?? undefined,
				p_chapter_end: chapter_end ?? undefined,
				p_verse_end: verse_end ?? undefined
			}),
			supabase
				.from('book_bible_coverage')
				.select(
					'id, book_id, bible_book, books!inner ( id, title, subtitle, genre, deleted_at )'
				)
				.eq('bible_book', bible_book)
				.not('book_id', 'is', null),
			loadPassageSectionsOverlapping(supabase, {
				bibleBook: bible_book,
				chapter,
				verse,
				chapterEnd: chapter_end,
				verseEnd: verse_end
			})
		]);

		if (refsRes.error) {
			console.error('[search-passage] rpc error', refsRes.error);
			queryError = refsRes.error.message;
		}
		if (covRes.error) {
			console.error('[search-passage] coverage error', covRes.error);
			if (!queryError) queryError = covRes.error.message;
		}

		const indexRows: PassageResult[] = ((refsRes.data ?? []) as RefRpcRow[]).map((r) =>
			asResult({
				source_kind: 'index' as const,
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
			})
		);

		type CovParsed = {
			id: string;
			bookId: string;
			bibleBook: string;
			title: string | null;
			subtitle: string | null;
			genre: string | null;
		};
		const covParsed: CovParsed[] = [];
		for (const raw of (covRes.data ?? []) as unknown as CoverageRow[]) {
			const b = Array.isArray(raw.books) ? raw.books[0] : raw.books;
			if (!b || b.deleted_at || !raw.book_id) continue;
			covParsed.push({
				id: raw.id,
				bookId: raw.book_id,
				bibleBook: raw.bible_book,
				title: b.title,
				subtitle: b.subtitle,
				genre: b.genre
			});
		}

		const bands = assignPassageBands({
			coverages: covParsed.map((c) => ({ bookId: c.bookId, genre: c.genre })),
			sections: sections.map((s) => ({ bookId: s.book_id })),
			indexHits: indexRows.map((r) => ({ bookId: r.book_id }))
		});

		const commentaryRows: PassageResult[] = covParsed
			.filter((c) => bands.commentaryBookIds.has(c.bookId))
			.map((c) =>
				asResult({
					source_kind: 'commentary' as const,
					ref_id: `cov-${c.id}`,
					book_id: c.bookId,
					essay_id: null,
					book_title: c.title,
					book_subtitle: c.subtitle,
					bible_book: c.bibleBook,
					chapter_start: null,
					verse_start: null,
					chapter_end: null,
					verse_end: null,
					page_start: null,
					page_end: null,
					confidence_score: null,
					needs_review: false,
					review_note: null
				})
			)
			.sort((a, b) => (a.book_title ?? '').localeCompare(b.book_title ?? ''));

		const sectionRows: PassageResult[] = sections
			.filter((s) => bands.sectionBookIds.has(s.book_id))
			.map((s) =>
				asResult({
					source_kind: 'section' as const,
					ref_id: s.id,
					book_id: s.book_id,
					essay_id: null,
					book_title: s.book_title,
					book_subtitle: s.book_subtitle,
					section_label: s.label,
					bible_book: s.bible_book,
					chapter_start: s.chapter_start,
					verse_start: s.verse_start,
					chapter_end: s.chapter_end,
					verse_end: s.verse_end,
					page_start: s.page_start,
					page_end: s.page_end,
					confidence_score: null,
					needs_review: false,
					review_note: null
				})
			);

		const coverageRows: PassageResult[] = covParsed
			.filter((c) => bands.coverageBookIds.has(c.bookId))
			.map((c) =>
				asResult({
					source_kind: 'coverage' as const,
					ref_id: `cov-${c.id}`,
					book_id: c.bookId,
					essay_id: null,
					book_title: c.title,
					book_subtitle: c.subtitle,
					bible_book: c.bibleBook,
					chapter_start: null,
					verse_start: null,
					chapter_end: null,
					verse_end: null,
					page_start: null,
					page_end: null,
					confidence_score: null,
					needs_review: false,
					review_note: null
				})
			)
			.sort((a, b) => (a.book_title ?? '').localeCompare(b.book_title ?? ''));

		results = [...commentaryRows, ...sectionRows, ...coverageRows, ...indexRows];
	}

	return {
		bibleBookNames,
		results,
		query: { bible_book, chapter, verse, chapter_end, verse_end },
		returnTo,
		queryError
	};
};
