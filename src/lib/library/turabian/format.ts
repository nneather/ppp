import { resolveCitationSourceType } from './dispatch';
import {
	formatAuthorsBibliography,
	formatAuthorsNote,
	formatEditorsBibliography,
	formatEditorsCreditBibliography,
	formatEditorsCreditNote,
	formatEditorsNote,
	formatTranslatorsBibliography,
	formatTranslatorsNote
} from './names';
import {
	formatEditionSegment,
	formatPublicationFacts,
	formatSeriesSegment,
	formatTitleWithSubtitle,
	formatVolumeBibliography,
	formatVolumePageNote
} from './publication';
import type { BookCitationInput, CitationFormatted, CitationSourceType } from './types';

export type FormatOptions = {
	/** Footnote page placeholder when no page supplied. */
	page?: string;
	/** Bible version label for first-citation parenthetical. */
	bibleVersion?: string;
};

type PubFacts = { plain: string; html: string };

type NoteSegments = {
	lead?: string;
	titlePlain: string;
	titleHtml: string;
	editorCredit?: string;
	translator?: string;
	edition?: string;
	series?: string;
	pub: PubFacts;
	volPage?: string;
};

type BibSegments = {
	lead?: string;
	titlePlain: string;
	titleHtml: string;
	editorCredit?: string;
	translator?: string;
	edition?: string;
	volBib?: string;
	series?: string;
	pub: PubFacts;
};

function joinParts(parts: string[], sep: string): string {
	return parts.filter((p) => p.length > 0).join(sep);
}

function escape(s: string): string {
	if (!s) return '';
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function escapeHtml(s: string): string {
	return escape(s);
}

function buildPair(plain: string, html: string, sourceType: CitationSourceType): CitationFormatted {
	return { plain, html, sourceType };
}

/** Turabian §17.1 note order: author, title, credits, edition, series, (pub), page. */
function joinNoteSegments(segments: NoteSegments): { plain: string; html: string } {
	const commaParts: string[] = [];
	if (segments.lead) commaParts.push(segments.lead);
	commaParts.push(segments.titlePlain);
	if (segments.editorCredit) commaParts.push(segments.editorCredit);
	if (segments.translator) commaParts.push(segments.translator);
	if (segments.edition) commaParts.push(segments.edition);

	let plain = commaParts.join(', ');
	let htmlParts: string[] = [];
	if (segments.lead) htmlParts.push(escape(segments.lead));
	htmlParts.push(segments.titleHtml);
	if (segments.editorCredit) htmlParts.push(escape(segments.editorCredit));
	if (segments.translator) htmlParts.push(segments.translator);
	if (segments.edition) htmlParts.push(segments.edition);
	let html = htmlParts.join(', ');

	if (segments.series) {
		plain = `${plain}, ${segments.series}`;
		html = `${html}, ${escape(segments.series)}`;
	}

	if (segments.pub.plain) {
		plain = `${plain} ${segments.pub.plain}`;
		html = `${html} ${segments.pub.html}`;
	}

	if (segments.volPage) {
		plain = `${plain}, ${segments.volPage}`;
		html = `${html}, ${escape(segments.volPage)}`;
	}

	return { plain, html };
}

/** Turabian §17.1 bibliography order: author. title. credits. edition. vol. series. pub. */
function joinBibSegments(segments: BibSegments): { plain: string; html: string } {
	const spaceParts: string[] = [];
	if (segments.lead) spaceParts.push(segments.lead.endsWith('.') ? segments.lead : `${segments.lead}.`);
	spaceParts.push(`${segments.titlePlain}.`);
	if (segments.editorCredit) spaceParts.push(segments.editorCredit);
	if (segments.translator) spaceParts.push(segments.translator);
	if (segments.edition) spaceParts.push(segments.edition);
	if (segments.volBib) spaceParts.push(segments.volBib);
	if (segments.series) spaceParts.push(`${segments.series}.`);

	const pubPlain = segments.pub.plain.endsWith('.') ? segments.pub.plain : segments.pub.plain;
	if (pubPlain) spaceParts.push(pubPlain);

	const plain = spaceParts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

	const htmlParts: string[] = [];
	if (segments.lead) {
		htmlParts.push(segments.lead.endsWith('.') ? escape(segments.lead) : `${escape(segments.lead)}.`);
	}
	htmlParts.push(`${segments.titleHtml}.`);
	if (segments.editorCredit) htmlParts.push(segments.editorCredit);
	if (segments.translator) htmlParts.push(segments.translator);
	if (segments.edition) htmlParts.push(segments.edition);
	if (segments.volBib) htmlParts.push(escape(segments.volBib));
	if (segments.series) htmlParts.push(`${escape(segments.series)}.`);
	if (segments.pub.html) htmlParts.push(segments.pub.html);

	const html = htmlParts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

	return { plain, html };
}

function authorPresentNoteSegments(
	book: BookCitationInput,
	page: string,
	opts?: { includeEditor?: boolean; includeTranslator?: boolean }
): NoteSegments {
	const editorCredit =
		opts?.includeEditor !== false ? formatEditorsCreditNote(book.authors) : undefined;
	const translator =
		opts?.includeTranslator !== false ? formatTranslatorsNote(book.authors) : undefined;
	return {
		lead: formatAuthorsNote(book.authors) || undefined,
		titlePlain: formatTitleWithSubtitle(book, 'plain'),
		titleHtml: formatTitleWithSubtitle(book, 'html'),
		editorCredit: editorCredit || undefined,
		translator: translator || undefined,
		edition: formatEditionSegment(book.edition, 'note') || undefined,
		series: formatSeriesSegment(book, 'note') || undefined,
		pub: formatPublicationFacts(book, 'note'),
		volPage: formatVolumePageNote(book, page) || undefined
	};
}

function authorPresentBibSegments(
	book: BookCitationInput,
	opts?: { includeEditor?: boolean; includeTranslator?: boolean }
): BibSegments {
	const editorCredit =
		opts?.includeEditor !== false ? formatEditorsCreditBibliography(book.authors) : undefined;
	const translator =
		opts?.includeTranslator !== false ? formatTranslatorsBibliography(book.authors) : undefined;
	return {
		lead: formatAuthorsBibliography(book.authors) || undefined,
		titlePlain: formatTitleWithSubtitle(book, 'plain'),
		titleHtml: formatTitleWithSubtitle(book, 'html'),
		editorCredit: editorCredit || undefined,
		translator: translator || undefined,
		edition: formatEditionSegment(book.edition, 'bib') || undefined,
		volBib: formatVolumeBibliography(book) || undefined,
		series: formatSeriesSegment(book, 'bib') || undefined,
		pub: formatPublicationFacts(book, 'bib')
	};
}

export function formatFootnote(book: BookCitationInput, opts?: FormatOptions): CitationFormatted {
	const sourceType = resolveCitationSourceType(book);
	const page = opts?.page ?? '[page]';

	if (sourceType === 'bible') {
		const versionLabel = opts?.bibleVersion ?? 'English Standard Version';
		const version = ` (${versionLabel})`;
		const plain = `${page}${version}.`;
		const html = `${escapeHtml(page)}${escapeHtml(version)}.`;
		return buildPair(plain, html, sourceType);
	}

	let segments: NoteSegments;
	let pair: { plain: string; html: string };

	switch (sourceType) {
		case 'edited-volume':
		case 'reference-work-edited': {
			segments = {
				lead: formatEditorsNote(book.authors),
				titlePlain: formatTitleWithSubtitle(book, 'plain'),
				titleHtml: formatTitleWithSubtitle(book, 'html'),
				edition: formatEditionSegment(book.edition, 'note') || undefined,
				series: formatSeriesSegment(book, 'note') || undefined,
				pub: formatPublicationFacts(book, 'note'),
				volPage: formatVolumePageNote(book, page) || undefined
			};
			pair = joinNoteSegments(segments);
			break;
		}
		case 'book-with-translator': {
			segments = authorPresentNoteSegments(book, page, {
				includeEditor: false,
				includeTranslator: true
			});
			pair = joinNoteSegments(segments);
			break;
		}
		case 'book-with-editor': {
			segments = authorPresentNoteSegments(book, page, {
				includeEditor: true,
				includeTranslator: false
			});
			pair = joinNoteSegments(segments);
			break;
		}
		case 'multi-volume':
		case 'commentary-in-series':
		case 'standalone-commentary':
		case 'reference-work-single-author':
		case 'single-author-book':
		default: {
			segments = authorPresentNoteSegments(book, page);
			pair = joinNoteSegments(segments);
			break;
		}
	}

	let { plain, html } = pair;
	if (!plain.endsWith('.')) plain += '.';
	if (!html.endsWith('.')) html += '.';

	return buildPair(plain, html, sourceType);
}

export function formatBibliography(book: BookCitationInput): CitationFormatted {
	const sourceType = resolveCitationSourceType(book);

	if (sourceType === 'bible') {
		return buildPair('', '', sourceType);
	}

	let segments: BibSegments;
	let pair: { plain: string; html: string };

	switch (sourceType) {
		case 'edited-volume':
		case 'reference-work-edited': {
			segments = {
				lead: formatEditorsBibliography(book.authors),
				titlePlain: formatTitleWithSubtitle(book, 'plain'),
				titleHtml: formatTitleWithSubtitle(book, 'html'),
				edition: formatEditionSegment(book.edition, 'bib') || undefined,
				volBib: formatVolumeBibliography(book) || undefined,
				series: formatSeriesSegment(book, 'bib') || undefined,
				pub: formatPublicationFacts(book, 'bib')
			};
			pair = joinBibSegments(segments);
			break;
		}
		case 'book-with-translator': {
			segments = authorPresentBibSegments(book, { includeEditor: false, includeTranslator: true });
			pair = joinBibSegments(segments);
			break;
		}
		case 'book-with-editor': {
			segments = authorPresentBibSegments(book, { includeEditor: true, includeTranslator: false });
			pair = joinBibSegments(segments);
			break;
		}
		case 'commentary-in-series':
		case 'multi-volume':
		case 'standalone-commentary':
		case 'reference-work-single-author':
		case 'single-author-book':
		default: {
			segments = authorPresentBibSegments(book);
			pair = joinBibSegments(segments);
			break;
		}
	}

	let { plain, html } = pair;
	plain = plain.replace(/\s+/g, ' ').trim();
	html = html.replace(/\s+/g, ' ').trim();
	if (plain && !plain.endsWith('.')) plain += '.';
	if (html && !html.endsWith('.')) html += '.';

	return buildPair(plain, html, sourceType);
}
