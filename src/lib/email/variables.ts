/** Closed merge-field catalog. Save rejects any other `{{token}}`. */

export type EmailVariable = {
	token: string;
	label: string;
	group: 'Contact' | 'Book' | 'Loan' | 'Client' | 'Invoice' | 'Owner';
};

export const EMAIL_VARIABLES: readonly EmailVariable[] = [
	{ token: 'contact.first_name', label: 'First name', group: 'Contact' },
	{ token: 'contact.last_name', label: 'Last name', group: 'Contact' },
	{ token: 'contact.full_name', label: 'Full name', group: 'Contact' },
	{ token: 'book.title', label: 'Title', group: 'Book' },
	{ token: 'book.authors', label: 'Authors', group: 'Book' },
	{ token: 'loan.checked_out_on', label: 'Checkout date', group: 'Loan' },
	{ token: 'loan.due_on', label: 'Due date', group: 'Loan' },
	{ token: 'loan.days_out', label: 'Days out', group: 'Loan' },
	{ token: 'loan.reminder_lead', label: 'Remind this many days before due', group: 'Loan' },
	{ token: 'loan.books', label: 'Books still out', group: 'Loan' },
	{ token: 'client.name', label: 'Name', group: 'Client' },
	{ token: 'invoice.number', label: 'Number', group: 'Invoice' },
	{ token: 'invoice.period', label: 'Period', group: 'Invoice' },
	{ token: 'invoice.total', label: 'Total', group: 'Invoice' },
	{ token: 'invoice.message', label: 'Note typed at send', group: 'Invoice' },
	{ token: 'owner.first_name', label: 'Your first name', group: 'Owner' }
] as const;

export const EMAIL_VARIABLE_TOKENS: ReadonlySet<string> = new Set(
	EMAIL_VARIABLES.map((v) => v.token)
);

export const LIBRARY_LOAN_CHECKOUT_KEY = 'library.loan.checkout';
export const LIBRARY_LOAN_REMINDER_KEY = 'library.loan.reminder';
export const INVOICING_INVOICE_KEY = 'invoicing.invoice';

/** One row per send. Each use points at a single template. Add a row here to grow the list. */
export const EMAIL_TEMPLATE_USES: readonly { key: string; label: string; detail: string }[] = [
	{
		key: LIBRARY_LOAN_CHECKOUT_KEY,
		label: 'Checkout email',
		detail: 'Sent once when books are checked out, listing each one.'
	},
	{
		key: LIBRARY_LOAN_REMINDER_KEY,
		label: 'Due reminder',
		detail: 'One email per person before the soonest due date, listing every book still out.'
	},
	{
		key: INVOICING_INVOICE_KEY,
		label: 'Invoice email',
		detail: 'Sent with the PDF. The note you type when you send is the message.'
	}
];

export function emailUseLabel(key: string): string {
	return EMAIL_TEMPLATE_USES.find((use) => use.key === key)?.label ?? key;
}

export const DEFAULT_LOAN_INTERVAL_DAYS = 30;
export const DEFAULT_LOAN_DUE_DAYS = 30;
export const DEFAULT_REMINDER_LEAD_DAYS = 7;

const TOKEN_RE = /\{\{\s*([a-z0-9_.]+)\s*\}\}/gi;

export function tokensIn(text: string): string[] {
	const found: string[] = [];
	for (const match of text.matchAll(TOKEN_RE)) {
		const token = match[1];
		if (token && !found.includes(token)) found.push(token);
	}
	return found;
}

export function unknownEmailTokens(subject: string, html: string): string[] {
	const unknown: string[] = [];
	for (const token of [...tokensIn(subject), ...tokensIn(html)]) {
		if (!EMAIL_VARIABLE_TOKENS.has(token) && !unknown.includes(token)) unknown.push(token);
	}
	return unknown;
}
