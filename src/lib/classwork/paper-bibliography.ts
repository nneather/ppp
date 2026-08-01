/**
 * Paper-scoped compiled bibliography ([188]): flat Turabian alpha, books and
 * essays merged, research groups ignored. Library's
 * `formatCompiledBibliography` is books-only, so the merge + shared sort key
 * live here rather than widening the library helper.
 */
import {
	bibliographySortKey,
	bibliographySortLastName,
	formatBibliography,
	formatEssayBibliography,
	type BibliographySortKey,
	type CitationFormatted
} from '$lib/library/turabian';
import type { PaperSourceView } from './paper-sources';

function essaySortKey(source: Extract<PaperSourceView, { kind: 'essay' }>): BibliographySortKey {
	return {
		lastName: bibliographySortLastName(source.essay.authors ?? []),
		year: source.volume.year ?? source.volume.reprint_year ?? source.volume.original_year,
		title: source.essay.essay_title.toLowerCase()
	};
}

function compareSortKeys(a: BibliographySortKey, b: BibliographySortKey): number {
	const last = a.lastName.localeCompare(b.lastName);
	if (last !== 0) return last;
	const ya = a.year ?? 0;
	const yb = b.year ?? 0;
	if (ya !== yb) return ya - yb;
	return a.title.localeCompare(b.title);
}

/**
 * Sorted, non-empty entries. Unsigned essays format to an empty bibliography
 * entry and are dropped (they are note-only citations, e.g. BDAG s.v.).
 */
export function formatPaperBibliographyEntries(sources: PaperSourceView[]): CitationFormatted[] {
	return sources
		.map((s) =>
			s.kind === 'book'
				? { key: bibliographySortKey(s.citation), entry: formatBibliography(s.citation) }
				: { key: essaySortKey(s), entry: formatEssayBibliography(s.essay, s.volume) }
		)
		.sort((a, b) => compareSortKeys(a.key, b.key))
		.map((k) => k.entry)
		.filter((e) => e.plain.length > 0);
}

export function compilePaperBibliography(sources: PaperSourceView[]): CitationFormatted {
	const entries = formatPaperBibliographyEntries(sources);
	return {
		plain: entries.map((e) => e.plain).join('\n\n'),
		html: entries.map((e) => `<p>${e.html}</p>`).join('\n'),
		sourceType: entries[0]?.sourceType ?? 'single-author-book'
	};
}
