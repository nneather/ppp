import { addDaysYmd, utcNoonFromYmd } from '$lib/invoicing/chicago-date';
import { EMAIL_VARIABLE_TOKENS } from '$lib/email/variables';

const TOKEN_RE = /\{\{\s*([a-z0-9_.]+)\s*\}\}/gi;

export type EmailMergeValues = {
	'contact.first_name': string;
	'contact.last_name': string;
	'contact.full_name': string;
	'book.title': string;
	'book.authors': string;
	'loan.checked_out_on': string;
	'loan.due_on': string;
	'loan.days_out': string;
	'loan.books': string;
	'client.name': string;
	'invoice.number': string;
	'invoice.period': string;
	'invoice.total': string;
	'invoice.message': string;
	'owner.first_name': string;
};

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** Replace known tokens. Unknown tokens are left in place so save-time checks stay visible. */
export function renderEmailTemplate(
	template: string,
	values: Partial<EmailMergeValues>,
	opts?: { html?: boolean }
): string {
	return template.replace(TOKEN_RE, (raw, token: string) => {
		if (!EMAIL_VARIABLE_TOKENS.has(token)) return raw;
		const value = values[token as keyof EmailMergeValues] ?? '';
		if (token === 'loan.books' && opts?.html) return value;
		const escaped = escapeHtml(value);
		return opts?.html ? escaped.replace(/\n/g, '<br>') : escaped.replace(/\n/g, ' ');
	});
}

export function daysBetweenYmd(startYmd: string, endYmd: string): number | null {
	const start = utcNoonFromYmd(startYmd);
	const end = utcNoonFromYmd(endYmd);
	if (!start || !end) return null;
	return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function formatLoanDate(ymd: string): string {
	const mid = utcNoonFromYmd(ymd);
	if (!mid) return ymd;
	return new Intl.DateTimeFormat('en-US', {
		timeZone: 'UTC',
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	}).format(mid);
}

export type LoanBookLine = {
	title: string;
	authors: string | null;
	dueOn: string;
};

/** Already-safe HTML. The renderer must not escape `loan.books`. */
export function loanBooksHtml(books: readonly LoanBookLine[]): string {
	if (books.length === 0) return '';
	const items = books.map((book) => {
		const title = escapeHtml(book.title.trim() || 'Untitled');
		const authors = book.authors?.trim() ? ` — ${escapeHtml(book.authors.trim())}` : '';
		return `<li>${title}${authors} (due ${escapeHtml(formatLoanDate(book.dueOn))})</li>`;
	});
	return `<ul>${items.join('')}</ul>`;
}

/** A saved template that never picked up the list token still names every book. */
export function withLoanBookList(template: string, renderedHtml: string, booksHtml: string): string {
	if (/\{\{\s*loan\.books\s*\}\}/i.test(template)) return renderedHtml;
	if (!booksHtml) return renderedHtml;
	return `${renderedHtml}${booksHtml}`;
}

/** Checkout day plus the loan interval. That is the date the copy is due back. */
export function loanDueLabel(checkedOutOn: string, intervalDays: number): string {
	const ymd = reminderDateAfter(checkedOutOn, intervalDays);
	return ymd ? formatLoanDate(ymd) : '';
}

export function reminderDateAfter(fromYmd: string, intervalDays: number): string | null {
	if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 366) return null;
	return addDaysYmd(fromYmd, intervalDays);
}

/** First word of the profile name. Blank profiles still sign the email. */
export function ownerFirstName(fullName: string | null | undefined): string {
	const first = (fullName ?? '').trim().split(/\s+/)[0];
	return first && first.length > 0 ? first : 'Parker';
}

export function contactFullName(first: string | null, last: string | null): string {
	return [first?.trim(), last?.trim()].filter((s) => s && s.length > 0).join(' ');
}
