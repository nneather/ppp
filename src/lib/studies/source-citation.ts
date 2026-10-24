import {
	formatBibliography,
	formatEssayBibliography,
	formatEssayFootnote,
	formatFootnote,
	formatJournalArticleBibliography,
	formatJournalArticleFootnote,
	type CitationFormatted
} from '$lib/library/turabian';
import type { PaperSourceView } from './paper-sources';

/** Footnote for one study source. A typed page replaces the article's stored span. */
export function studySourceFootnote(source: PaperSourceView, page?: string): CitationFormatted {
	const opts = { page: page?.trim() || undefined };
	if (source.kind === 'book') return formatFootnote(source.citation, opts);
	if (source.kind === 'essay') return formatEssayFootnote(source.essay, source.volume, opts);
	return formatJournalArticleFootnote(source.article, opts);
}

export function studySourceShortForm(source: PaperSourceView, page?: string): CitationFormatted {
	const opts = { page: page?.trim() || undefined, shortForm: 'short' as const };
	if (source.kind === 'book') return formatFootnote(source.citation, opts);
	if (source.kind === 'essay') return formatEssayFootnote(source.essay, source.volume, opts);
	return formatJournalArticleFootnote(source.article, opts);
}

/** Bibliography ignores the page box. Articles use the journal form, not a book cite. */
export function studySourceBibliography(source: PaperSourceView): CitationFormatted {
	if (source.kind === 'book') return formatBibliography(source.citation);
	if (source.kind === 'essay') return formatEssayBibliography(source.essay, source.volume);
	return formatJournalArticleBibliography(source.article);
}
