/**
 * Study-scoped compiled bibliography ([188], sectioned export [248]): flat
 * Turabian alpha by default, books, essays, and journal articles merged. Research groups are
 * ignored until `sectionPaperBibliography` / `compileSectionedBibliography`.
 * Library's `formatCompiledBibliography` is books-only, so the merge + shared
 * sort key live here rather than widening the library helper.
 */
import { titleSortKey } from '$lib/library/title-sort';
import {
	bibliographySortKey,
	bibliographySortLastName,
	formatBibliography,
	formatEssayBibliography,
	formatJournalArticleBibliography,
	type BibliographySortKey,
	type CitationFormatted
} from '$lib/library/turabian';
import { groupPaperSources, type PaperGroupView, type PaperSourceView } from './paper-sources';
import { includeInCompiledBibliography } from './source-usage';

export type BibliographySection = {
	/** Null for sources that are not in a research group. */
	heading: string | null;
	entries: CitationFormatted[];
};

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function scopedSources(
	sources: PaperSourceView[],
	includeCandidates: boolean
): PaperSourceView[] {
	return sources.filter((s) => includeInCompiledBibliography(s.usage, includeCandidates));
}

function essaySortKey(source: Extract<PaperSourceView, { kind: 'essay' }>): BibliographySortKey {
	return {
		lastName: bibliographySortLastName(source.essay.authors ?? []),
		year: source.volume.year ?? source.volume.reprint_year ?? source.volume.original_year,
		title: titleSortKey(source.essay.essay_title)
	};
}

function articleSortKey(source: Extract<PaperSourceView, { kind: 'article' }>): BibliographySortKey {
	return {
		lastName: bibliographySortLastName(source.article.authors),
		year: source.article.year ?? null,
		title: titleSortKey(source.article.title)
	};
}

function bibliographyEntry(source: PaperSourceView): {
	key: BibliographySortKey;
	entry: CitationFormatted;
} {
	switch (source.kind) {
		case 'book':
			return { key: bibliographySortKey(source.citation), entry: formatBibliography(source.citation) };
		case 'essay':
			return { key: essaySortKey(source), entry: formatEssayBibliography(source.essay, source.volume) };
		case 'article':
			return {
				key: articleSortKey(source),
				entry: formatJournalArticleBibliography(source.article)
			};
	}
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
	const entries = sources.map((s) => bibliographyEntry(s))
		.sort((a, b) => compareSortKeys(a.key, b.key))
		.map((k) => k.entry)
		.filter((e) => e.plain.length > 0);
	// Commentary parts share one volume bibliography. Citing Proverbs and
	// Ecclesiastes from the same volume should list that volume once.
	const seen = new Set<string>();
	return entries.filter((e) => {
		if (seen.has(e.plain)) return false;
		seen.add(e.plain);
		return true;
	});
}

export function compilePaperBibliography(
	sources: PaperSourceView[],
	opts?: { includeCandidates?: boolean }
): CitationFormatted {
	const entries = formatPaperBibliographyEntries(
		scopedSources(sources, opts?.includeCandidates === true)
	);
	return {
		plain: entries.map((e) => e.plain).join('\n\n'),
		html: entries.map((e) => `<p>${e.html}</p>`).join('\n'),
		sourceType: entries[0]?.sourceType ?? 'single-author-book'
	};
}

/**
 * One section per non-empty research group, in group order. Ungrouped sources
 * lead, with no heading. Entries sort within the section. The same volume in
 * two groups is listed twice; duplicates inside one section collapse.
 */
export function sectionPaperBibliography(
	sources: PaperSourceView[],
	groups: PaperGroupView[],
	opts?: { includeCandidates?: boolean }
): BibliographySection[] {
	const buckets = groupPaperSources(
		scopedSources(sources, opts?.includeCandidates === true),
		groups
	);
	const sections: BibliographySection[] = [];
	for (const bucket of buckets) {
		const entries = formatPaperBibliographyEntries(bucket.sources);
		if (entries.length === 0) continue;
		sections.push({ heading: bucket.group?.name ?? null, entries });
	}
	return sections;
}

export function compileSectionedBibliography(
	sources: PaperSourceView[],
	groups: PaperGroupView[],
	opts?: { includeCandidates?: boolean }
): CitationFormatted {
	const sections = sectionPaperBibliography(sources, groups, opts);
	const plain: string[] = [];
	const html: string[] = [];
	for (const section of sections) {
		if (section.heading) {
			plain.push(section.heading);
			html.push(`<p><strong>${escapeHtml(section.heading)}</strong></p>`);
		}
		for (const entry of section.entries) {
			plain.push(entry.plain);
			html.push(`<p>${entry.html}</p>`);
		}
	}
	return {
		plain: plain.join('\n\n'),
		html: html.join('\n'),
		sourceType: sections[0]?.entries[0]?.sourceType ?? 'single-author-book'
	};
}

/** ASCII slug for `Content-Disposition`. Falls back when the lead has no letters. */
export function bibliographyDownloadName(lead: string): string {
	const slug = lead
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
	return `${slug || 'study'}-bibliography.docx`;
}
