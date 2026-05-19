/** Shared batch-OCR / save helpers (pure — safe for unit tests). */

export const BATCH_SAVE_CHUNK_SIZE = 75;
export const BATCH_ROW_WINDOW_THRESHOLD = 50;
export const BATCH_ROW_WINDOW_OVERSCAN = 20;
export const ROW_STRIP_HEIGHT_PX = 44;
export const ROW_SEPARATOR_HEIGHT_PX = 28;
export const ROW_EXPANDED_HEIGHT_PX = 220;

export type ScriptureBatchRowPayload = {
	bible_book: string;
	chapter_start: string;
	verse_start: string;
	chapter_end: string;
	verse_end: string;
	page_start: string;
	page_end: string;
	needs_review: boolean;
	review_note: string;
	confidence_score?: number;
	source_image_url?: string;
};

export type RowWindowInput = {
	expanded: boolean;
	pageJobOrder: number;
	prevPageJobOrder: number;
};

export function continuationNeedsBookRow(
	continuation_from_previous_page: boolean,
	bible_book: string
): boolean {
	return continuation_from_previous_page && bible_book.trim().length === 0;
}

/** After OCR merge: collapse strips; only expand rows that still need a book pick. */
export function collapseRowsAfterMerge<
	T extends {
		continuation_from_previous_page: boolean;
		bible_book: string;
		expanded: boolean;
	}
>(rows: T[]): T[] {
	return rows.map((r) => ({
		...r,
		expanded: continuationNeedsBookRow(r.continuation_from_previous_page, r.bible_book)
	}));
}

export function isRowSaveableFields(bible_book: string, page_start: string): boolean {
	return bible_book.trim().length > 0 && page_start.trim().length > 0;
}

export function buildRowsJsonPayload<
	T extends {
		included: boolean;
		bible_book: string;
		page_start: string;
		chapter_start: string;
		verse_start: string;
		chapter_end: string;
		verse_end: string;
		page_end: string;
		needs_review: boolean;
		review_note: string;
		confidence_score: number | null;
		source_image_url: string;
	}
>(rows: T[]): ScriptureBatchRowPayload[] {
	return rows
		.filter((r) => r.included && isRowSaveableFields(r.bible_book, r.page_start))
		.map((r) => ({
			bible_book: r.bible_book,
			chapter_start: r.chapter_start,
			verse_start: r.verse_start,
			chapter_end: r.chapter_end,
			verse_end: r.verse_end,
			page_start: r.page_start,
			page_end: r.page_end,
			needs_review: r.needs_review,
			review_note: r.review_note,
			...(r.confidence_score != null ? { confidence_score: r.confidence_score } : {}),
			...(r.source_image_url.trim() !== '' ? { source_image_url: r.source_image_url } : {})
		}));
}

export function chunkArray<T>(items: T[], size: number): T[][] {
	if (size <= 0 || items.length === 0) return items.length === 0 ? [] : [items];
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		out.push(items.slice(i, i + size));
	}
	return out;
}

export function rowBlockHeightPx(row: RowWindowInput, idx: number): number {
	let h = row.expanded ? ROW_EXPANDED_HEIGHT_PX : ROW_STRIP_HEIGHT_PX;
	if (idx > 0 && row.pageJobOrder > 0 && row.prevPageJobOrder !== row.pageJobOrder) {
		h += ROW_SEPARATOR_HEIGHT_PX;
	}
	return h;
}

export function computeRowWindow(
	rows: RowWindowInput[],
	scrollTop: number,
	viewportHeight: number,
	overscan = BATCH_ROW_WINDOW_OVERSCAN
): { start: number; end: number; topSpacer: number; bottomSpacer: number } {
	if (rows.length === 0) {
		return { start: 0, end: 0, topSpacer: 0, bottomSpacer: 0 };
	}

	const heights: number[] = [];
	let total = 0;
	for (let i = 0; i < rows.length; i++) {
		const prevOrder = i > 0 ? rows[i - 1]!.pageJobOrder : 0;
		const h = rowBlockHeightPx(
			{ expanded: rows[i]!.expanded, pageJobOrder: rows[i]!.pageJobOrder, prevPageJobOrder: prevOrder },
			i
		);
		heights.push(h);
		total += h;
	}

	const viewBottom = scrollTop + viewportHeight;
	let acc = 0;
	let start = 0;
	for (let i = 0; i < rows.length; i++) {
		if (acc + heights[i]! > scrollTop) {
			start = i;
			break;
		}
		acc += heights[i]!;
		if (i === rows.length - 1) {
			start = rows.length;
		}
	}

	let end = rows.length;
	acc = 0;
	for (let i = 0; i < rows.length; i++) {
		acc += heights[i]!;
		if (acc >= viewBottom) {
			end = Math.min(rows.length, i + 1);
			break;
		}
	}

	start = Math.max(0, start - overscan);
	end = Math.min(rows.length, end + overscan);

	let topSpacer = 0;
	for (let i = 0; i < start; i++) topSpacer += heights[i]!;
	let bottomSpacer = 0;
	for (let i = end; i < rows.length; i++) bottomSpacer += heights[i]!;

	return { start, end, topSpacer, bottomSpacer };
}

export function ocrPipelineProgressLabel(
	pages: { status: string }[],
	extractLabels: Record<string, string | undefined>
): string | null {
	const active = pages.filter((p) => p.status === 'uploading' || p.status === 'extracting');
	if (active.length === 0) return null;
	const done = pages.filter((p) => p.status === 'done' || p.status === 'error').length;
	const total = pages.length;
	const labelEntry = Object.values(extractLabels).find((l) => l && l.length > 0);
	if (labelEntry) return `${labelEntry} (${done}/${total} files)`;
	return `Processing ${done + 1} of ${total}…`;
}
