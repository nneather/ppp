import { resolveCitationSourceType } from './dispatch';
import {
	formatAuthorsBibliography,
	formatAuthorsNote,
	formatEditorsBibliography,
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

function joinParts(parts: string[], sep = ' '): string {
	return parts.filter((p) => p.length > 0).join(sep);
}

function buildPair(plain: string, html: string, sourceType: CitationSourceType): CitationFormatted {
	return { plain, html, sourceType };
}

export function formatFootnote(book: BookCitationInput, opts?: FormatOptions): CitationFormatted {
	const sourceType = resolveCitationSourceType(book);
	const page = opts?.page ?? '[page]';

	if (sourceType === 'bible') {
		const version = opts?.bibleVersion ? ` (${opts.bibleVersion})` : ' (English Standard Version)';
		const plain = `${page}${version}.`;
		const html = `${escapeHtml(page)}${escapeHtml(version)}.`;
		return buildPair(plain, html, sourceType);
	}

	const titlePlain = formatTitleWithSubtitle(book, 'plain');
	const titleHtml = formatTitleWithSubtitle(book, 'html');
	const edition = formatEditionSegment(book.edition, 'note');
	const pub = formatPublicationFacts(book, 'note');
	const series = formatSeriesSegment(book, 'note');
	const volPage = formatVolumePageNote(book, page);

	let plain = '';
	let html = '';

	switch (sourceType) {
		case 'edited-volume': {
			const ed = formatEditorsNote(book.authors);
			plain = joinParts([ed, titlePlain, edition, series, pub.plain, volPage], ' ');
			html = joinParts([escape(ed), titleHtml, edition, escape(series), pub.html, escape(volPage)], ' ');
			break;
		}
		case 'book-with-translator': {
			const auth = formatAuthorsNote(book.authors);
			const trans = formatTranslatorsNote(book.authors);
			plain = joinParts(
				[auth, titlePlain, trans, edition, series, pub.plain, volPage],
				', '
			);
			html = joinParts(
				[escape(auth), titleHtml, trans, edition, escape(series), pub.html, escape(volPage)],
				', '
			);
			break;
		}
		case 'multi-volume': {
			const auth = formatAuthorsNote(book.authors);
			plain = joinParts([auth, titlePlain, edition, series, pub.plain, volPage], ', ');
			html = joinParts([escape(auth), titleHtml, edition, escape(series), pub.html, escape(volPage)], ', ');
			break;
		}
		case 'commentary-in-series':
		case 'standalone-commentary':
		case 'reference-work-single-author':
		case 'single-author-book': {
			const auth = formatAuthorsNote(book.authors);
			const trans = formatTranslatorsNote(book.authors);
			const mid = trans ? `, ${trans}` : '';
			plain = joinParts(
				[`${auth}${mid}`, titlePlain, edition, series, pub.plain, volPage],
				', '
			);
			// series follows title without comma per Turabian
			if (series) {
				plain = joinParts([auth + mid, titlePlain, edition, series + ' ' + pub.plain.replace(/^\(/, '('), volPage], ' ');
				plain = plain.replace(/\s+\(/, ' (');
			}
			html = joinParts(
				[
					escape(auth) + (trans ? `, ${trans}` : ''),
					titleHtml,
					edition,
					series ? escape(series) : '',
					pub.html,
					escape(volPage)
				],
				' '
			);
			if (series && pub.html) {
				html = joinParts(
					[
						escape(auth) + (trans ? `, ${trans}` : ''),
						titleHtml,
						edition,
						`${escape(series)} ${pub.html}`,
						escape(volPage)
					],
					' '
				);
			}
			break;
		}
		case 'reference-work-edited': {
			const ed = formatEditorsNote(book.authors);
			plain = joinParts([ed, titlePlain, edition, series, pub.plain, volPage], ' ');
			html = joinParts([escape(ed), titleHtml, edition, escape(series), pub.html, escape(volPage)], ' ');
			break;
		}
		default:
			break;
	}

	// Normalize commentary series: "Title, Series (pub), page" → "Title, Series (pub), page"
	if (sourceType === 'commentary-in-series' && series) {
		const auth = formatAuthorsNote(book.authors);
		plain = `${auth}, ${titlePlain}, ${series} ${pub.plain}${volPage ? `, ${volPage}` : ''}`;
		html = `${escape(auth)}, ${titleHtml}, ${escape(series)} ${pub.html}${volPage ? `, ${escape(volPage)}` : ''}`;
	}

	if (!plain.endsWith('.')) plain += '.';
	if (!html.endsWith('.')) html += '.';

	return buildPair(plain, html, sourceType);
}

export function formatBibliography(book: BookCitationInput): CitationFormatted {
	const sourceType = resolveCitationSourceType(book);

	if (sourceType === 'bible') {
		return buildPair('', '', sourceType);
	}

	const titlePlain = formatTitleWithSubtitle(book, 'plain');
	const titleHtml = formatTitleWithSubtitle(book, 'html');
	const edition = formatEditionSegment(book.edition, 'bib');
	const pub = formatPublicationFacts(book, 'bib');
	const series = formatSeriesSegment(book, 'bib');
	const volBib = formatVolumeBibliography(book);

	let plain = '';
	let html = '';

	switch (sourceType) {
		case 'edited-volume': {
			const ed = formatEditorsBibliography(book.authors);
			plain = joinParts([ed, titlePlain + '.', edition, volBib, series, pub.plain], ' ');
			html = joinParts([escape(ed), titleHtml + '.', edition, volBib, escape(series), pub.html], ' ');
			break;
		}
		case 'book-with-translator': {
			const auth = formatAuthorsBibliography(book.authors);
			const trans = formatTranslatorsBibliography(book.authors);
			plain = joinParts(
				[auth + '.', titlePlain + '.', trans, edition, volBib, series, pub.plain],
				' '
			);
			html = joinParts(
				[escape(auth) + '.', titleHtml + '.', trans, edition, volBib, escape(series), pub.html],
				' '
			);
			break;
		}
		case 'multi-volume': {
			const auth = formatAuthorsBibliography(book.authors);
			plain = joinParts(
				[auth + '.', titlePlain + '.', edition, volBib, series, pub.plain],
				' '
			);
			html = joinParts(
				[escape(auth) + '.', titleHtml + '.', edition, volBib, escape(series), pub.html],
				' '
			);
			break;
		}
		case 'commentary-in-series': {
			const auth = formatAuthorsBibliography(book.authors);
			plain = `${auth}. ${titlePlain}. ${series}. ${pub.plain}`;
			html = `${escape(auth)}. ${titleHtml}. ${escape(series)}. ${pub.html}`;
			break;
		}
		case 'reference-work-edited': {
			const ed = formatEditorsBibliography(book.authors);
			plain = joinParts([ed, titlePlain + '.', edition, volBib, series, pub.plain], ' ');
			html = joinParts([escape(ed), titleHtml + '.', edition, volBib, escape(series), pub.html], ' ');
			break;
		}
		default: {
			const auth = formatAuthorsBibliography(book.authors);
			const trans = formatTranslatorsBibliography(book.authors);
			plain = joinParts(
				[auth + '.', titlePlain + '.', trans, edition, volBib, series, pub.plain],
				' '
			);
			html = joinParts(
				[escape(auth) + '.', titleHtml + '.', trans, edition, volBib, escape(series), pub.html],
				' '
			);
			break;
		}
	}

	plain = plain.replace(/\s+/g, ' ').trim();
	html = html.replace(/\s+/g, ' ').trim();
	if (plain && !plain.endsWith('.')) plain += '.';
	if (html && !html.endsWith('.')) html += '.';

	return buildPair(plain, html, sourceType);
}

function escape(s: string): string {
	if (!s) return '';
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function escapeHtml(s: string): string {
	return escape(s);
}
