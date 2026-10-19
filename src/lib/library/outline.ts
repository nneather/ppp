/**
 * Pure helpers for systematics-by-passage: parse index page tokens, resolve
 * TOC outline labels for a page, and group hits by set ([252]).
 */

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
	return {
		id: best.id,
		locator: best.locator,
		label: best.label,
		page_start: best.page_start,
		page_end: best.page_end
	};
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

/** Format one pointer line: `2:620 (XV.17 Full Assurance)` or `p. 136 (Repentance)`. */
export function formatSystematicPointerDisplay(input: {
	volume: string | null;
	pageStart: string;
	pageEnd: string | null;
	locator: string | null;
	label: string | null;
}): string {
	const { volume, pageStart, pageEnd, locator, label } = input;
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
			const pa = pageNumberFromText(a.pageStart) ?? 0;
			const pb = pageNumberFromText(b.pageStart) ?? 0;
			return pa - pb;
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
