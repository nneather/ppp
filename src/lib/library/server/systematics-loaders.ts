import type { SupabaseClient } from '@supabase/supabase-js';
import {
	groupSystematicHits,
	resolveOutlineForPointer,
	type OutlineSectionInput,
	type SystematicSetBlock
} from '$lib/library/outline';

export type SystematicsPassageQuery = {
	bibleBook: string;
	chapter: number | null;
	verse: number | null;
	chapterEnd: number | null;
	verseEnd: number | null;
};

type RefRpcRow = {
	ref_id: string;
	book_id: string | null;
	book_title: string | null;
	book_genre: string | null;
	book_volume_number: string | null;
	series_id: string | null;
	series_name: string | null;
	page_start: string;
	page_end: string | null;
	author_display?: string | null;
};

type OutlineDbRow = {
	id: string;
	book_id: string;
	parent_id: string | null;
	sort_order: number;
	locator: string | null;
	label: string;
	page_start: number;
	page_end: number;
};

const SYSTEMATIC_GENRE = 'Systematic Theology';

/**
 * Load systematic-theology index hits for a passage, join outline labels, and
 * group by set. Shared by /library/search-passage, sermon workspace, and MCP.
 */
export async function loadSystematicsForPassage(
	supabase: SupabaseClient,
	query: SystematicsPassageQuery
): Promise<SystematicSetBlock[]> {
	const { data, error } = await supabase.rpc('search_scripture_refs', {
		p_bible_book: query.bibleBook,
		p_chapter: query.chapter ?? undefined,
		p_verse: query.verse ?? undefined,
		p_chapter_end: query.chapterEnd ?? undefined,
		p_verse_end: query.verseEnd ?? undefined
	});

	if (error) {
		console.error('[systematics] search_scripture_refs', error);
		return [];
	}

	const systematicRows = ((data ?? []) as RefRpcRow[]).filter(
		(r) => r.book_id && r.book_genre === SYSTEMATIC_GENRE
	);
	if (systematicRows.length === 0) return [];

	const bookIds = [...new Set(systematicRows.map((r) => r.book_id!))];

	const [outlineRes, authorsRes] = await Promise.all([
		supabase
			.from('book_outline_sections')
			.select('id, book_id, parent_id, sort_order, locator, label, page_start, page_end')
			.in('book_id', bookIds)
			.is('deleted_at', null)
			.order('sort_order', { ascending: true }),
		supabase
			.from('books')
			.select('id, author_display')
			.in('id', bookIds)
			.is('deleted_at', null)
	]);

	if (outlineRes.error) {
		console.error('[systematics] outlines', outlineRes.error);
	}
	if (authorsRes.error) {
		console.error('[systematics] authors', authorsRes.error);
	}

	const outlinesByBook = new Map<string, OutlineSectionInput[]>();
	for (const raw of (outlineRes.data ?? []) as OutlineDbRow[]) {
		const list = outlinesByBook.get(raw.book_id) ?? [];
		list.push({
			id: raw.id,
			book_id: raw.book_id,
			parent_id: raw.parent_id,
			sort_order: raw.sort_order,
			locator: raw.locator,
			label: raw.label,
			page_start: raw.page_start,
			page_end: raw.page_end
		});
		outlinesByBook.set(raw.book_id, list);
	}

	const authorByBook = new Map<string, string | null>();
	for (const b of (authorsRes.data ?? []) as { id: string; author_display: string | null }[]) {
		authorByBook.set(b.id, b.author_display);
	}

	const hits = systematicRows.map((r) => {
		const bookId = r.book_id!;
		const outlines = outlinesByBook.get(bookId) ?? [];
		const outline = resolveOutlineForPointer(outlines, r.page_start, r.page_end);
		return {
			refId: r.ref_id,
			bookId,
			bookTitle: r.book_title,
			volumeNumber: r.book_volume_number,
			seriesId: r.series_id,
			seriesName: r.series_name,
			authorLabel: authorByBook.get(bookId) ?? null,
			pageStart: r.page_start,
			pageEnd: r.page_end,
			outline
		};
	});

	return groupSystematicHits(hits);
}

/**
 * Enrich already-fetched systematic PassageResult rows with outline labels
 * (when search-passage already has the RPC rows and wants one outline fetch).
 */
export async function loadOutlinesForBooks(
	supabase: SupabaseClient,
	bookIds: string[]
): Promise<Map<string, OutlineSectionInput[]>> {
	const out = new Map<string, OutlineSectionInput[]>();
	if (bookIds.length === 0) return out;

	const { data, error } = await supabase
		.from('book_outline_sections')
		.select('id, book_id, parent_id, sort_order, locator, label, page_start, page_end')
		.in('book_id', bookIds)
		.is('deleted_at', null)
		.order('sort_order', { ascending: true });

	if (error) {
		console.error('[systematics] loadOutlinesForBooks', error);
		return out;
	}

	for (const raw of (data ?? []) as OutlineDbRow[]) {
		const list = out.get(raw.book_id) ?? [];
		list.push({
			id: raw.id,
			book_id: raw.book_id,
			parent_id: raw.parent_id,
			sort_order: raw.sort_order,
			locator: raw.locator,
			label: raw.label,
			page_start: raw.page_start,
			page_end: raw.page_end
		});
		out.set(raw.book_id, list);
	}
	return out;
}

/** Live outline sections for a book (book detail). */
export async function loadOutlineSectionsForBook(
	supabase: SupabaseClient,
	bookId: string
): Promise<OutlineSectionInput[]> {
	const { data, error } = await supabase
		.from('book_outline_sections')
		.select('id, book_id, parent_id, sort_order, locator, label, page_start, page_end')
		.eq('book_id', bookId)
		.is('deleted_at', null)
		.order('sort_order', { ascending: true })
		.order('page_start', { ascending: true });

	if (error) {
		console.error('[systematics] loadOutlineSectionsForBook', error);
		return [];
	}

	return ((data ?? []) as OutlineDbRow[]).map((raw) => ({
		id: raw.id,
		book_id: raw.book_id,
		parent_id: raw.parent_id,
		sort_order: raw.sort_order,
		locator: raw.locator,
		label: raw.label,
		page_start: raw.page_start,
		page_end: raw.page_end
	}));
}
