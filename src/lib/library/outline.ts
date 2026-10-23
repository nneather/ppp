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

export type OutlineTreeNode = OutlineSectionInput & {
	children: OutlineTreeNode[];
};

const CHAPTER_LOCATOR = /^(X|IX|VIII|VII|VI|V|IV|III|II|I)\.(\d+)$/i;

/** `I.13` belongs under the book heading `I`. `I` and `I.13.7` do not. */
export function chapterBookLocator(locator: string | null | undefined): string | null {
	if (locator == null) return null;
	const match = locator.trim().match(CHAPTER_LOCATOR);
	return match ? match[1]!.toUpperCase() : null;
}

/**
 * Nest outline rows for the book-detail list. An explicit `parent_id` wins.
 * A chapter such as `I.1` with no parent nests under the book heading `I`
 * on the same book (Calvin). A missing parent becomes a root so the row
 * still shows. A cycle is broken by treating the first unseen row as a root.
 */
export function buildOutlineTree(sections: readonly OutlineSectionInput[]): OutlineTreeNode[] {
	const ids = new Set(sections.map((section) => section.id));
	const bookHeadingId = new Map<string, string>();
	for (const section of sections) {
		const book = bookLevelLocator(section.locator);
		if (!book) continue;
		const key = `${section.book_id}:${book}`;
		if (!bookHeadingId.has(key)) bookHeadingId.set(key, section.id);
	}

	function parentIdFor(section: OutlineSectionInput): string | null {
		if (
			section.parent_id &&
			ids.has(section.parent_id) &&
			section.parent_id !== section.id
		) {
			return section.parent_id;
		}
		const book = chapterBookLocator(section.locator);
		if (!book) return null;
		const headingId = bookHeadingId.get(`${section.book_id}:${book}`);
		if (!headingId || headingId === section.id) return null;
		return headingId;
	}

	const byParent = new Map<string | null, OutlineSectionInput[]>();
	for (const section of sections) {
		const parent = parentIdFor(section);
		const list = byParent.get(parent) ?? [];
		list.push(section);
		byParent.set(parent, list);
	}
	for (const list of byParent.values()) {
		list.sort((a, b) => a.sort_order - b.sort_order || a.page_start - b.page_start);
	}

	const seen = new Set<string>();
	function build(parentId: string | null, stack: Set<string>): OutlineTreeNode[] {
		const nodes: OutlineTreeNode[] = [];
		for (const section of byParent.get(parentId) ?? []) {
			if (stack.has(section.id)) continue;
			stack.add(section.id);
			seen.add(section.id);
			nodes.push({ ...section, children: build(section.id, stack) });
			stack.delete(section.id);
		}
		return nodes;
	}

	const roots = build(null, new Set());
	for (const section of sections) {
		if (seen.has(section.id)) continue;
		const stack = new Set<string>([section.id]);
		seen.add(section.id);
		roots.push({ ...section, children: build(section.id, stack) });
	}
	return roots;
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

/** Biblical range on a systematic index hit. Book name is omitted from the label. */
export type SystematicVerseBounds = {
	bibleBook: string;
	chapterStart: number | null;
	verseStart: number | null;
	chapterEnd: number | null;
	verseEnd: number | null;
};

export type SystematicHitInput = SystematicVerseBounds & {
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

export type SystematicPointer = SystematicVerseBounds & {
	refId: string;
	bookId: string;
	volume: string | null;
	pageStart: string;
	pageEnd: string | null;
	locator: string | null;
	label: string | null;
	/** Compact range: `7:14`, `7:1–6`, `7`, `7:29–8:1`. */
	verseLabel: string;
	/** Start verse, then end verse. Whole-book hits sort first. */
	verseSort: number;
	display: string;
};

export type SystematicSetBlock = {
	seriesId: string | null;
	seriesName: string;
	authorLabel: string | null;
	/** Tight span of every pointer in the set, e.g. `7:1–29`. */
	verseSpan: string;
	pointers: SystematicPointer[];
	/** Hit count. Equals `pointers.length` when every pointer was sent. */
	pointerCount: number;
	/** Pointers were omitted because the passage has too many hits. */
	deferred?: boolean;
	/** Lone book (no series) so a deferred card can refetch one volume. */
	bookId?: string | null;
};

/** One index hit flattened for the by-verse view, with its set name. */
export type SystematicVerseRow = SystematicPointer & {
	seriesId: string | null;
	seriesName: string;
	authorLabel: string | null;
};

export type SystematicVerseGroup = {
	verseLabel: string;
	verseSort: number;
	rows: SystematicVerseRow[];
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

/**
 * Reading order under a verse. Matched on series name or author so a set
 * with no hit on that verse is simply absent.
 * Unknown systematics sort after these, alphabetically.
 */
function systematicReadingRank(seriesName: string, authorLabel: string | null): number {
	const hay = `${seriesName} ${authorLabel ?? ''}`.toLowerCase();
	if (hay.includes('calvin')) return 0;
	if (hay.includes('bavinck')) return 1;
	if (hay.includes('mastricht')) return 2;
	if (hay.includes('turretin')) return 3;
	if (hay.includes('synopsis') || hay.includes('leiden') || hay.includes('purer theology')) {
		return 4;
	}
	return 100;
}

function compareVerseRows(a: SystematicVerseRow, b: SystematicVerseRow): number {
	const rank =
		systematicReadingRank(a.seriesName, a.authorLabel) -
		systematicReadingRank(b.seriesName, b.authorLabel);
	if (rank !== 0) return rank;
	const name = a.seriesName.localeCompare(b.seriesName);
	if (name !== 0) return name;
	const volume = volumeSortKey(a.volume) - volumeSortKey(b.volume);
	if (volume !== 0) return volume;
	const page = pointerOrderKey(a.pageStart, a.pageEnd) - pointerOrderKey(b.pageStart, b.pageEnd);
	if (page !== 0) return page;
	return a.display.localeCompare(b.display);
}

function verseStartAbs(input: SystematicVerseBounds): number {
	if (input.chapterStart == null) return 0;
	return input.chapterStart * 1000 + (input.verseStart ?? 0);
}

function verseEndAbs(input: SystematicVerseBounds): number {
	if (input.chapterStart == null) return 999_999;
	const endChapter = input.chapterEnd ?? input.chapterStart;
	if (input.verseStart == null && input.verseEnd == null) {
		return endChapter * 1000 + 999;
	}
	const endVerse = input.verseEnd ?? input.verseStart ?? 999;
	return endChapter * 1000 + endVerse;
}

/** Start verse, then end verse. Whole-book hits sort first. */
export function systematicVerseSortKey(input: SystematicVerseBounds): number {
	return verseStartAbs(input) * 1_000_000 + verseEndAbs(input);
}

/**
 * Compact passage label without the book name.
 * `7:14`, `7:1–6`, `7`, `7–8`, `7:29–8:1`. A whole-book hit uses the book name.
 */
export function formatSystematicVerseLabel(input: SystematicVerseBounds): string {
	const cs = input.chapterStart;
	const vs = input.verseStart;
	const ce = input.chapterEnd;
	const ve = input.verseEnd;
	if (cs == null) {
		const book = input.bibleBook.trim();
		return book || 'whole book';
	}
	const sameChapter = ce == null || ce === cs;
	if (sameChapter) {
		if (vs == null) return String(cs);
		if (ve == null || ve === vs) return `${cs}:${vs}`;
		return `${cs}:${vs}–${ve}`;
	}
	const start = vs != null ? `${cs}:${vs}` : String(cs);
	const end = ve != null ? `${ce}:${ve}` : String(ce);
	return `${start}–${end}`;
}

/** Tight span covering every bound: `7:1` and `7:29` → `7:1–29`. */
export function formatSystematicVerseSpan(items: SystematicVerseBounds[]): string {
	const first = items[0];
	if (!first) return '';
	let minStart = verseStartAbs(first);
	let maxEnd = verseEndAbs(first);
	let book = first.bibleBook;
	for (const item of items) {
		const start = verseStartAbs(item);
		const end = verseEndAbs(item);
		if (start < minStart) minStart = start;
		if (end > maxEnd) maxEnd = end;
		if (!book.trim() && item.bibleBook.trim()) book = item.bibleBook;
	}
	if (minStart === 0) {
		return formatSystematicVerseLabel({
			bibleBook: book,
			chapterStart: null,
			verseStart: null,
			chapterEnd: null,
			verseEnd: null
		});
	}
	const chapterStart = Math.floor(minStart / 1000);
	const startVerse = minStart % 1000;
	const chapterEnd = Math.floor(maxEnd / 1000);
	const endVerse = maxEnd % 1000;
	return formatSystematicVerseLabel({
		bibleBook: book,
		chapterStart,
		verseStart: startVerse === 0 ? null : startVerse,
		chapterEnd,
		verseEnd: endVerse === 999 ? null : endVerse
	});
}

function pointerFromHit(h: SystematicHitInput): SystematicPointer {
	const bounds: SystematicVerseBounds = {
		bibleBook: h.bibleBook,
		chapterStart: h.chapterStart,
		verseStart: h.verseStart,
		chapterEnd: h.chapterEnd,
		verseEnd: h.verseEnd
	};
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
		...bounds,
		verseLabel: formatSystematicVerseLabel(bounds),
		verseSort: systematicVerseSortKey(bounds),
		display: formatSystematicPointerDisplay({
			volume: h.volumeNumber,
			pageStart,
			pageEnd,
			locator,
			label
		})
	};
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
 * Group systematic-theology index hits by series (or lone book title).
 * Pointers inside a set read down the passage, then by volume and page.
 */
export function groupSystematicHits(
	hits: SystematicHitInput[],
	opts?: { omitPointers?: boolean }
): SystematicSetBlock[] {
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
			const verse = systematicVerseSortKey(a) - systematicVerseSortKey(b);
			if (verse !== 0) return verse;
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
		const pointers = list.map((h) => pointerFromHit(h));

		blocks.push({
			seriesId: first.seriesId,
			seriesName,
			authorLabel: first.authorLabel,
			verseSpan: formatSystematicVerseSpan(pointers),
			pointers: opts?.omitPointers ? [] : pointers,
			pointerCount: pointers.length,
			deferred: opts?.omitPointers === true,
			bookId: first.seriesId ? null : first.bookId
		});
	}

	blocks.sort((a, b) => a.seriesName.localeCompare(b.seriesName));
	return blocks;
}

/**
 * Regroup set blocks by the biblical verse each hit covers.
 * Groups run down the passage. Rows inside a verse follow the reading order
 * (Calvin, Bavinck, van Mastricht, Turretin, Leiden), then volume and page.
 */
export function groupSystematicPointersByVerse(
	blocks: SystematicSetBlock[]
): SystematicVerseGroup[] {
	const byLabel = new Map<string, SystematicVerseRow[]>();
	for (const block of blocks) {
		for (const pointer of block.pointers) {
			const row: SystematicVerseRow = {
				...pointer,
				seriesId: block.seriesId,
				seriesName: block.seriesName,
				authorLabel: block.authorLabel
			};
			const list = byLabel.get(pointer.verseLabel) ?? [];
			list.push(row);
			byLabel.set(pointer.verseLabel, list);
		}
	}

	const groups: SystematicVerseGroup[] = [];
	for (const [verseLabel, rows] of byLabel) {
		rows.sort(compareVerseRows);
		groups.push({
			verseLabel,
			verseSort: rows.reduce((min, row) => Math.min(min, row.verseSort), rows[0]!.verseSort),
			rows
		});
	}
	groups.sort((a, b) => a.verseSort - b.verseSort || a.verseLabel.localeCompare(b.verseLabel));
	return groups;
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
