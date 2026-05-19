import type { BookCitationInput } from './types';

export function formatTitleWithSubtitle(book: BookCitationInput, mode: 'html' | 'plain'): string {
	const title = (book.title ?? '').trim();
	const subtitle = (book.subtitle ?? '').trim();
	if (!title && !subtitle) return mode === 'html' ? '<i>(untitled)</i>' : '(untitled)';
	const titlePart =
		mode === 'html'
			? title
				? `<i>${title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</i>`
				: ''
			: title;
	if (!subtitle) return titlePart;
	const sub =
		mode === 'html'
			? `: <i>${subtitle.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</i>`
			: `: ${subtitle}`;
	return `${titlePart}${sub}`;
}

export function formatEditionSegment(edition: string | null, mode: 'note' | 'bib'): string {
	const e = (edition ?? '').trim();
	if (!e) return '';
	// Pass through stored edition strings (e.g. "2nd ed.", "rev. ed.")
	if (/ed\.?$/i.test(e) || /edition/i.test(e)) {
		if (mode === 'bib' && /^[a-z]/.test(e)) {
			return e.charAt(0).toUpperCase() + e.slice(1);
		}
		return e;
	}
	return mode === 'note' ? `${e} ed.` : `${e.charAt(0).toUpperCase() + e.slice(1)} ed.`;
}

export function formatPublicationFacts(
	book: BookCitationInput,
	mode: 'note' | 'bib'
): { plain: string; html: string } {
	const isReprint =
		book.original_year != null &&
		(book.reprint_year != null || book.reprint_publisher != null || book.reprint_location != null);

	const loc = (book.publisher_location ?? '').trim();
	const pub = (book.publisher ?? '').trim();
	const year = book.year;

	if (isReprint) {
		const orig = book.original_year != null ? String(book.original_year) : '';
		const rLoc = (book.reprint_location ?? loc).trim();
		const rPub = (book.reprint_publisher ?? pub).trim();
		const rYear = book.reprint_year ?? year;
		const placePub = [rLoc, rPub].filter(Boolean).join(': ');
		const yearStr = rYear != null ? String(rYear) : '';
		if (mode === 'note') {
			const inner = [placePub, yearStr].filter(Boolean).join(', ');
			const plain = orig ? `(${orig}; repr., ${inner})` : `(${inner})`;
			const html = orig
				? `(${escape(orig)}; repr., ${escapeHtmlFacts(placePub, yearStr)})`
				: `(${escapeHtmlFacts(placePub, yearStr)})`;
			return { plain, html };
		}
		const plain = `${orig}. Reprint, ${[placePub, yearStr].filter(Boolean).join(', ')}.`;
		const html = `${escape(orig)}. Reprint, ${escapeHtmlFacts(placePub, yearStr)}.`;
		return { plain, html };
	}

	const placePub = [loc, pub].filter(Boolean).join(': ');
	const yearStr = year != null ? String(year) : '';
	if (mode === 'note') {
		const inner = [placePub, yearStr].filter(Boolean).join(', ');
		const plain = inner ? `(${inner})` : '';
		const html = inner ? `(${escapeHtmlFacts(placePub, yearStr)})` : '';
		return { plain, html };
	}
	const plain = [placePub, yearStr].filter(Boolean).join(', ');
	const html = escapeHtmlFacts(placePub, yearStr);
	const suffix = plain.endsWith('.') ? '' : '.';
	return { plain: plain ? `${plain}${suffix}` : '', html: html ? `${html}${suffix}` : '' };
}

function escape(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function escapeHtmlFacts(placePub: string, yearStr: string): string {
	const inner = [placePub, yearStr].filter(Boolean).join(', ');
	return escape(inner);
}

export function formatSeriesSegment(
	book: BookCitationInput,
	mode: 'note' | 'bib'
): string {
	const name = (book.series_name ?? '').trim();
	const abbr = (book.series_abbreviation ?? '').trim();
	const vol = (book.volume_number ?? '').trim();
	if (!name && !abbr) return '';
	const seriesLabel = mode === 'note' && abbr ? abbr : name || abbr;
	let out = seriesLabel;
	if (vol && /^\d+$/.test(vol) && name && name !== abbr) {
		// Series number in name e.g. "SBL Dissertation Series 153"
		if (!out.includes(vol)) out = `${out} ${vol}`;
	} else if (vol && mode === 'bib') {
		out = `${out} ${vol}`;
	}
	return out;
}

export function formatVolumePageNote(book: BookCitationInput, page?: string): string {
	const vol = (book.volume_number ?? '').trim();
	const pagePart = (page ?? '[page]').trim();
	if (vol && pagePart) return `${vol}:${pagePart.replace(/^p\.?\s*/i, '')}`;
	if (pagePart) return pagePart.replace(/^p\.?\s*/i, '');
	return '';
}

export function formatVolumeBibliography(book: BookCitationInput): string {
	const vol = (book.volume_number ?? '').trim();
	const total = book.total_volumes;
	if (vol) return `Vol. ${vol}.`;
	if (total != null && total > 1) return `${total} vols.`;
	return '';
}
