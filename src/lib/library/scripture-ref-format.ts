/**
 * Human-readable scripture reference strings (detail page, review links, audit).
 * Mirrors the `scripture_references` branch in `entityLabelFor` in audit-log.
 */
export function formatScriptureRefRangeDisplay(r: {
	bible_book: string;
	chapter_start: number | null;
	verse_start: number | null;
	chapter_end: number | null;
	verse_end: number | null;
}): string {
	const bibleBook = r.bible_book?.trim() ?? '';
	if (!bibleBook) return '';
	const cs = r.chapter_start;
	const vs = r.verse_start;
	const ce = r.chapter_end;
	const ve = r.verse_end;
	if (cs == null) return bibleBook;
	let ref = `${bibleBook} ${cs}`;
	if (vs != null) ref += `:${vs}`;
	if (ce != null && (ce !== cs || ve !== vs)) {
		ref += `–${ce}`;
		if (ve != null) ref += `:${ve}`;
	}
	return ref;
}

/** e.g. `p. xiv` or `p. 47–49`; null when no page_start. */
export function formatScriptureRefPageSummary(
	page_start: string | null | undefined,
	page_end: string | null | undefined
): string | null {
	const ps = page_start?.trim() ?? '';
	if (!ps) return null;
	const pe = page_end?.trim() ?? '';
	if (pe && pe !== ps) return `p. ${ps}–${pe}`;
	return `p. ${ps}`;
}
