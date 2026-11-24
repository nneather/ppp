/** Closed merge-field catalog. Save rejects any other `{{token}}`. */

export type EmailVariable = {
	token: string;
	label: string;
	group: 'Contact' | 'Book' | 'Loan' | 'Owner';
};

export const EMAIL_VARIABLES: readonly EmailVariable[] = [
	{ token: 'contact.first_name', label: 'First name', group: 'Contact' },
	{ token: 'contact.last_name', label: 'Last name', group: 'Contact' },
	{ token: 'contact.full_name', label: 'Full name', group: 'Contact' },
	{ token: 'book.title', label: 'Title', group: 'Book' },
	{ token: 'book.authors', label: 'Authors', group: 'Book' },
	{ token: 'loan.checked_out_on', label: 'Checkout date', group: 'Loan' },
	{ token: 'loan.days_out', label: 'Days out', group: 'Loan' },
	{ token: 'owner.first_name', label: 'Your first name', group: 'Owner' }
] as const;

export const EMAIL_VARIABLE_TOKENS: ReadonlySet<string> = new Set(
	EMAIL_VARIABLES.map((v) => v.token)
);

export const LIBRARY_LOAN_CHECKOUT_KEY = 'library.loan.checkout';
export const LIBRARY_LOAN_REMINDER_KEY = 'library.loan.reminder';

export const DEFAULT_LOAN_INTERVAL_DAYS = 30;

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
