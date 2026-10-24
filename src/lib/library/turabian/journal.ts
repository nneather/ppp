import type { BookAuthorAssignment } from '$lib/types/library';
import { formatAuthorsBibliography, formatAuthorsNote, parseAuthorAssignment } from './names';
import { normalizeCitationText } from './text-normalize';
import type { CitationFormatted } from './types';

/**
 * Journal article (Turabian 9 §17.2). Not an essay: there is no parent book.
 * Note: Author, "Title," *Journal* volume, no. issue (Year): pages.
 * Bibliography: Author. "Title." *Journal* volume, no. issue (Year): pages.
 */
export type JournalArticleCitationInput = {
	title: string;
	journal_title: string;
	volume?: string | null;
	issue?: string | null;
	year?: number | null;
	page_start?: string | null;
	page_end?: string | null;
	doi?: string | null;
	authors: BookAuthorAssignment[];
};

export type JournalArticleFormatOptions = {
	/** Specific page for the note or short form. Bibliography always uses the stored span. */
	page?: string;
	shortForm?: 'short';
};

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function quotedTitle(title: string, mode: 'plain' | 'html', terminal: ',' | '.'): string {
	const normalized = normalizeCitationText(title.trim());
	if (mode === 'html') {
		const close = terminal === ',' ? ',&rdquo;' : '.&rdquo;';
		return `&ldquo;${escapeHtml(normalized)}${close}`;
	}
	return `"${normalized}${terminal}"`;
}

/**
 * Chicago inclusive-number elision for the second page (Turabian follows CMOS).
 * 157–162 → 62; 100–104 stays 104; 101–108 → 8.
 */
export function elideJournalPageEnd(start: number, end: number): string {
	if (end <= start) return String(end);
	const s = String(start);
	const e = String(end);
	if (start < 100 || start % 100 === 0) return e;
	if (start % 100 < 10) {
		let i = 0;
		while (i < s.length - 1 && i < e.length && s[i] === e[i]) i++;
		return e.slice(i);
	}
	let i = 0;
	while (i < s.length - 2 && i < e.length && s[i] === e[i]) i++;
	const from = Math.min(i, Math.max(0, e.length - 2));
	return e.slice(from);
}

/** Stored page span, with numeric ends elided. Empty when both ends are blank. */
export function formatJournalPageRange(
	pageStart: string | null | undefined,
	pageEnd: string | null | undefined
): string {
	const start = pageStart?.trim() ?? '';
	const end = pageEnd?.trim() ?? '';
	if (!start) return end;
	if (!end || end === start) return start;
	if (/^\d+$/.test(start) && /^\d+$/.test(end)) {
		const a = Number(start);
		const b = Number(end);
		if (b > a) return `${start}\u2013${elideJournalPageEnd(a, b)}`;
	}
	return `${start}\u2013${end}`;
}

function doiHref(doi: string | null | undefined): string | null {
	const raw = doi?.trim() ?? '';
	if (!raw) return null;
	if (/^https?:\/\//i.test(raw)) return raw;
	return `https://doi.org/${raw.replace(/^doi:\s*/i, '')}`;
}

function volumeIssueYear(article: JournalArticleCitationInput): string {
	const volume = article.volume?.trim() ?? '';
	const issue = article.issue?.trim() ?? '';
	const volIssue = volume && issue ? `${volume}, no. ${issue}` : volume || (issue ? `no. ${issue}` : '');
	const year = article.year != null ? `(${article.year})` : '';
	return [volIssue, year].filter((part) => part.length > 0).join(' ');
}

function journalName(title: string, mode: 'plain' | 'html'): string {
	const name = normalizeCitationText(title.trim());
	if (!name) return '';
	return mode === 'html' ? `<i>${escapeHtml(name)}</i>` : name;
}

function finish(plain: string, html: string, doi: string | null): { plain: string; html: string } {
	if (!doi) return { plain, html };
	return {
		plain: `${plain} ${doi}.`,
		html: `${html} ${escapeHtml(doi)}.`
	};
}

export function formatJournalArticleFootnote(
	article: JournalArticleCitationInput,
	opts?: JournalArticleFormatOptions
): CitationFormatted {
	if (opts?.shortForm === 'short') return formatJournalArticleShort(article, opts);
	const author = formatAuthorsNote(article.authors);
	const pages = opts?.page?.trim() || formatJournalPageRange(article.page_start, article.page_end);
	const locus = volumeIssueYear(article);
	const journalPlain = journalName(article.journal_title, 'plain');
	const journalHtml = journalName(article.journal_title, 'html');
	const titlePlain = quotedTitle(article.title, 'plain', ',');
	const titleHtml = quotedTitle(article.title, 'html', ',');

	let plain = author ? `${author}, ${titlePlain}` : titlePlain;
	let html = author ? `${escapeHtml(author)}, ${titleHtml}` : titleHtml;
	if (journalPlain) {
		plain += ` ${journalPlain}`;
		html += ` ${journalHtml}`;
	}
	if (locus) {
		plain += ` ${locus}`;
		html += ` ${escapeHtml(locus)}`;
	}
	if (pages) {
		plain += `: ${pages}`;
		html += `: ${escapeHtml(pages)}`;
	}
	plain += '.';
	html += '.';
	const done = finish(plain, html, doiHref(article.doi));
	return { ...done, sourceType: 'journal-article' };
}

function formatJournalArticleShort(
	article: JournalArticleCitationInput,
	opts?: JournalArticleFormatOptions
): CitationFormatted {
	const authors = article.authors.filter((a) => a.role === 'author');
	const last = authors[0] ? parseAuthorAssignment(authors[0]).last : '';
	const page = opts?.page?.trim() || article.page_start?.trim() || '';
	const titlePlain = quotedTitle(article.title, 'plain', page ? ',' : '.');
	const titleHtml = quotedTitle(article.title, 'html', page ? ',' : '.');
	const leadPlain = last ? `${last}, ${titlePlain}` : titlePlain;
	const leadHtml = last ? `${escapeHtml(last)}, ${titleHtml}` : titleHtml;
	const plain = page ? `${leadPlain} ${page}.` : `${leadPlain}`;
	const html = page ? `${leadHtml} ${escapeHtml(page)}.` : leadHtml;
	return { plain, html, sourceType: 'journal-article' };
}

export function formatJournalArticleBibliography(
	article: JournalArticleCitationInput
): CitationFormatted {
	const authorBib = formatAuthorsBibliography(article.authors);
	const authorLead = authorBib ? (authorBib.endsWith('.') ? authorBib : `${authorBib}.`) : '';
	const pages = formatJournalPageRange(article.page_start, article.page_end);
	const locus = volumeIssueYear(article);
	const journalPlain = journalName(article.journal_title, 'plain');
	const journalHtml = journalName(article.journal_title, 'html');
	const titlePlain = quotedTitle(article.title, 'plain', '.');
	const titleHtml = quotedTitle(article.title, 'html', '.');

	let plain = authorLead ? `${authorLead} ${titlePlain}` : titlePlain;
	let html = authorLead ? `${escapeHtml(authorLead)} ${titleHtml}` : titleHtml;
	if (journalPlain) {
		plain += ` ${journalPlain}`;
		html += ` ${journalHtml}`;
	}
	if (locus) {
		plain += ` ${locus}`;
		html += ` ${escapeHtml(locus)}`;
	}
	if (pages) {
		plain += `: ${pages}`;
		html += `: ${escapeHtml(pages)}`;
	}
	plain += '.';
	html += '.';
	const done = finish(plain, html, doiHref(article.doi));
	return { ...done, sourceType: 'journal-article' };
}
