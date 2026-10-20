/**
 * Loaders for the book-detail scripture index summary / dialog / manage page.
 * Prefer these over loadScriptureRefsForBook when the corpus can exceed the
 * PostgREST 1000-row default (systematics indexes).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveOutlineForPointer } from '$lib/library/outline';
import {
	parsePageFilter,
	parsePassageFilter,
	type ScriptureCountRow,
	type ScriptureManageFilters
} from '$lib/library/scripture-index';
import { signStorageUrlsLimited } from '$lib/library/sign-storage-urls';
import {
	SCRIPTURE_IMAGES_BUCKET,
	SCRIPTURE_IMAGES_SIGNED_URL_TTL
} from '$lib/library/storage';
import type { ScriptureRefRow } from '$lib/types/library';
import { loadOutlinesForBooks } from '$lib/library/server/systematics-loaders';

const REF_SELECT = `
	id,
	book_id,
	essay_id,
	bible_book,
	chapter_start,
	verse_start,
	chapter_end,
	verse_end,
	page_start,
	page_end,
	confidence_score,
	needs_review,
	review_note,
	source_image_url,
	created_at,
	verse_start_abs,
	verse_end_abs
`;

type RawRef = {
	id: string;
	book_id: string | null;
	essay_id: string | null;
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
	source_image_url: string | null;
	created_at: string;
	verse_start_abs: number | null;
	verse_end_abs: number | null;
};

export type ScriptureIndexRefRow = ScriptureRefRow & {
	volume_number: string | null;
	outline_label: string | null;
};

export type LocateScriptureRefResult = {
	id: string;
	book_id: string;
	bible_book: string;
	chapter_start: number | null;
};

function mapRawToRow(
	r: RawRef,
	signedUrl: string | null,
	extras?: { volume_number?: string | null; outline_label?: string | null }
): ScriptureIndexRefRow {
	return {
		id: r.id,
		book_id: r.book_id,
		essay_id: r.essay_id,
		bible_book: r.bible_book,
		chapter_start: r.chapter_start,
		verse_start: r.verse_start,
		chapter_end: r.chapter_end,
		verse_end: r.verse_end,
		page_start: r.page_start,
		page_end: r.page_end,
		confidence_score: r.confidence_score,
		needs_review: Boolean(r.needs_review),
		review_note: r.review_note,
		source_image_url: r.source_image_url,
		source_image_signed_url: signedUrl,
		created_at: r.created_at,
		volume_number: extras?.volume_number ?? null,
		outline_label: extras?.outline_label ?? null
	};
}

/** RPC tallies for one or more volume books. Pages past PostgREST's 1000-row cap. */
export async function loadScriptureIndexCounts(
	supabase: SupabaseClient,
	bookIds: string[]
): Promise<ScriptureCountRow[]> {
	if (bookIds.length === 0) return [];
	const PAGE = 1000;
	const out: ScriptureCountRow[] = [];
	for (let from = 0; ; from += PAGE) {
		const { data, error } = await supabase
			.rpc('library_scripture_ref_counts', { p_book_ids: bookIds })
			.range(from, from + PAGE - 1);
		if (error) {
			console.error('[loadScriptureIndexCounts]', error);
			return [];
		}
		const rows = (data ?? []) as {
			book_id: string;
			bible_book: string;
			chapter_start: number | null;
			n: number;
		}[];
		for (const r of rows) {
			out.push({
				book_id: r.book_id,
				bible_book: r.bible_book,
				chapter_start: r.chapter_start,
				n: Number(r.n) || 0
			});
		}
		if (rows.length < PAGE) break;
	}
	return out;
}

export type LoadScriptureIndexRowsOpts = {
	bookIds: string[];
	bibleBook?: string | null;
	/** Numbered chapter filter (`chapter_start = n`). Ignored when `wholeBookOnly`. */
	chapter?: number | null;
	/** Refs with null `chapter_start` only (whole-book index lines). */
	wholeBookOnly?: boolean;
	/** When true, hydrate volume_number + outline_label (extra round-trips). */
	withOutline?: boolean;
	/** Map book_id → volume_number (from set volumes). */
	volumeByBookId?: Map<string, string | null>;
	limit?: number;
	offset?: number;
	filters?: Pick<ScriptureManageFilters, 'passage' | 'page' | 'needsReview'>;
	/** Sign storage URLs (default true). */
	signImages?: boolean;
};

export type LoadScriptureIndexRowsResult = {
	rows: ScriptureIndexRefRow[];
	filteredCount: number;
};

function absBounds(f: {
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
}): { start: number; end: number } | null {
	const cs = f.chapter_start;
	if (cs == null) return null;
	const vs = f.verse_start;
	const ce = f.chapter_end;
	const ve = f.verse_end;
	const start = vs != null ? cs * 1000 + vs : cs * 1000;
	let end: number;
	if (ce != null && ve != null) end = ce * 1000 + ve;
	else if (ce != null) end = ce * 1000 + 999;
	else if (vs != null) end = cs * 1000 + vs;
	else end = cs * 1000 + 999;
	return { start, end };
}

/**
 * Paginated scripture_references for a set of volume books.
 * Prefer bibleBook + chapter for the dialog; manage page passes filters.
 */
export async function loadScriptureIndexRows(
	supabase: SupabaseClient,
	opts: LoadScriptureIndexRowsOpts
): Promise<LoadScriptureIndexRowsResult> {
	const bookIds = opts.bookIds.filter(Boolean);
	if (bookIds.length === 0) return { rows: [], filteredCount: 0 };

	const limit = opts.limit ?? 100;
	const offset = opts.offset ?? 0;

	let q = supabase
		.from('scripture_references')
		.select(REF_SELECT, { count: 'exact' })
		.in('book_id', bookIds)
		.is('deleted_at', null);

	if (opts.bibleBook) q = q.eq('bible_book', opts.bibleBook);
	if (opts.wholeBookOnly) q = q.is('chapter_start', null);
	else if (opts.chapter != null) q = q.eq('chapter_start', opts.chapter);

	const filters = opts.filters;
	if (filters?.needsReview === true) q = q.eq('needs_review', true);
	if (filters?.needsReview === false) q = q.eq('needs_review', false);

	const passage = parsePassageFilter(filters?.passage ?? null);
	if (passage) {
		if (passage.bible_book && !opts.bibleBook) q = q.eq('bible_book', passage.bible_book);
		const bounds = absBounds(passage);
		if (bounds) {
			q = q.lte('verse_start_abs', bounds.end).gte('verse_end_abs', bounds.start);
		} else if (passage.chapter_start != null && opts.chapter == null) {
			q = q.eq('chapter_start', passage.chapter_start);
		}
	}

	const page = parsePageFilter(filters?.page ?? null);
	if (page) {
		const token = page.kind === 'arabic' ? String(page.page) : page.token;
		// Quote so section locators (III.2.12) survive PostgREST .or() parsing.
		const quoted = `"${token.replace(/"/g, '')}"`;
		q = q.or(`page_start.eq.${quoted},page_end.eq.${quoted}`);
	}

	q = q
		.order('verse_start_abs', { ascending: true, nullsFirst: false })
		.order('created_at', { ascending: true })
		.range(offset, offset + limit - 1);

	const { data, error, count } = await q;
	if (error) {
		console.error('[loadScriptureIndexRows]', error);
		return { rows: [], filteredCount: 0 };
	}

	const raw = (data ?? []) as unknown as RawRef[];
	const signImages = opts.signImages !== false;
	const signed = signImages
		? await signStorageUrlsLimited(
				supabase,
				SCRIPTURE_IMAGES_BUCKET,
				raw.map((r) => r.source_image_url),
				SCRIPTURE_IMAGES_SIGNED_URL_TTL
			)
		: raw.map(() => null);

	let outlines: Map<string, Awaited<ReturnType<typeof loadOutlinesForBooks>> extends Map<
		string,
		infer V
	>
		? V
		: never> | null = null;
	if (opts.withOutline) {
		outlines = await loadOutlinesForBooks(supabase, bookIds);
	}

	const volumeByBookId = opts.volumeByBookId ?? new Map<string, string | null>();

	const rows = raw.map((r, i) => {
		const bookId = r.book_id ?? '';
		let outline_label: string | null = null;
		if (outlines && bookId) {
			const sections = outlines.get(bookId) ?? [];
			outline_label = resolveOutlineForPointer(sections, r.page_start, r.page_end)?.label ?? null;
		}
		return mapRawToRow(r, signed[i] ?? null, {
			volume_number: volumeByBookId.get(bookId) ?? null,
			outline_label
		});
	});

	return { rows, filteredCount: count ?? rows.length };
}

/** Resolve a ref id to its book + chapter for deep-link opening. */
export async function locateScriptureRef(
	supabase: SupabaseClient,
	refId: string
): Promise<LocateScriptureRefResult | null> {
	const { data, error } = await supabase
		.from('scripture_references')
		.select('id, book_id, bible_book, chapter_start')
		.eq('id', refId)
		.is('deleted_at', null)
		.maybeSingle();
	if (error || !data?.book_id) {
		if (error) console.error('[locateScriptureRef]', error);
		return null;
	}
	return {
		id: data.id as string,
		book_id: data.book_id as string,
		bible_book: data.bible_book as string,
		chapter_start: (data.chapter_start as number | null) ?? null
	};
}

export type ScriptureImageThumb = {
	source_image_url: string;
	source_image_signed_url: string;
	refCount: number;
};

/** Distinct source images on a book (capped) for the recorded-images strip. */
export async function loadScriptureImagesForBook(
	supabase: SupabaseClient,
	bookId: string,
	cap = 40
): Promise<ScriptureImageThumb[]> {
	const { data, error } = await supabase
		.from('scripture_references')
		.select('source_image_url')
		.eq('book_id', bookId)
		.is('deleted_at', null)
		.not('source_image_url', 'is', null)
		.limit(500);
	if (error) {
		console.error('[loadScriptureImagesForBook]', error);
		return [];
	}

	const counts = new Map<string, number>();
	for (const row of data ?? []) {
		const path = (row.source_image_url as string | null)?.trim();
		if (!path) continue;
		counts.set(path, (counts.get(path) ?? 0) + 1);
	}
	const paths = [...counts.keys()].slice(0, cap);
	const signed = await signStorageUrlsLimited(
		supabase,
		SCRIPTURE_IMAGES_BUCKET,
		paths,
		SCRIPTURE_IMAGES_SIGNED_URL_TTL
	);
	const out: ScriptureImageThumb[] = [];
	for (let i = 0; i < paths.length; i++) {
		const url = signed[i];
		const path = paths[i]!;
		if (!url) continue;
		out.push({
			source_image_url: path,
			source_image_signed_url: url,
			refCount: counts.get(path) ?? 1
		});
	}
	return out;
}
