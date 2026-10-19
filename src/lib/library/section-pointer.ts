/**
 * Institutes-style section locators (Book.chapter.section), including ranges
 * (`III.2.12–14`). These tokens sit on scripture_references.page_start/page_end
 * and join outline locators. Page-number tokens are left alone ([252]).
 *
 * The Edge Function keeps a byte-identical copy at
 * supabase/functions/ocr_scripture_refs/section-pointer.ts.
 */

const ROMAN_BOOKS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const;

const BOOK_TOKEN = 'X|IX|VIII|VII|VI|V|IV|III|II|I|\\d{1,2}';
const LOCATOR_RE = new RegExp(`^(${BOOK_TOKEN})\\.(\\d{1,3})(?:\\.(\\d{1,3}))?$`, 'i');

export type SectionLocator = {
	book: number;
	chapter: number;
	section: number | null;
	/** Printed book token, kept as roman (`III`) or arabic (`3`). */
	bookToken: string;
};

function printedBookToken(raw: string): string {
	if (/^\d/.test(raw)) return raw;
	return raw.toUpperCase();
}

function bookNumber(token: string): number | null {
	const printed = printedBookToken(token);
	const romanIdx = ROMAN_BOOKS.indexOf(printed as (typeof ROMAN_BOOKS)[number]);
	if (romanIdx >= 0) return romanIdx + 1;
	if (!/^\d{1,2}$/.test(printed)) return null;
	const n = Number(printed);
	if (n >= 1 && n <= 10) return n;
	return null;
}

export function parseSectionLocator(raw: string | null | undefined): SectionLocator | null {
	if (raw == null) return null;
	const t = String(raw).trim();
	if (!t) return null;
	const m = LOCATOR_RE.exec(t);
	if (!m) return null;
	const book = bookNumber(m[1]!);
	if (book == null) return null;
	const chapter = Number(m[2]);
	const section = m[3] != null ? Number(m[3]) : null;
	if (!Number.isInteger(chapter) || chapter < 1 || chapter > 200) return null;
	if (section != null && (!Number.isInteger(section) || section < 1 || section > 200)) {
		return null;
	}
	return {
		book,
		chapter,
		section,
		bookToken: printedBookToken(m[1]!)
	};
}

export function formatSectionLocator(loc: SectionLocator): string {
	if (loc.section == null) return `${loc.bookToken}.${loc.chapter}`;
	return `${loc.bookToken}.${loc.chapter}.${loc.section}`;
}

function sectionRank(loc: SectionLocator): number {
	return loc.book * 1_000_000 + loc.chapter * 1_000 + (loc.section ?? 0);
}

/** True when `end` is strictly after `start` and the span is a short printed range. */
function isTightRange(start: SectionLocator, end: SectionLocator): boolean {
	if (end.book !== start.book) return false;
	if (sectionRank(end) <= sectionRank(start)) return false;
	if (start.chapter === end.chapter) {
		if (start.section == null || end.section == null) return false;
		return end.section - start.section <= 40;
	}
	if (start.section != null || end.section != null) return false;
	return end.chapter - start.chapter <= 6;
}

/**
 * Split a printed section range into full locators.
 * `III.2.12–14` → start `III.2.12`, end `III.2.14`.
 * Returns null for page ranges (`620–23`) and single locators.
 */
export function expandPrintedSectionRange(
	raw: string | null | undefined
): { pageStart: string; pageEnd: string } | null {
	if (raw == null) return null;
	const t = String(raw).trim();
	const m = t.match(/^(.+?)\s*[-–—]\s*(.+)$/);
	if (!m) return null;
	const start = parseSectionLocator(m[1]!);
	if (!start) return null;
	const endRaw = m[2]!.trim();
	let end = parseSectionLocator(endRaw);
	if (!end && /^\d{1,3}$/.test(endRaw)) {
		const n = Number(endRaw);
		if (start.section != null) {
			end = { book: start.book, chapter: start.chapter, section: n, bookToken: start.bookToken };
		} else {
			end = { book: start.book, chapter: n, section: null, bookToken: start.bookToken };
		}
	}
	if (!end || !isTightRange(start, end)) return null;
	return { pageStart: formatSectionLocator(start), pageEnd: formatSectionLocator(end) };
}

export function parseSectionPointer(
	pageStart: string | null | undefined,
	pageEnd?: string | null
): { start: SectionLocator; end: SectionLocator | null } | null {
	const ps = pageStart?.trim() ?? '';
	if (!ps) return null;
	const pe = pageEnd?.trim() ?? '';
	if (!pe) {
		const expanded = expandPrintedSectionRange(ps);
		if (expanded) {
			const start = parseSectionLocator(expanded.pageStart);
			const end = parseSectionLocator(expanded.pageEnd);
			if (start && end) return { start, end };
		}
		const start = parseSectionLocator(ps);
		return start ? { start, end: null } : null;
	}
	const start = parseSectionLocator(ps);
	if (!start) return null;
	let end = parseSectionLocator(pe);
	if (!end && /^\d{1,3}$/.test(pe)) {
		const n = Number(pe);
		if (start.section != null) {
			end = { book: start.book, chapter: start.chapter, section: n, bookToken: start.bookToken };
		} else {
			end = { book: start.book, chapter: n, section: null, bookToken: start.bookToken };
		}
	}
	if (!end || !isTightRange(start, end)) return { start, end: null };
	return { start, end };
}

/** Collapse `III.2.12` + `III.2.14` to `III.2.12–14` when the chapter is shared. */
export function formatSectionRange(start: SectionLocator, end: SectionLocator | null): string {
	if (
		end &&
		start.book === end.book &&
		start.chapter === end.chapter &&
		start.section != null &&
		end.section != null
	) {
		return `${formatSectionLocator(start)}–${end.section}`;
	}
	if (end) return `${formatSectionLocator(start)}–${formatSectionLocator(end)}`;
	return formatSectionLocator(start);
}

/**
 * Normalize OCR page fields so a printed section range is stored as two full
 * locators. Page-number ranges are unchanged (returns null).
 */
export function normalizeSectionPageFields(
	pageStart: string | null | undefined,
	pageEnd: string | null | undefined
): { pageStart: string; pageEnd: string | null } | null {
	const ps = pageStart?.trim() ?? '';
	if (!ps) return null;
	const pe = pageEnd?.trim() ?? '';
	if (!pe) {
		const expanded = expandPrintedSectionRange(ps);
		if (!expanded) return null;
		return { pageStart: expanded.pageStart, pageEnd: expanded.pageEnd };
	}
	if (!parseSectionLocator(ps)) return null;
	const pointer = parseSectionPointer(ps, pe);
	if (!pointer) return null;
	if (pointer.end && /^\d{1,3}$/.test(pe)) {
		return {
			pageStart: formatSectionLocator(pointer.start),
			pageEnd: formatSectionLocator(pointer.end)
		};
	}
	return { pageStart: ps, pageEnd: pe || null };
}
