/**
 * Contract for `ocr_scripture_refs` Edge Function + client draft rows.
 * Aligned with `docs/decisions/005` and `015`.
 */
export type OcrScriptureCandidate = {
	bible_book: string;
	chapter_start?: number | null;
	verse_start?: number | null;
	chapter_end?: number | null;
	verse_end?: number | null;
	page_start?: string | null;
	page_end?: string | null;
	/** 0–1; UI sets needs_review when < 0.80 */
	confidence_score: number;
};

export type OcrScriptureExtractResponse = {
	rawText: string;
	candidates: OcrScriptureCandidate[];
};
