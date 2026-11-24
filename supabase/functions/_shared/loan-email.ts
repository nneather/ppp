/** Date and merge helpers for loan and invoice mail. Kept here because the Edge bundler does not import src/lib. Keep the token list in step with src/lib/email/variables.ts. */

const TOKENS = new Set([
	'contact.first_name',
	'contact.last_name',
	'contact.full_name',
	'book.title',
	'book.authors',
	'loan.checked_out_on',
	'loan.due_on',
	'loan.days_out',
	'loan.reminder_lead',
	'loan.books',
	'client.name',
	'invoice.number',
	'invoice.period',
	'invoice.total',
	'invoice.message',
	'owner.first_name'
]);

const TOKEN_RE = /\{\{\s*([a-z0-9_.]+)\s*\}\}/gi;
const ALLOWED = new Set(['p', 'h2', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'br']);

export type LoanMergeValues = {
	'contact.first_name': string;
	'contact.last_name': string;
	'contact.full_name': string;
	'book.title': string;
	'book.authors': string;
	'loan.checked_out_on': string;
	'loan.due_on': string;
	'loan.days_out': string;
	'loan.reminder_lead': string;
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

export function ymdInChicago(instant: Date = new Date()): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Chicago',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(instant);
	let y = '';
	let mo = '';
	let d = '';
	for (const p of parts) {
		if (p.type === 'year') y = p.value;
		else if (p.type === 'month') mo = p.value;
		else if (p.type === 'day') d = p.value;
	}
	return `${y}-${mo}-${d}`;
}

function utcNoonFromYmd(ymd: string): Date | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
	if (!m) return null;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const day = Number(m[3]);
	const date = new Date(Date.UTC(y, mo - 1, day, 12, 0, 0));
	if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== day) {
		return null;
	}
	return date;
}

export function addDaysYmd(ymd: string, days: number): string | null {
	const mid = utcNoonFromYmd(ymd);
	if (!mid) return null;
	mid.setUTCDate(mid.getUTCDate() + days);
	const y = mid.getUTCFullYear();
	const mo = String(mid.getUTCMonth() + 1).padStart(2, '0');
	const day = String(mid.getUTCDate()).padStart(2, '0');
	return `${y}-${mo}-${day}`;
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

export function nextReminderYmd(
	dueDates: readonly string[],
	leadDays: number,
	today: string
): string | null {
	const earliest = [...dueDates].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()[0];
	if (!earliest) return null;
	const lead = Number.isInteger(leadDays) && leadDays >= 0 && leadDays <= 60 ? leadDays : 0;
	const scheduled = addDaysYmd(earliest, -lead);
	if (!scheduled || scheduled < today) return today;
	return scheduled;
}

export function bookTitleSummary(titles: readonly string[]): string {
	const clean = titles.map((title) => title.trim()).filter((title) => title.length > 0);
	if (clean.length === 0) return 'a book';
	if (clean.length === 1) return clean[0] ?? 'a book';
	const extra = clean.length - 1;
	return `${clean[0]} and ${extra} ${extra === 1 ? 'other' : 'others'}`;
}

export function loanBooksHtml(
	books: readonly { title: string; authors: string | null; dueOn: string }[]
): string {
	if (books.length === 0) return '';
	const items = books.map((book) => {
		const title = escapeHtml(book.title.trim() || 'Untitled');
		const authors = book.authors?.trim() ? ` by ${escapeHtml(book.authors.trim())}` : '';
		return `<li><em>${title}</em>${authors} (due ${escapeHtml(formatLoanDate(book.dueOn))})</li>`;
	});
	return `<ul>${items.join('')}</ul>`;
}

export function withLoanBookList(template: string, renderedHtml: string, booksHtml: string): string {
	if (/\{\{\s*loan\.books\s*\}\}/i.test(template)) return renderedHtml;
	if (!booksHtml) return renderedHtml;
	return `${renderedHtml}${booksHtml}`;
}

export function ownerFirstName(fullName: string | null | undefined): string {
	const first = (fullName ?? '').trim().split(/\s+/)[0];
	return first && first.length > 0 ? first : 'Parker';
}

export function renderEmailTemplate(
	template: string,
	values: Partial<LoanMergeValues>,
	opts?: { html?: boolean }
): string {
	return template.replace(TOKEN_RE, (raw, token: string) => {
		if (!TOKENS.has(token)) return raw;
		const value = values[token as keyof LoanMergeValues] ?? '';
		if (token === 'loan.books' && opts?.html) return value;
		const escaped = escapeHtml(value);
		return opts?.html ? escaped.replace(/\n/g, '<br>') : escaped.replace(/\n/g, ' ');
	});
}

function sanitizeHref(raw: string): string | null {
	const href = raw.trim();
	if (/^https?:\/\//i.test(href)) return href;
	if (/^mailto:/i.test(href)) return href;
	return null;
}

export function sanitizeEmailHtml(input: string): string {
	let html = input.replace(/<!--[\s\S]*?-->/g, '');
	html = html.replace(
		/<\s*(script|style|iframe|object|embed|form|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
		''
	);
	html = html.replace(/<\s*(script|style|iframe|object|embed|form|svg|math)\b[^>]*\/?\s*>/gi, '');
	return html.replace(/<\/?\s*([a-zA-Z0-9]+)([^>]*)>/g, (full, rawTag: string, attrs: string) => {
		const name = rawTag.toLowerCase();
		if (!ALLOWED.has(name)) return '';
		if (name === 'br') return '<br>';
		if (/^<\s*\//.test(full)) return `</${name}>`;
		if (name !== 'a') return `<${name}>`;
		const hrefMatch = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
		const hrefRaw = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? '';
		const href = sanitizeHref(hrefRaw);
		const classAttr = /\bppp-email-button\b/.test(attrs) ? ' class="ppp-email-button"' : '';
		if (!href) return `<a${classAttr}>`;
		return `<a href="${href.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"${classAttr}>`;
	});
}

export function inlineEmailButtonStyles(html: string): string {
	return html.replace(
		/<a href="([^"]*)" class="ppp-email-button">/g,
		'<a href="$1" style="display:inline-block;background:#18181b;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;">'
	);
}

export function emailHtmlToText(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|h2|li)>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export function wrapLoanEmail(html: string): string {
	return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#18181b;">${inlineEmailButtonStyles(html)}</div>`;
}

const OPEN_REMINDER = new Set(['queued', 'sending', 'failed']);

export function loanNeedsNextReminder(
	returned: boolean,
	messages: readonly { kind: string; status: string }[]
): boolean {
	if (returned) return false;
	return !messages.some((m) => m.kind === 'reminder' && OPEN_REMINDER.has(m.status));
}

export function secretsMatch(given: string, expected: string): boolean {
	if (given.length !== expected.length || given.length < 16) return false;
	let diff = 0;
	for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
	return diff === 0;
}
