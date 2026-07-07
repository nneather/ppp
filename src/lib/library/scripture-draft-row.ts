import {
	formatScriptureRefPageSummary,
	formatScriptureRefRangeDisplay
} from '$lib/library/scripture-ref-format';
import type { OcrScriptureCandidate } from '$lib/library/ocr-scripture-refs';
import type { ScriptureRefRow } from '$lib/types/library';
import { continuationNeedsBookRow } from '$lib/library/scripture-batch-upload';

export type PositionInPage = 'first' | 'middle' | 'last' | 'only';

export type ScriptureDraftRow = {
	key: string;
	bible_book: string;
	chapter_start: string;
	verse_start: string;
	chapter_end: string;
	verse_end: string;
	page_start: string;
	page_end: string;
	needs_review: boolean;
	review_note: string;
	confidence_score: number | null;
	source_image_url: string;
	continuation_from_previous_page: boolean;
	expanded: boolean;
	included: boolean;
	pageJobOrder: number;
	pageJobTotal: number;
	positionInPage: PositionInPage;
	pageJobId: string;
	pdfPageOrder: number;
	pdfPageTotal: number;
	pageLabelKind: 'file' | 'pdf-page';
};

export type ScripturePageJob = {
	id: string;
	order: number;
	sourcePath: string;
	previewUrl: string | null;
	status: 'uploading' | 'extracting' | 'done' | 'error';
	error?: string;
	candidates?: OcrScriptureCandidate[];
	isPdf?: boolean;
	extractLabel?: string;
	sourceFile?: File;
	failedPdfPages?: number[];
	pdfOcrWarning?: string;
};

export type QueuedOcrFile = {
	id: string;
	file: File;
	previewUrl: string;
	isPdf: boolean;
};

export const CONFIDENCE_REVIEW_THRESHOLD = 0.8;
export const MAX_BATCH_IMAGES = 10;

export function freshDraftRowKey(): string {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `r-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isDraftRowSaveable(r: ScriptureDraftRow): boolean {
	return r.bible_book.trim().length > 0 && r.page_start.trim().length > 0;
}

export function formatRowStripLabel(row: ScriptureDraftRow): string {
	const range = formatScriptureRefRangeDisplay({
		bible_book: row.bible_book,
		chapter_start: row.chapter_start.trim() ? Number(row.chapter_start) : null,
		verse_start: row.verse_start.trim() ? Number(row.verse_start) : null,
		chapter_end: row.chapter_end.trim() ? Number(row.chapter_end) : null,
		verse_end: row.verse_end.trim() ? Number(row.verse_end) : null
	});
	const page = formatScriptureRefPageSummary(row.page_start, row.page_end);
	if (!range && !page) return 'Incomplete reference';
	if (range && page) return `${range} · ${page}`;
	return range || page || '—';
}

export function confidenceStripClass(conf: number | null): string {
	if (conf == null) return 'text-muted-foreground';
	if (conf >= 0.95) return 'text-muted-foreground/70';
	if (conf >= CONFIDENCE_REVIEW_THRESHOLD) return 'text-muted-foreground';
	return 'font-medium text-amber-700 dark:text-amber-300';
}

export function rowShowsPageEdge(row: ScriptureDraftRow): boolean {
	return (
		row.positionInPage === 'first' ||
		row.positionInPage === 'last' ||
		row.positionInPage === 'only'
	);
}

export function continuationNeedsBook(row: ScriptureDraftRow): boolean {
	return continuationNeedsBookRow(row.continuation_from_previous_page, row.bible_book);
}

function numStr(n: number | null | undefined): string {
	if (n == null || !Number.isFinite(Number(n))) return '';
	return String(n);
}

export function mapCandidateToRow(c: OcrScriptureCandidate): ScriptureDraftRow {
	const conf =
		typeof c.confidence_score === 'number' && Number.isFinite(c.confidence_score)
			? c.confidence_score
			: 1;
	const cont = c.continuation_from_previous_page === true;
	const bookRaw = (c.bible_book ?? '').trim();
	const needsContinuationPick = cont && bookRaw.length === 0;
	const needs = needsContinuationPick || conf < CONFIDENCE_REVIEW_THRESHOLD;
	const pageStartRaw =
		c.page_start != null && String(c.page_start).trim() !== ''
			? String(c.page_start).trim()
			: '';
	const saveable = bookRaw.length > 0 && pageStartRaw.length > 0;
	return {
		key: freshDraftRowKey(),
		bible_book: bookRaw,
		chapter_start: numStr(c.chapter_start ?? undefined),
		verse_start: numStr(c.verse_start ?? undefined),
		chapter_end: numStr(c.chapter_end ?? undefined),
		verse_end: numStr(c.verse_end ?? undefined),
		page_start: pageStartRaw,
		page_end: c.page_end != null ? String(c.page_end) : '',
		needs_review: needs,
		review_note: '',
		confidence_score: conf,
		source_image_url: '',
		continuation_from_previous_page: cont,
		expanded: needs,
		included: saveable,
		pageJobOrder: 0,
		pageJobTotal: 0,
		positionInPage: 'only',
		pageJobId: '',
		pdfPageOrder: 0,
		pdfPageTotal: 0,
		pageLabelKind: 'file'
	};
}

export function sourcePageIndexForCandidate(c: OcrScriptureCandidate): number {
	const n = c.source_page_index;
	if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
	return Math.max(0, Math.trunc(n));
}

export function blankDraftRow(): ScriptureDraftRow {
	return {
		key: freshDraftRowKey(),
		bible_book: '',
		chapter_start: '',
		verse_start: '',
		chapter_end: '',
		verse_end: '',
		page_start: '',
		page_end: '',
		needs_review: false,
		review_note: '',
		confidence_score: null,
		source_image_url: '',
		continuation_from_previous_page: false,
		expanded: true,
		included: false,
		pageJobOrder: 0,
		pageJobTotal: 0,
		positionInPage: 'only',
		pageJobId: '',
		pdfPageOrder: 0,
		pdfPageTotal: 0,
		pageLabelKind: 'file'
	};
}

export function draftRowFromExisting(r: ScriptureRefRow): ScriptureDraftRow {
	return {
		key: r.id,
		bible_book: r.bible_book,
		chapter_start: r.chapter_start?.toString() ?? '',
		verse_start: r.verse_start?.toString() ?? '',
		chapter_end: r.chapter_end?.toString() ?? '',
		verse_end: r.verse_end?.toString() ?? '',
		page_start: r.page_start ?? '',
		page_end: r.page_end ?? '',
		needs_review: r.needs_review,
		review_note: r.review_note ?? '',
		confidence_score: r.confidence_score,
		source_image_url: r.source_image_url ?? '',
		continuation_from_previous_page: false,
		expanded: r.needs_review,
		included: true,
		pageJobOrder: 0,
		pageJobTotal: 0,
		positionInPage: 'only',
		pageJobId: '',
		pdfPageOrder: 0,
		pdfPageTotal: 0,
		pageLabelKind: 'file'
	};
}
