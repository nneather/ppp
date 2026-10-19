/**
 * Pure helpers for systematics-by-passage: parse index page tokens, resolve
 * TOC outline labels (page range, or section locator for Calvin), and group
 * hits by set ([252]).
 */

import {
	formatSectionRange,
	parseSectionLocator,
	parseSectionPointer
} from '$lib/library/section-pointer';

export type OutlineSectionInput = {
	id: string;
	book_id: string;
	parent_id: string | null;
	sort_order: number;
	locator: string | null;
	label: string;
	page_start: number;
	page_end: number;
};

export type OutlineResolve = {
	id: string;
	locator: string | null;
	label: string;
	page_start: number;
	page_end: number;
};

/**
 * Extract the leading arabic page number from an index page token.
 * Examples: `620`, `620–23`, `106n21`, `pp. 249ff` → 620 / 106 / 249.
 * Returns null when no leading digits are found.
 */
export function pageNumberFromText(raw: string | null | undefined): number | null {
	if (raw == null) return null;
	const t = String(raw).trim();
	if (!t) return null;
	const m = t.match(/(\d{1,5})/);
	if (!m) return null;
	const n = Number(m[1]);
	if (!Number.isFinite(n) || n < 1) return null;
	return n;
}

/**
 * Deepest enclosing outline node for a page (narrowest page span that contains
 * `page`). Ties break by higher sort_order, then longer locator.
 */
export function resolveOutlineLabel(
	sections: OutlineSectionInput[],
	page: number
): OutlineResolve | null {
	const enclosing = sections.filter((s) => s.page_start <= page && page <= s.page_end);
	if (enclosing.length === 0) return null;

	enclosing.sort((a, b) => {
		const spanA = a.page_end - a.page_start;
		const spanB = b.page_end - b.page_start;
		if (spanA !== spanB) return spanA - spanB;
		if (a.sort_order !== b.sort_order) return b.sort_order - a.sort_order;
		const locA = a.locator?.length ?? 0;
		const locB = b.locator?.length ?? 0;
		return locB - locA;
	});

	const best = enclosing[0]!;
	return outlineResolveFrom(best);
}

function outlineResolveFrom(section: OutlineSectionInput): OutlineResolve {
	return {
		id: section.id,
		locator: section.locator,
		label: section.label,
		page_start: section.page_start,
		page_end: section.page_end
	};
}

function sectionCovers(
	node: NonNullable<ReturnType<typeof parseSectionLocator>>,
	start: NonNullable<ReturnType<typeof parseSectionLocator>>,
	end: NonNullable<ReturnType<typeof parseSectionLocator>> | null
): boolean {
	const stop = end ?? start;
	if (node.book !== start.book || node.book !== stop.book) return false;
	if (node.chapter !== start.chapter || node.chapter !== stop.chapter) return false;
	if (node.section == null) return true;
	if (start.section == null || stop.section == null) return false;
	return node.section === start.section && node.section === stop.section;
}

/** True when an outline locator (`I.13` or `1.13`) covers a printed section pointer. */
export function locatorCoversSectionPointer(
	locator: string | null | undefined,
	pageStart: string | null | undefined,
	pageEnd?: string | null
): boolean {
	const pointer = parseSectionPointer(pageStart, pageEnd);
	if (!pointer) return false;
	const loc = parseSectionLocator(locator);
	if (!loc) return false;
	return sectionCovers(loc, pointer.start, pointer.end);
}

/**
 * Join an index pointer to an outline node. Section locators (`III.2.12`,
 * `III.2.12`–`III.2.14`) match `locator` (exact section, else the chapter).
 * Anything else still joins on the page range.
 */
export function resolveOutlineForPointer(
	sections: OutlineSectionInput[],
	pageStart: string | null | undefined,
	pageEnd?: string | null
): OutlineResolve | null {
	const pointer = parseSectionPointer(pageStart, pageEnd);
	if (pointer) {
		const covering = sections.flatMap((section) => {
			const loc = parseSectionLocator(section.locator);
			if (!loc || !sectionCovers(loc, pointer.start, pointer.end)) return [];
			return [{ section, loc }];
		});
		if (covering.length > 0) {
			covering.sort((a, b) => {
				const specA = a.loc.section == null ? 1 : 2;
				const specB = b.loc.section == null ? 1 : 2;
				if (specA !== specB) return specB - specA;
				return (b.section.locator?.length ?? 0) - (a.section.locator?.length ?? 0);
			});
			return outlineResolveFrom(covering[0]!.section);
		}
		return null;
	}

	const page = pageNumberFromText(pageStart);
	if (page == null) return null;
	return resolveOutlineLabel(sections, page);
}

export type SystematicHitInput = {
	refId: string;
	bookId: string;
	bookTitle: string | null;
	volumeNumber: string | null;
	seriesId: string | null;
	seriesName: string | null;
	authorLabel: string | null;
	pageStart: string | null;
	pageEnd: string | null;
	outline: OutlineResolve | null;
};

export type SystematicPointer = {
	refId: string;
	bookId: string;
	volume: string | null;
	pageStart: string;
	pageEnd: string | null;
	locator: string | null;
	label: string | null;
	display: string;
};

export type SystematicSetBlock = {
	seriesId: string | null;
	seriesName: string;
	authorLabel: string | null;
	pointers: SystematicPointer[];
};

function pointerOrderKey(pageStart: string | null, pageEnd: string | null): number {
	const section = parseSectionPointer(pageStart, pageEnd);
	if (section) {
		const s = section.start;
		return 1_000_000_000 + s.book * 1_000_000 + s.chapter * 1_000 + (s.section ?? 0);
	}
	return pageNumberFromText(pageStart) ?? 0;
}

function volumeSortKey(v: string | null): number {
	if (v == null || v.trim() === '') return 9999;
	const t = v.trim();
	const roman: Record<string, number> = {
		I: 1,
		II: 2,
		III: 3,
		IV: 4,
		V: 5,
		VI: 6,
		VII: 7,
		VIII: 8,
		IX: 9,
		X: 10
	};
	if (roman[t] != null) return roman[t]!;
	const n = Number(t);
	if (Number.isFinite(n)) return n;
	return 5000 + t.charCodeAt(0);
}

/** Format one pointer line: `2:620 (XV.17 Full Assurance)`, `III.2.12–14 (Faith)`, or `p. 136 (Repentance)`. */
export function formatSystematicPointerDisplay(input: {
	volume: string | null;
	pageStart: string;
	pageEnd: string | null;
	locator: string | null;
	label: string | null;
}): string {
	const { volume, pageStart, pageEnd, locator, label } = input;
	const section = parseSectionPointer(pageStart, pageEnd);
	if (section) {
		const locus = formatSectionRange(section.start, section.end);
		const heading = label?.trim() ?? '';
		if (!heading) return locus;
		return `${locus} (${heading})`;
	}
	const pagePart =
		pageEnd && pageEnd !== pageStart ? `${pageStart}–${pageEnd}` : pageStart;
	const locus =
		volume && volume.trim() !== '' ? `${volume.trim()}:${pagePart}` : `p. ${pagePart}`;
	const headingBits = [locator?.trim(), label?.trim()].filter(
		(x): x is string => Boolean(x && x.length > 0)
	);
	if (headingBits.length === 0) return locus;
	return `${locus} (${headingBits.join(' ')})`;
}

/**
 * Group systematic-theology index hits by series (or lone book title), ordered
 * by volume then page.
 */
export function groupSystematicHits(hits: SystematicHitInput[]): SystematicSetBlock[] {
	const byKey = new Map<string, SystematicHitInput[]>();
	for (const h of hits) {
		const key = h.seriesId ?? `book:${h.bookId}`;
		const list = byKey.get(key) ?? [];
		list.push(h);
		byKey.set(key, list);
	}

	const blocks: SystematicSetBlock[] = [];
	for (const [, list] of byKey) {
		list.sort((a, b) => {
			const va = volumeSortKey(a.volumeNumber);
			const vb = volumeSortKey(b.volumeNumber);
			if (va !== vb) return va - vb;
			return pointerOrderKey(a.pageStart, a.pageEnd) - pointerOrderKey(b.pageStart, b.pageEnd);
		});

		const first = list[0]!;
		const seriesName =
			first.seriesName?.trim() ||
			first.bookTitle?.trim() ||
			'Systematic theology';

		blocks.push({
			seriesId: first.seriesId,
			seriesName,
			authorLabel: first.authorLabel,
			pointers: list.map((h) => {
				const pageStart = h.pageStart?.trim() || '?';
				const pageEnd = h.pageEnd?.trim() || null;
				const locator = h.outline?.locator ?? null;
				const label = h.outline?.label ?? null;
				return {
					refId: h.refId,
					bookId: h.bookId,
					volume: h.volumeNumber,
					pageStart,
					pageEnd,
					locator,
					label,
					display: formatSystematicPointerDisplay({
						volume: h.volumeNumber,
						pageStart,
						pageEnd,
						locator,
						label
					})
				};
			})
		});
	}

	blocks.sort((a, b) => a.seriesName.localeCompare(b.seriesName));
	return blocks;
}

const BOOK_LEVEL_LOCATOR = /^(?:X|IX|VIII|VII|VI|V|IV|III|II|I)$/i;

/** `III` is a book heading. `III.2` is a chapter. */
export function bookLevelLocator(locator: string | null | undefined): string | null {
	if (locator == null) return null;
	const t = locator.trim();
	if (!BOOK_LEVEL_LOCATOR.test(t)) return null;
	return t.toUpperCase();
}

export type OutlineBookSpanPart = {
	locator: string;
	volume: string | null;
	pageStart: number;
	pageEnd: number;
};

export type OutlineBookSpan = {
	locator: string;
	pageStart: number;
	pageEnd: number;
	/** `vols. 1–2` when the same book heading is stored on more than one volume. */
	volumesLabel: string;
};

function compareVolumeLabels(a: string, b: string): number {
	const na = Number(a);
	const nb = Number(b);
	if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
	return a.localeCompare(b);
}

/**
 * Book headings split across set volumes (Calvin Book III: 535–849 and
 * 850–1008) display as one span. Chapter rows are ignored.
 */
export function outlineSpansAcrossVolumes(parts: OutlineBookSpanPart[]): OutlineBookSpan[] {
	const byLocator = new Map<string, OutlineBookSpanPart[]>();
	for (const part of parts) {
		const locator = bookLevelLocator(part.locator);
		if (!locator || !part.volume) continue;
		const list = byLocator.get(locator) ?? [];
		list.push(part);
		byLocator.set(locator, list);
	}

	const spans: OutlineBookSpan[] = [];
	for (const [locator, list] of byLocator) {
		const volumes = [...new Set(list.map((p) => p.volume).filter((v): v is string => Boolean(v)))];
		if (volumes.length < 2) continue;
		volumes.sort(compareVolumeLabels);
		spans.push({
			locator,
			pageStart: Math.min(...list.map((p) => p.pageStart)),
			pageEnd: Math.max(...list.map((p) => p.pageEnd)),
			volumesLabel: volumes.length === 2 ? `vols. ${volumes[0]}–${volumes[1]}` : `vols. ${volumes.join(', ')}`
		});
	}
	spans.sort((a, b) => a.pageStart - b.pageStart);
	return spans;
}

/** Parse a TSV paste line: locator\\tlabel\\tpages (pages = `620` or `620-650`). */
export function parseOutlineTsvLine(
	line: string
): { locator: string | null; label: string; pageStart: number; pageEnd: number } | null {
	const trimmed = line.trim();
	if (!trimmed || trimmed.startsWith('#')) return null;
	const parts = trimmed.split(/\t/);
	if (parts.length < 2) return null;

	let locator: string | null = null;
	let label: string;
	let pagesRaw: string;

	if (parts.length === 2) {
		label = parts[0]!.trim();
		pagesRaw = parts[1]!.trim();
	} else {
		locator = parts[0]!.trim() || null;
		label = parts[1]!.trim();
		pagesRaw = parts[2]!.trim();
	}

	if (!label) return null;
	const pageMatch = pagesRaw.match(/(\d{1,5})\s*[-–—]?\s*(\d{1,5})?/);
	if (!pageMatch) return null;
	const pageStart = Number(pageMatch[1]);
	const pageEnd = pageMatch[2] != null ? Number(pageMatch[2]) : pageStart;
	if (!Number.isFinite(pageStart) || !Number.isFinite(pageEnd) || pageEnd < pageStart) {
		return null;
	}
	return { locator, label, pageStart, pageEnd };
}

export function parseOutlineTsv(text: string): {
	rows: { locator: string | null; label: string; pageStart: number; pageEnd: number }[];
	skipped: number;
} {
	const rows: { locator: string | null; label: string; pageStart: number; pageEnd: number }[] =
		[];
	let skipped = 0;
	for (const line of text.split(/\r?\n/)) {
		if (!line.trim()) continue;
		const parsed = parseOutlineTsvLine(line);
		if (!parsed) {
			skipped += 1;
			continue;
		}
		rows.push(parsed);
	}
	return { rows, skipped };
}
