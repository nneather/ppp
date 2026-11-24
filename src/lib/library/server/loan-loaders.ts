import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';
import type { LoanCardModel, LoanContactHit, LoanReminderModel } from '$lib/types/loans';

type Db = SupabaseClient<Database>;

type MessageRow = {
	id: string;
	loan_id: string;
	kind: string;
	subject: string;
	html_body: string;
	scheduled_for: string;
	status: string;
	error: string | null;
};

function reminderFrom(rows: MessageRow[]): LoanReminderModel | null {
	const open = rows
		.filter((m) => m.kind === 'reminder' && (m.status === 'queued' || m.status === 'failed' || m.status === 'sending'))
		.sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
	const row = open[0];
	if (!row) return null;
	return {
		id: row.id,
		subject: row.subject,
		htmlBody: row.html_body,
		scheduledFor: row.scheduled_for,
		status: row.status,
		error: row.error
	};
}

function checkoutFrom(rows: MessageRow[]): Pick<
	LoanCardModel,
	'checkoutMessageId' | 'checkoutStatus' | 'checkoutError'
> {
	const row = rows
		.filter((m) => m.kind === 'checkout')
		.sort((a, b) => b.scheduled_for.localeCompare(a.scheduled_for))[0];
	if (!row) return { checkoutMessageId: null, checkoutStatus: null, checkoutError: null };
	return { checkoutMessageId: row.id, checkoutStatus: row.status, checkoutError: row.error };
}

export async function loadOpenLoans(
	supabase: Db,
	opts: { bookId?: string; contactId?: string; includePrivate: boolean }
): Promise<LoanCardModel[]> {
	let query = supabase
		.from('book_loans')
		.select(
			'id, book_id, contact_id, recipient_name, recipient_email, checked_out_on, interval_days'
		)
		.is('deleted_at', null)
		.is('returned_at', null)
		.order('checked_out_on', { ascending: true });
	if (opts.bookId) query = query.eq('book_id', opts.bookId);
	if (opts.contactId) query = query.eq('contact_id', opts.contactId);
	const { data, error } = await query;
	if (error) {
		console.error('[loans] list', error);
		return [];
	}
	const loans = data ?? [];
	if (loans.length === 0) return [];

	const bookIds = [...new Set(loans.map((l) => l.book_id))];
	const [booksRes, messagesRes] = await Promise.all([
		supabase.from('books').select('id, title, volume_number, author_display').in('id', bookIds),
		opts.includePrivate
			? supabase
					.from('book_loan_messages')
					.select('id, loan_id, kind, subject, html_body, scheduled_for, status, error')
					.in(
						'loan_id',
						loans.map((l) => l.id)
					)
					.is('deleted_at', null)
			: Promise.resolve({ data: [] as MessageRow[], error: null })
	]);
	if (booksRes.error) console.error('[loans] books', booksRes.error);
	if (messagesRes.error) console.error('[loans] messages', messagesRes.error);

	const titles = new Map<string, string>();
	const authors = new Map<string, string | null>();
	for (const book of booksRes.data ?? []) {
		const title = book.title?.trim() || 'Untitled';
		const volume = book.volume_number?.trim();
		titles.set(book.id, volume ? `${title}, vol. ${volume}` : title);
		authors.set(book.id, book.author_display);
	}
	const byLoan = new Map<string, MessageRow[]>();
	for (const message of (messagesRes.data ?? []) as MessageRow[]) {
		const list = byLoan.get(message.loan_id) ?? [];
		list.push(message);
		byLoan.set(message.loan_id, list);
	}

	return loans.map((loan) => {
		const messages = byLoan.get(loan.id) ?? [];
		const checkout = checkoutFrom(messages);
		return {
			id: loan.id,
			bookId: loan.book_id,
			bookTitle: titles.get(loan.book_id) ?? null,
			bookAuthors: authors.get(loan.book_id) ?? null,
			contactId: loan.contact_id,
			recipientName: loan.recipient_name,
			recipientEmail: opts.includePrivate ? loan.recipient_email : '',
			checkedOutOn: loan.checked_out_on,
			intervalDays: loan.interval_days,
			...checkout,
			reminder: opts.includePrivate ? reminderFrom(messages) : null
		};
	});
}

export async function countOpenLoansByContact(supabase: Db): Promise<Record<string, number>> {
	const { data, error } = await supabase
		.from('book_loans')
		.select('contact_id')
		.is('deleted_at', null)
		.is('returned_at', null);
	if (error) {
		console.error('[loans] contact counts', error);
		return {};
	}
	const counts: Record<string, number> = {};
	for (const row of data ?? []) {
		counts[row.contact_id] = (counts[row.contact_id] ?? 0) + 1;
	}
	return counts;
}

export async function searchLoanContacts(supabase: Db, q: string): Promise<LoanContactHit[]> {
	const safe = q.trim().replace(/[%_,.()]/g, '');
	if (safe.length < 1) return [];
	const pattern = `%${safe}%`;
	const { data, error } = await supabase
		.from('contacts')
		.select('id, first_name, last_name, email')
		.is('deleted_at', null)
		.or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
		.order('last_name', { ascending: true })
		.limit(12);
	if (error) {
		console.error('[loans] contact search', error);
		return [];
	}
	return (data ?? []).map((row) => ({
		id: row.id,
		name: [row.first_name, row.last_name].filter(Boolean).join(' '),
		email: row.email
	}));
}
