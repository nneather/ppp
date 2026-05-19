import type { PolymorphicParent } from '$lib/library/polymorphic';

const DRAFT_KEY_PREFIX = 'ppp.library.scriptureBatchDraft.v1:';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type ScriptureBatchDraftRow = {
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
	positionInPage: 'first' | 'middle' | 'last' | 'only';
	pageJobId: string;
	pdfPageOrder: number;
	pdfPageTotal: number;
	pageLabelKind: 'file' | 'pdf-page';
};

export type ScriptureBatchDraftPage = {
	id: string;
	order: number;
	sourcePath: string;
	status: 'done' | 'error';
	error?: string;
	isPdf?: boolean;
	pdfOcrWarning?: string;
};

export type ScriptureBatchDraft = {
	version: 1;
	bookId: string;
	savedAt: string;
	parent: PolymorphicParent | null;
	rows: ScriptureBatchDraftRow[];
	pages: ScriptureBatchDraftPage[];
};

function draftKey(bookId: string): string {
	return `${DRAFT_KEY_PREFIX}${bookId}`;
}

export function loadScriptureBatchDraft(bookId: string): ScriptureBatchDraft | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(draftKey(bookId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as ScriptureBatchDraft;
		if (parsed.version !== 1 || parsed.bookId !== bookId) return null;
		const age = Date.now() - new Date(parsed.savedAt).getTime();
		if (!Number.isFinite(age) || age > MAX_AGE_MS) {
			sessionStorage.removeItem(draftKey(bookId));
			return null;
		}
		if (!Array.isArray(parsed.rows) || parsed.rows.length < 2) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function saveScriptureBatchDraft(draft: ScriptureBatchDraft): void {
	if (typeof sessionStorage === 'undefined') return;
	if (draft.rows.length < 2) return;
	try {
		sessionStorage.setItem(draftKey(draft.bookId), JSON.stringify(draft));
	} catch {
		/* quota — ignore */
	}
}

export function clearScriptureBatchDraft(bookId: string): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.removeItem(draftKey(bookId));
	} catch {
		/* ignore */
	}
}

export function serializePagesForDraft(
	pages: {
		id: string;
		order: number;
		sourcePath: string;
		status: string;
		error?: string;
		isPdf?: boolean;
		pdfOcrWarning?: string;
	}[]
): ScriptureBatchDraftPage[] {
	return pages
		.filter((p) => p.status === 'done' || p.status === 'error')
		.map((p) => ({
			id: p.id,
			order: p.order,
			sourcePath: p.sourcePath,
			status: p.status as 'done' | 'error',
			error: p.error,
			isPdf: p.isPdf,
			pdfOcrWarning: p.pdfOcrWarning
		}));
}
