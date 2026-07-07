import type { BookAuthorAssignment } from '$lib/types/library';
import {
	formatAuthorsBibliography,
	formatAuthorsNote,
	formatEditorsInlineBibliography,
	formatEditorsNote
} from './names';
import { formatPublicationFacts, formatTitleWithSubtitle } from './publication';
import type { BookCitationInput, CitationFormatted, CitationSourceType } from './types';

import type { EssayRow } from '$lib/types/library';

/** Essay / dictionary article row (parent volume is the reference work). */
export type EssayCitationInput = {
	essay_title: string;
	page_start?: number | null;
	page_end?: number | null;
	/** Article-level authors — Session 1 formatters; optional in Phase 0 fixtures. */
	authors?: BookAuthorAssignment[];
};

/** Map a hydrated essay row to formatter input (unsigned when authors empty). */
export function essayRowToCitationInput(row: EssayRow): EssayCitationInput {
	return {
		essay_title: row.essay_title,
		page_start: row.page_start,
		page_end: row.page_end,
		authors: row.authors.length > 0 ? row.authors : undefined
	};
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function quotedTitle(article: string, mode: 'plain' | 'html'): string {
	if (mode === 'html') {
		return `&ldquo;${escapeHtml(article)},&rdquo;`;
	}
	return `"${article},"`;
}

function quotedTitleBib(article: string, mode: 'plain' | 'html'): string {
	if (mode === 'html') {
		return `&ldquo;${escapeHtml(article)}.&rdquo;`;
	}
	return `"${article}."`;
}

function pageSegment(essay: EssayCitationInput, opts?: { page?: string }): string {
	const fromOpts = opts?.page?.trim();
	if (fromOpts) return fromOpts.replace(/^p\.?\s*/i, '');
	const start = essay.page_start;
	if (start == null) return '[page]';
	const end = essay.page_end;
	if (end != null && end !== start) return `${start}–${end}`;
	return String(start);
}

function hasEssayAuthors(essay: EssayCitationInput): boolean {
	return (essay.authors?.length ?? 0) > 0;
}

/** TDNT-style `Author, "Article," ABBR vol:page.` — not full signed-dictionary `in editor, ed., … s.v.` */
function volumeUsesAbbreviatedArticleCite(volume: BookCitationInput): boolean {
	const abbr = (volume.series_abbreviation ?? '').trim();
	if (!abbr) return false;
	return volume.authors.some((a) => a.role === 'translator');
}

function volumeLabelPlain(volume: BookCitationInput): string {
	const abbr = (volume.series_abbreviation ?? '').trim();
	if (abbr) return abbr;
	return formatTitleWithSubtitle(volume, 'plain');
}

function resolveEssaySourceType(volume: BookCitationInput): CitationSourceType {
	if (volume.work_type === 'edited_volume') return 'edited-volume';
	if (volume.work_type === 'reference_work') {
		const editors = volume.authors.filter((a) => a.role === 'editor');
		if (editors.length > 0 && volume.authors.filter((a) => a.role === 'author').length === 0) {
			return 'reference-work-edited';
		}
		return 'reference-work-single-author';
	}
	return 'edited-volume';
}

/** Unsigned well-known reference: `BDAG, s.v. "ἀγάπη," 12.` */
function formatUnsignedSvFootnote(
	essay: EssayCitationInput,
	volume: BookCitationInput,
	page: string,
	sourceType: CitationSourceType
): CitationFormatted {
	const article = essay.essay_title.trim();
	const label = volumeLabelPlain(volume);
	const plain = `${label}, s.v. ${quotedTitle(article, 'plain')} ${page}.`;
	const html = `${escapeHtml(label)}, s.v. ${quotedTitle(article, 'html')} ${escapeHtml(page)}.`;
	return { plain, html, sourceType };
}

/** TDNT-style abbreviated article: `Kittel, "λέγω," TDNT 4:100.` */
function formatAbbreviatedArticleFootnote(
	essay: EssayCitationInput,
	volume: BookCitationInput,
	page: string,
	sourceType: CitationSourceType
): CitationFormatted {
	const article = essay.essay_title.trim();
	const author = formatAuthorsNote(essay.authors!);
	const abbr = (volume.series_abbreviation ?? '').trim();
	const vol = (volume.volume_number ?? '').trim();
	const volPage = vol ? `${vol}:${page}` : page;
	const plain = `${author}, ${quotedTitle(article, 'plain')} ${abbr} ${volPage}.`;
	const html = `${escapeHtml(author)}, ${quotedTitle(article, 'html')} ${escapeHtml(abbr)} ${escapeHtml(volPage)}.`;
	return { plain, html, sourceType };
}

/** Signed dictionary article (ABD): author + in editor ed. + volume + s.v. */
function formatSignedDictionaryFootnote(
	essay: EssayCitationInput,
	volume: BookCitationInput,
	page: string,
	sourceType: CitationSourceType
): CitationFormatted {
	const article = essay.essay_title.trim();
	const author = formatAuthorsNote(essay.authors!);
	const editors = formatEditorsNote(volume.authors);
	const volTitle = formatTitleWithSubtitle(volume, 'plain');
	const volTitleHtml = formatTitleWithSubtitle(volume, 'html');
	const pub = formatPublicationFacts(volume, 'note');
	const inLead = [editors, volTitle].filter(Boolean).join(', ');
	const pubPart = pub.plain ? ` ${pub.plain}` : '';
	const plain = `${author}, ${quotedTitle(article, 'plain')} in ${inLead}${pubPart}, s.v. ${quotedTitle(article, 'plain')} ${page}.`;
	const htmlInLead = editors ? `${escapeHtml(editors)}, ${volTitleHtml}` : volTitleHtml;
	const html = `${escapeHtml(author)}, ${quotedTitle(article, 'html')} in ${htmlInLead}${pub.html ? ` ${pub.html}` : ''}, s.v. ${quotedTitle(article, 'html')} ${escapeHtml(page)}.`;
	return { plain, html, sourceType };
}

/** Chapter in edited volume: author + in editors eds. + volume (pub), page. */
function formatChapterFootnote(
	essay: EssayCitationInput,
	volume: BookCitationInput,
	page: string,
	sourceType: CitationSourceType
): CitationFormatted {
	const article = essay.essay_title.trim();
	const author = formatAuthorsNote(essay.authors!);
	const editors = formatEditorsNote(volume.authors);
	const volTitle = formatTitleWithSubtitle(volume, 'plain');
	const pub = formatPublicationFacts(volume, 'note');
	const inLead = [editors, volTitle].filter(Boolean).join(', ');
	const pubPart = pub.plain ? ` ${pub.plain}` : '';
	const plain = `${author}, ${quotedTitle(article, 'plain')} in ${inLead}${pubPart}, ${page}.`;
	const volTitleHtml = formatTitleWithSubtitle(volume, 'html');
	const inPrefix = editors ? `${escapeHtml(editors)}, ` : '';
	const html = `${escapeHtml(author)}, ${quotedTitle(article, 'html')} in ${inPrefix}${volTitleHtml}${pub.html ? ` ${pub.html}` : ''}, ${escapeHtml(page)}.`;
	return { plain, html, sourceType };
}

/**
 * Turabian dictionary / encyclopedia article or chapter in edited volume.
 * @see Turabian §14.112 (well-known reference works), §17.1.8 (chapters).
 */
export function formatEssayFootnote(
	essay: EssayCitationInput,
	volume: BookCitationInput,
	opts?: { page?: string }
): CitationFormatted {
	const page = pageSegment(essay, opts);
	const sourceType = resolveEssaySourceType(volume);

	if (!hasEssayAuthors(essay)) {
		return formatUnsignedSvFootnote(essay, volume, page, sourceType);
	}

	if (volume.work_type === 'reference_work' && volumeUsesAbbreviatedArticleCite(volume)) {
		return formatAbbreviatedArticleFootnote(essay, volume, page, sourceType);
	}

	if (volume.work_type === 'reference_work') {
		return formatSignedDictionaryFootnote(essay, volume, page, sourceType);
	}

	return formatChapterFootnote(essay, volume, page, sourceType);
}

/**
 * Turabian bibliography entry for a signed essay/chapter. Unsigned reference-work
 * articles (e.g. BDAG s.v.) return empty — well-known works omit bib entries.
 */
export function formatEssayBibliography(
	essay: EssayCitationInput,
	volume: BookCitationInput
): CitationFormatted {
	const sourceType = resolveEssaySourceType(volume);

	if (!hasEssayAuthors(essay)) {
		return { plain: '', html: '', sourceType };
	}

	const article = essay.essay_title.trim();
	const authorBib = formatAuthorsBibliography(essay.authors!);
	const authorLead = authorBib.endsWith('.') ? authorBib : `${authorBib}.`;
	const volTitle = formatTitleWithSubtitle(volume, 'plain');
	const volTitleHtml = formatTitleWithSubtitle(volume, 'html');
	const editors = formatEditorsInlineBibliography(volume.authors);
	const pub = formatPublicationFacts(volume, 'bib');

	const isChapter = volume.work_type === 'edited_volume';
	const page = pageSegment(essay);

	let plain = `${authorLead} ${quotedTitleBib(article, 'plain')} In ${volTitle}`;
	let html = `${escapeHtml(authorLead)} ${quotedTitleBib(article, 'html')} In ${volTitleHtml}`;

	if (editors) {
		plain += `, ${editors}`;
		html += `, ${escapeHtml(editors)}`;
	}

	if (isChapter && page !== '[page]') {
		plain += `, ${page}`;
		html += `, ${escapeHtml(page)}`;
	}

	plain += '.';
	html += '.';

	if (pub.plain) {
		const pubPlain = pub.plain.endsWith('.') ? pub.plain : `${pub.plain}.`;
		plain += ` ${pubPlain}`;
		html += ` ${pub.html}`;
	}

	return { plain: plain.replace(/\s+/g, ' ').trim(), html: html.replace(/\s+/g, ' ').trim(), sourceType };
}
