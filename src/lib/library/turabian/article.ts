import { formatEditorsNote } from './names';
import { formatPublicationFacts, formatTitleWithSubtitle } from './publication';
import type { BookCitationInput, CitationFormatted } from './types';

/** Essay / dictionary article row (parent volume is the reference work). */
export type EssayCitationInput = {
	essay_title: string;
	page_start?: number | null;
	page_end?: number | null;
};

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function pageSegment(essay: EssayCitationInput): string {
	const start = essay.page_start;
	if (start == null) return '';
	const end = essay.page_end;
	if (end != null && end !== start) return `${start}–${end}`;
	return String(start);
}

/**
 * Turabian dictionary / encyclopedia article (s.v.) — minimum viable wedge for ABD/TDNT-style volumes.
 * @see Turabian §14.112 (well-known reference works).
 */
export function formatEssayFootnote(
	essay: EssayCitationInput,
	volume: BookCitationInput,
	opts?: { page?: string }
): CitationFormatted {
	const article = essay.essay_title.trim();
	const volTitle = formatTitleWithSubtitle(volume, 'plain');
	const editors = formatEditorsNote(volume.authors);
	const pub = formatPublicationFacts(volume, 'note');
	const page =
		opts?.page?.trim() ||
		pageSegment(essay) ||
		(essay.page_start != null ? String(essay.page_start) : '[page]');

	const leadParts: string[] = [];
	if (editors) leadParts.push(editors);
	leadParts.push(volTitle);
	const lead = leadParts.join(', ');

	const plain = `${article}, in ${lead}, s.v. "${article}," ${page}.`;
	const html = `${escapeHtml(article)}, in ${escapeHtml(lead)}, s.v. &ldquo;${escapeHtml(article)},&rdquo; ${escapeHtml(page)}.`;

	return { plain, html, sourceType: 'reference-work-edited' };
}
