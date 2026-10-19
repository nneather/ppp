/**
 * Curated passage sections as study import books + footnote page prefill.
 *
 * A section attaches the book (bibliography stays book XOR essay). Commentary
 * coverage wins for the same book, so that book is not offered again here.
 * An index hit does not remove a section candidate and is not itself a candidate.
 * When several sections overlap, the footnote page is the tightest span.
 */
import { assignPassageBands } from '$lib/library/passage-search-bands';
import { formatScriptureRefPageSummary } from '$lib/library/scripture-ref-format';
import type { ImportCandidate } from '$lib/studies/import-suggest';

export const PASSAGE_SECTION_IMPORT_KEY = 'sections';
export const PASSAGE_SECTION_GROUP_NAME = 'On this passage';

export type OverlappingSection = {
	bookId: string;
	title: string;
	label: string | null;
	pageStart: string;
	pageEnd: string | null;
	verseStartAbs: number;
	verseEndAbs: number;
};

export function sectionAbsSpan(section: { verseStartAbs: number; verseEndAbs: number }): number {
	return Math.max(0, section.verseEndAbs - section.verseStartAbs);
}

/** Smallest biblical span. Equal spans keep the earlier item. */
export function tightestOverlappingSection<T extends { verseStartAbs: number; verseEndAbs: number }>(
	sections: readonly T[]
): T | null {
	let best: T | null = null;
	let bestSpan = Infinity;
	for (const section of sections) {
		const span = sectionAbsSpan(section);
		if (span < bestSpan) {
			best = section;
			bestSpan = span;
		}
	}
	return best;
}

/** Page box text. The footnote formatter strips a leading "p." */
export function footnotePageFromSection(
	pageStart: string | null | undefined,
	pageEnd: string | null | undefined
): string {
	const start = pageStart?.trim() ?? '';
	if (!start) return '';
	const end = pageEnd?.trim() ?? '';
	if (end && end !== start) return `${start}–${end}`;
	return start;
}

export function footnotePagesByBook(sections: readonly OverlappingSection[]): Record<string, string> {
	const byBook = new Map<string, OverlappingSection[]>();
	for (const section of sections) {
		const list = byBook.get(section.bookId) ?? [];
		list.push(section);
		byBook.set(section.bookId, list);
	}
	const out: Record<string, string> = {};
	for (const [bookId, list] of byBook) {
		const tight = tightestOverlappingSection(list);
		if (!tight) continue;
		const page = footnotePageFromSection(tight.pageStart, tight.pageEnd);
		if (page) out[bookId] = page;
	}
	return out;
}

function sectionHint(section: OverlappingSection): string | null {
	const page = formatScriptureRefPageSummary(section.pageStart, section.pageEnd);
	const label = section.label?.trim() ?? '';
	const hint = [label, page].filter((part): part is string => !!part && part.length > 0).join(' · ');
	return hint || null;
}

/**
 * One book row per overlapping section book. Commentary coverage is omitted.
 * `indexBookIds` are passed through band assignment so an index hit cannot
 * drop the section row; index-only books are not candidates.
 */
export function passageSectionImportCandidates(
	sections: readonly OverlappingSection[],
	coverages: readonly { bookId: string; genre: string | null }[],
	indexBookIds: readonly (string | null)[] = []
): ImportCandidate[] {
	const bands = assignPassageBands({
		coverages: coverages.map((row) => ({ bookId: row.bookId, genre: row.genre })),
		sections: sections.map((section) => ({ bookId: section.bookId })),
		indexHits: indexBookIds.map((bookId) => ({ bookId }))
	});

	const byBook = new Map<string, OverlappingSection[]>();
	for (const section of sections) {
		if (!bands.sectionBookIds.has(section.bookId)) continue;
		const list = byBook.get(section.bookId) ?? [];
		list.push(section);
		byBook.set(section.bookId, list);
	}

	const books = [...byBook.entries()].sort((a, b) =>
		(a[1][0]?.title ?? '').localeCompare(b[1][0]?.title ?? '', undefined, { sensitivity: 'base' })
	);

	const out: ImportCandidate[] = [];
	for (const [bookId, list] of books) {
		const tight = tightestOverlappingSection(list);
		if (!tight) continue;
		out.push({
			bookId,
			essayId: null,
			title: tight.title.trim() || 'Untitled',
			notes: null,
			hint: sectionHint(tight)
		});
	}
	return out;
}
