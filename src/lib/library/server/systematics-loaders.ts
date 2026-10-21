import type { SupabaseClient } from '@supabase/supabase-js';
import {
	groupSystematicHits,
	outlineSpansAcrossVolumes,
	resolveOutlineForPointer,
	type OutlineBookSpan,
	type OutlineSectionInput,
	type SystematicSetBlock
} from '$lib/library/outline';
import { parseSectionLocator } from '$lib/library/section-pointer';
import type { SetVolumeBook } from '$lib/library/systematics-set-routing';

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
	bible_book: string | null;
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
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

/** Above this, sermon and passage search send set summaries and load pointers on expand. */
export const SYSTEMATICS_INLINE_HIT_LIMIT = 150;

export type SystematicsLoadOptions = {
	/** Return every pointer even when the passage is over the inline limit. */
	full?: boolean;
	seriesId?: string | null;
	bookId?: string | null;
};

/**
 * Turn already-fetched systematic RPC rows into set blocks.
 * Shared by passage search (which already ran the RPC) and `loadSystematicsForPassage`.
 */
export async function systematicBlocksFromRpcRows(
	supabase: SupabaseClient,
	rows: RefRpcRow[],
	opts: SystematicsLoadOptions = {},
	fallbackBibleBook = ''
): Promise<SystematicSetBlock[]> {
	let systematicRows = rows.filter((r) => r.book_id && r.book_genre === SYSTEMATIC_GENRE);
	if (opts.seriesId) {
		systematicRows = systematicRows.filter((r) => r.series_id === opts.seriesId);
	}
	if (opts.bookId) {
		systematicRows = systematicRows.filter((r) => r.book_id === opts.bookId);
	}
	if (systematicRows.length === 0) return [];

	const narrowed = Boolean(opts.seriesId || opts.bookId);
	const defer =
		!opts.full && !narrowed && systematicRows.length > SYSTEMATICS_INLINE_HIT_LIMIT;

	const bookIds = [...new Set(systematicRows.map((r) => r.book_id!))];
	const authorsRes = await supabase
		.from('books')
		.select('id, author_display')
		.in('id', bookIds)
		.is('deleted_at', null);
	if (authorsRes.error) console.error('[systematics] authors', authorsRes.error);

	const authorByBook = new Map<string, string | null>();
	for (const b of (authorsRes.data ?? []) as { id: string; author_display: string | null }[]) {
		authorByBook.set(b.id, b.author_display);
	}

	const outlinesByBook = new Map<string, OutlineSectionInput[]>();
	if (!defer) {
		const outlineRes = await supabase
			.from('book_outline_sections')
			.select('id, book_id, parent_id, sort_order, locator, label, page_start, page_end')
			.in('book_id', bookIds)
			.is('deleted_at', null)
			.order('sort_order', { ascending: true });
		if (outlineRes.error) console.error('[systematics] outlines', outlineRes.error);
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
	}

	const hits = systematicRows.map((r) => {
		const bookId = r.book_id!;
		const outlines = outlinesByBook.get(bookId) ?? [];
		const outline = defer ? null : resolveOutlineForPointer(outlines, r.page_start, r.page_end);
		return {
			refId: r.ref_id,
			bookId,
			bookTitle: r.book_title,
			volumeNumber: r.book_volume_number,
			seriesId: r.series_id,
			seriesName: r.series_name,
			authorLabel: authorByBook.get(bookId) ?? r.author_display ?? null,
			bibleBook: r.bible_book?.trim() || fallbackBibleBook,
			chapterStart: r.chapter_start,
			verseStart: r.verse_start,
			chapterEnd: r.chapter_end,
			verseEnd: r.verse_end,
			pageStart: r.page_start,
			pageEnd: r.page_end,
			outline
		};
	});

	return groupSystematicHits(hits, { omitPointers: defer });
}

/**
 * Load systematic-theology index hits for a passage, join outline labels, and
 * group by set. Shared by /library/search-passage, sermon workspace, and MCP.
 */
export async function loadSystematicsForPassage(
	supabase: SupabaseClient,
	query: SystematicsPassageQuery,
	opts: SystematicsLoadOptions = {}
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

	const rows = (data ?? []) as RefRpcRow[];
	return systematicBlocksFromRpcRows(supabase, rows, opts, query.bibleBook);
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

/**
 * Book headings that continue onto another volume of the same series.
 * Chapter rows stay on their own page ranges.
 */
export async function loadOutlineBookSpans(
	supabase: SupabaseClient,
	bookId: string,
	seriesId: string | null | undefined
): Promise<OutlineBookSpan[]> {
	if (!seriesId) return [];
	const { data: books, error } = await supabase
		.from('books')
		.select('id, volume_number')
		.eq('series_id', seriesId)
		.is('deleted_at', null);
	if (error || !books || books.length < 2) return [];

	const volumeById = new Map(
		books.map((b) => [b.id as string, (b.volume_number as string | null) ?? null])
	);
	if (!volumeById.has(bookId)) return [];

	const { data: rows, error: outlineError } = await supabase
		.from('book_outline_sections')
		.select('book_id, locator, page_start, page_end')
		.in('book_id', [...volumeById.keys()])
		.is('deleted_at', null)
		.not('locator', 'is', null)
		.not('locator', 'like', '%.%');
	if (outlineError || !rows) return [];

	return outlineSpansAcrossVolumes(
		rows.map((row) => ({
			locator: row.locator as string,
			volume: volumeById.get(row.book_id as string) ?? null,
			pageStart: row.page_start as number,
			pageEnd: row.page_end as number
		}))
	);
}

/**
 * One row per volume in a set, with the chapter locators and page bounds
 * that index routing uses. Book-level headings (`III`) are omitted.
 */
export async function loadSetVolumeBooks(
	supabase: SupabaseClient,
	seriesId: string | null | undefined
): Promise<SetVolumeBook[]> {
	if (!seriesId) return [];
	const { data: books, error } = await supabase
		.from('books')
		.select('id, volume_number')
		.eq('series_id', seriesId)
		.is('deleted_at', null);
	if (error || !books || books.length === 0) return [];

	const ids = books.map((b) => b.id as string);
	const { data: rows, error: outlineError } = await supabase
		.from('book_outline_sections')
		.select('book_id, locator, page_start, page_end')
		.in('book_id', ids)
		.is('deleted_at', null);
	if (outlineError) {
		console.error('[systematics] loadSetVolumeBooks', outlineError);
	}

	const byBook = new Map<
		string,
		{ locators: string[]; pageMin: number | null; pageMax: number | null }
	>();
	for (const row of rows ?? []) {
		const bookId = row.book_id as string;
		const slot = byBook.get(bookId) ?? { locators: [], pageMin: null, pageMax: null };
		const pageStart = row.page_start as number;
		const pageEnd = row.page_end as number;
		slot.pageMin = slot.pageMin == null ? pageStart : Math.min(slot.pageMin, pageStart);
		slot.pageMax = slot.pageMax == null ? pageEnd : Math.max(slot.pageMax, pageEnd);
		const locator = (row.locator as string | null)?.trim() ?? '';
		if (locator && parseSectionLocator(locator)) slot.locators.push(locator);
		byBook.set(bookId, slot);
	}

	return books
		.map((b) => {
			const slot = byBook.get(b.id as string);
			return {
				bookId: b.id as string,
				volumeNumber: (b.volume_number as string | null) ?? null,
				pageMin: slot?.pageMin ?? null,
				pageMax: slot?.pageMax ?? null,
				locators: slot?.locators ?? []
			};
		})
		.sort((a, b) => {
			const na = Number(a.volumeNumber);
			const nb = Number(b.volumeNumber);
			if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
			return (a.volumeNumber ?? '').localeCompare(b.volumeNumber ?? '');
		});
}
