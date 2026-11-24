import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addDaysYmd, utcNoonFromYmd, ymdInChicago } from '$lib/invoicing/chicago-date';
import {
	bookTitleSummary,
	canCheckOutCopy,
	isLoanEmail,
	nextReminderYmd,
	parseLoanInterval,
	parseReminderLead
} from '$lib/email/loans';
import {
	contactFullName,
	daysBetweenYmd,
	formatLoanDate,
	loanBooksHtml,
	ownerFirstName,
	renderEmailTemplate,
	withLoanBookList,
	type EmailMergeValues,
	type LoanBookLine
} from '$lib/email/render';
import { sanitizeEmailHtml } from '$lib/email/sanitize';
import {
	DEFAULT_REMINDER_LEAD_DAYS,
	LIBRARY_LOAN_CHECKOUT_KEY,
	LIBRARY_LOAN_REMINDER_KEY,
	unknownEmailTokens
} from '$lib/email/variables';
import type { Database } from '$lib/types/database';

type Db = SupabaseClient<Database>;

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LoanActionKind =
	| 'checkoutBook'
	| 'returnBook'
	| 'updateLoanReminder'
	| 'updateLoanDue'
	| 'updateLoanEmail'
	| 'retryLoanMessage';

function trim(fd: FormData, key: string): string {
	return String(fd.get(key) ?? '').trim();
}

async function requireOwner(supabase: Db, userId: string): Promise<boolean> {
	const { data, error } = await supabase
		.from('profiles')
		.select('role')
		.eq('id', userId)
		.maybeSingle();
	if (error) console.error('[loans] role', error);
	return data?.role === 'owner';
}

async function authHeader(supabase: Db): Promise<Record<string, string> | undefined> {
	const { data } = await supabase.auth.getSession();
	const token = data.session?.access_token;
	return token ? { Authorization: `Bearer ${token}` } : undefined;
}

async function invokeSend(supabase: Db, messageId: string): Promise<string | null> {
	const { data, error } = await supabase.functions.invoke('send-loan-message', {
		body: { message_id: messageId },
		headers: await authHeader(supabase)
	});
	if (error) {
		console.error('[loans] send', error);
		return 'The email did not send. You can retry it from the loan.';
	}
	const body = data as { error?: string; success?: boolean } | null;
	if (body?.error) return body.error;
	if (body?.success !== true) return 'The email did not send. You can retry it from the loan.';
	return null;
}

type BoundTemplate = { id: string; subject: string; html_body: string };

async function templateForKey(supabase: Db, key: string): Promise<BoundTemplate | null> {
	const { data: binding, error } = await supabase
		.from('email_template_bindings')
		.select('template_id')
		.eq('binding_key', key)
		.is('deleted_at', null)
		.maybeSingle();
	if (error || !binding) {
		if (error) console.error('[loans] binding', error);
		return null;
	}
	const { data: template, error: templateError } = await supabase
		.from('email_templates')
		.select('id, subject, html_body, is_active')
		.eq('id', binding.template_id)
		.is('deleted_at', null)
		.maybeSingle();
	if (templateError || !template || !template.is_active) {
		if (templateError) console.error('[loans] template', templateError);
		return null;
	}
	return template;
}

export type LoanMergeBook = LoanBookLine & { checkedOutOn: string };

export function buildLoanMergeValues(input: {
	firstName: string;
	lastName: string | null;
	books: readonly LoanMergeBook[];
	asOfYmd: string;
	reminderLeadDays?: number | null;
	ownerFullName: string | null | undefined;
}): Partial<EmailMergeValues> {
	const books = [...input.books];
	const earliestOut = [...books].sort((a, b) => a.checkedOutOn.localeCompare(b.checkedOutOn))[0];
	const earliestDue = [...books].sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
	const checkedOutOn = earliestOut?.checkedOutOn ?? input.asOfYmd;
	const days = daysBetweenYmd(checkedOutOn, input.asOfYmd);
	const sole = books.length === 1 ? books[0] : null;
	const lead = input.reminderLeadDays;
	const reminderLead =
		lead != null && Number.isInteger(lead) && lead >= 0 && lead <= 60
			? String(lead)
			: String(DEFAULT_REMINDER_LEAD_DAYS);
	return {
		'contact.first_name': input.firstName.trim(),
		'contact.last_name': (input.lastName ?? '').trim(),
		'contact.full_name': contactFullName(input.firstName, input.lastName),
		'book.title': bookTitleSummary(books.map((book) => book.title)),
		'book.authors': (sole?.authors ?? '').trim(),
		'loan.checked_out_on': formatLoanDate(checkedOutOn),
		'loan.due_on': earliestDue ? formatLoanDate(earliestDue.dueOn) : '',
		'loan.days_out': String(days != null && days > 0 ? days : 0),
		'loan.reminder_lead': reminderLead,
		'loan.books': loanBooksHtml(books),
		'owner.first_name': ownerFirstName(input.ownerFullName)
	};
}

function renderPair(
	subject: string,
	html: string,
	values: Partial<EmailMergeValues>
): { subject: string; html: string } | { error: string } {
	const unknown = unknownEmailTokens(subject, html);
	if (unknown.length > 0) return { error: `Unknown merge field: ${unknown.join(', ')}` };
	const rendered = renderEmailTemplate(html, values, { html: true });
	return {
		subject: renderEmailTemplate(subject, values).trim(),
		html: sanitizeEmailHtml(withLoanBookList(html, rendered, values['loan.books'] ?? ''))
	};
}

function bookIdsFrom(fd: FormData): string[] {
	const ids = fd
		.getAll('book_id')
		.map((value) => String(value).trim())
		.filter((id) => UUID_RE.test(id));
	return [...new Set(ids)].slice(0, 20);
}

function isYmd(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value) && utcNoonFromYmd(value) != null;
}

function titledBook(book: { title: string | null; volume_number: string | null }): string {
	const title = book.title?.trim() || 'Untitled';
	const volume = book.volume_number?.trim();
	return volume ? `${title}, vol. ${volume}` : title;
}

type OpenLoanLine = {
	id: string;
	book_id: string;
	checked_out_on: string;
	due_on: string;
	recipient_name: string;
};

async function openLoansForContact(supabase: Db, contactId: string): Promise<OpenLoanLine[]> {
	const { data, error } = await supabase
		.from('book_loans')
		.select('id, book_id, checked_out_on, due_on, recipient_name')
		.eq('contact_id', contactId)
		.is('deleted_at', null)
		.is('returned_at', null);
	if (error) {
		console.error('[loans] open for contact', error);
		return [];
	}
	return data ?? [];
}

async function linesForLoans(
	supabase: Db,
	loans: readonly OpenLoanLine[]
): Promise<LoanMergeBook[]> {
	if (loans.length === 0) return [];
	const { data, error } = await supabase
		.from('books')
		.select('id, title, volume_number, author_display')
		.in('id', [...new Set(loans.map((loan) => loan.book_id))]);
	if (error) console.error('[loans] book lines', error);
	const byId = new Map((data ?? []).map((book) => [book.id, book]));
	return [...loans]
		.sort((a, b) => a.due_on.localeCompare(b.due_on) || a.checked_out_on.localeCompare(b.checked_out_on))
		.map((loan) => {
			const book = byId.get(loan.book_id);
			return {
				title: book ? titledBook(book) : 'Untitled',
				authors: book?.author_display ?? null,
				checkedOutOn: loan.checked_out_on,
				dueOn: loan.due_on
			};
		});
}

/** Rewrite the one open reminder so it lists whatever is still out. */
async function refreshContactReminder(supabase: Db, userId: string, contactId: string): Promise<void> {
	const today = ymdInChicago();
	const [loans, profileRes, contactRes, template, existingRes] = await Promise.all([
		openLoansForContact(supabase, contactId),
		supabase
			.from('profiles')
			.select('full_name, loan_reminder_lead_days')
			.eq('id', userId)
			.maybeSingle(),
		supabase.from('contacts').select('first_name, last_name').eq('id', contactId).maybeSingle(),
		templateForKey(supabase, LIBRARY_LOAN_REMINDER_KEY),
		supabase
			.from('book_loan_messages')
			.select('id, status')
			.eq('contact_id', contactId)
			.eq('kind', 'reminder')
			.is('deleted_at', null)
			.in('status', ['queued', 'sending', 'failed'])
			.order('scheduled_for')
			.limit(1)
	]);
	const existing = existingRes.data?.[0] ?? null;
	if (existingRes.error) console.error('[loans] open reminder', existingRes.error);

	if (loans.length === 0) {
		if (existing && existing.status !== 'sending') {
			const { error } = await supabase
				.from('book_loan_messages')
				.update({ status: 'cancelled' })
				.eq('id', existing.id);
			if (error) console.error('[loans] cancel reminder', error);
		}
		return;
	}
	if (!template || !contactRes.data) return;
	if (existing?.status === 'sending') return;

	const lines = await linesForLoans(supabase, loans);
	const scheduled = nextReminderYmd(
		lines.map((line) => line.dueOn),
		profileRes.data?.loan_reminder_lead_days ?? DEFAULT_REMINDER_LEAD_DAYS,
		today
	);
	if (!scheduled) return;
	const values = buildLoanMergeValues({
		firstName: contactRes.data.first_name,
		lastName: contactRes.data.last_name,
		books: lines,
		asOfYmd: scheduled,
		reminderLeadDays: profileRes.data?.loan_reminder_lead_days,
		ownerFullName: profileRes.data?.full_name
	});
	const copy = renderPair(template.subject, template.html_body, values);
	if ('error' in copy) {
		console.error('[loans] reminder copy', copy.error);
		return;
	}
	const payload = {
		subject: copy.subject,
		html_body: copy.html,
		scheduled_for: scheduled,
		status: 'queued' as const,
		error: null,
		template_id: template.id
	};
	if (existing) {
		const { error } = await supabase.from('book_loan_messages').update(payload).eq('id', existing.id);
		if (error) console.error('[loans] refresh reminder', error);
		return;
	}
	const { error } = await supabase.from('book_loan_messages').insert({
		...payload,
		loan_id: null,
		contact_id: contactId,
		kind: 'reminder',
		created_by: userId
	});
	if (error && error.code !== '23505') console.error('[loans] queue reminder', error);
}

export async function checkoutBookAction(supabase: Db, userId: string, fd: FormData) {
	const kind = 'checkoutBook' as const;
	if (!(await requireOwner(supabase, userId))) {
		return fail(403, { kind, message: 'Only the owner can check out a book.' });
	}
	const bookIds = bookIdsFrom(fd);
	const contactId = trim(fd, 'contact_id');
	if (bookIds.length === 0 || !UUID_RE.test(contactId)) {
		return fail(400, { kind, message: 'Choose a book and a contact.' });
	}

	const [booksRes, contactRes, openRes, profileRes, checkoutTemplate, reminderTemplate] =
		await Promise.all([
			supabase
				.from('books')
				.select('id, title, volume_number, owned, copy_count, author_display')
				.in('id', bookIds)
				.is('deleted_at', null),
			supabase
				.from('contacts')
				.select('id, first_name, last_name, email')
				.eq('id', contactId)
				.is('deleted_at', null)
				.maybeSingle(),
			supabase
				.from('book_loans')
				.select('book_id')
				.in('book_id', bookIds)
				.is('deleted_at', null)
				.is('returned_at', null),
			supabase
				.from('profiles')
				.select('full_name, loan_due_days, loan_reminder_lead_days')
				.eq('id', userId)
				.maybeSingle(),
			templateForKey(supabase, LIBRARY_LOAN_CHECKOUT_KEY),
			templateForKey(supabase, LIBRARY_LOAN_REMINDER_KEY)
		]);

	if (booksRes.error || !booksRes.data || booksRes.data.length !== bookIds.length) {
		return fail(404, { kind, message: 'Book not found.' });
	}
	if (contactRes.error || !contactRes.data) {
		return fail(404, { kind, message: 'Contact not found.' });
	}
	const email = (contactRes.data.email ?? '').trim();
	if (!isLoanEmail(email)) {
		return fail(400, { kind, message: 'Add an email address on the contact before checking a book out.' });
	}
	const openByBook = new Map<string, number>();
	for (const row of openRes.data ?? []) {
		openByBook.set(row.book_id, (openByBook.get(row.book_id) ?? 0) + 1);
	}
	for (const book of booksRes.data) {
		if (
			!canCheckOutCopy({
				owned: book.owned,
				copyCount: book.copy_count,
				openLoanCount: openByBook.get(book.id) ?? 0
			})
		) {
			const why = book.owned
				? `Every copy of ${book.title?.trim() || 'that book'} is already out.`
				: 'One of these books is not in the physical library.';
			return fail(400, { kind, message: why });
		}
	}
	if (!checkoutTemplate || !reminderTemplate) {
		return fail(400, { kind, message: 'The checkout or reminder template is missing. Edit it in Settings.' });
	}

	const today = ymdInChicago();
	const dueDays = profileRes.data?.loan_due_days ?? 30;
	const requested = trim(fd, 'due_on');
	const dueOn = isYmd(requested) ? requested : addDaysYmd(today, dueDays);
	if (!dueOn) return fail(400, { kind, message: 'Choose a due date.' });
	const span = daysBetweenYmd(today, dueOn);
	const interval = span != null && span >= 1 && span <= 366 ? span : 1;

	const books = booksRes.data;
	const checkoutValues = buildLoanMergeValues({
		firstName: contactRes.data.first_name,
		lastName: contactRes.data.last_name,
		books: books.map((book) => ({
			title: titledBook(book),
			authors: book.author_display,
			checkedOutOn: today,
			dueOn
		})),
		asOfYmd: today,
		reminderLeadDays: profileRes.data?.loan_reminder_lead_days,
		ownerFullName: profileRes.data?.full_name
	});
	const checkoutCopy = renderPair(checkoutTemplate.subject, checkoutTemplate.html_body, checkoutValues);
	if ('error' in checkoutCopy) return fail(400, { kind, message: checkoutCopy.error });

	const name = contactFullName(contactRes.data.first_name, contactRes.data.last_name) || email;
	const inserted: string[] = [];
	for (const bookId of bookIds) {
		const { data: loan, error: loanError } = await supabase
			.from('book_loans')
			.insert({
				book_id: bookId,
				contact_id: contactId,
				recipient_name: name,
				recipient_email: email,
				checked_out_on: today,
				due_on: dueOn,
				interval_days: interval,
				created_by: userId
			})
			.select('id')
			.single();
		if (loanError || !loan) {
			console.error('[loans] insert', loanError);
			if (inserted.length > 0) {
				await supabase
					.from('book_loans')
					.update({ deleted_at: new Date().toISOString() })
					.in('id', inserted);
			}
			return fail(500, { kind, message: 'Could not check the books out.' });
		}
		inserted.push(loan.id);
	}

	const { data: message, error: messageError } = await supabase
		.from('book_loan_messages')
		.insert({
			loan_id: null,
			contact_id: contactId,
			kind: 'checkout',
			template_id: checkoutTemplate.id,
			subject: checkoutCopy.subject,
			html_body: checkoutCopy.html,
			scheduled_for: today,
			status: 'queued',
			created_by: userId
		})
		.select('id')
		.single();
	if (messageError || !message) {
		console.error('[loans] messages', messageError);
		await supabase.from('book_loans').update({ deleted_at: new Date().toISOString() }).in('id', inserted);
		return fail(500, { kind, message: 'Could not queue the email.' });
	}

	await refreshContactReminder(supabase, userId, contactId);
	const sendError = await invokeSend(supabase, message.id);
	return {
		kind,
		success: true as const,
		loanId: inserted[0],
		message: sendError ?? undefined
	};
}

export async function returnBookAction(supabase: Db, userId: string, fd: FormData) {
	const kind = 'returnBook' as const;
	if (!(await requireOwner(supabase, userId))) {
		return fail(403, { kind, message: 'Only the owner can mark a book returned.' });
	}
	const loanId = trim(fd, 'loan_id');
	if (!UUID_RE.test(loanId)) return fail(400, { kind, message: 'Loan not found.' });

	const now = new Date().toISOString();
	const { data, error } = await supabase
		.from('book_loans')
		.update({ returned_at: now })
		.eq('id', loanId)
		.is('deleted_at', null)
		.is('returned_at', null)
		.select('id, contact_id')
		.maybeSingle();
	if (error || !data) {
		console.error('[loans] return', error);
		return fail(400, { kind, message: 'That loan is already closed.' });
	}
	const { error: cancelError } = await supabase
		.from('book_loan_messages')
		.update({ status: 'cancelled' })
		.eq('loan_id', loanId)
		.eq('kind', 'checkout')
		.is('deleted_at', null)
		.in('status', ['queued', 'failed']);
	if (cancelError) console.error('[loans] cancel', cancelError);
	await refreshContactReminder(supabase, userId, data.contact_id);
	return { kind, success: true as const, loanId };
}

export async function updateLoanReminderAction(supabase: Db, userId: string, fd: FormData) {
	const kind = 'updateLoanReminder' as const;
	if (!(await requireOwner(supabase, userId))) {
		return fail(403, { kind, message: 'Only the owner can edit a reminder.' });
	}
	const messageId = trim(fd, 'message_id');
	const scheduledFor = trim(fd, 'scheduled_for');
	const subject = trim(fd, 'subject');
	const html = String(fd.get('html_body') ?? '');
	if (!UUID_RE.test(messageId)) return fail(400, { kind, message: 'Reminder not found.' });
	if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledFor)) {
		return fail(400, { kind, message: 'Choose a reminder date.' });
	}
	if (!subject) return fail(400, { kind, message: 'Subject is required.' });

	const { data: message, error } = await supabase
		.from('book_loan_messages')
		.select('id, contact_id, status, kind')
		.eq('id', messageId)
		.is('deleted_at', null)
		.maybeSingle();
	if (error || !message || message.kind !== 'reminder') {
		return fail(404, { kind, message: 'Reminder not found.' });
	}
	if (message.status !== 'queued' && message.status !== 'failed') {
		return fail(400, { kind, message: 'That reminder has already been sent.' });
	}

	const loans = await openLoansForContact(supabase, message.contact_id);
	if (loans.length === 0) return fail(400, { kind, message: 'These books are already back.' });

	const [contactRes, profileRes, lines] = await Promise.all([
		supabase.from('contacts').select('first_name, last_name').eq('id', message.contact_id).maybeSingle(),
		supabase
			.from('profiles')
			.select('full_name, loan_reminder_lead_days')
			.eq('id', userId)
			.maybeSingle(),
		linesForLoans(supabase, loans)
	]);
	const values = buildLoanMergeValues({
		firstName: contactRes.data?.first_name ?? '',
		lastName: contactRes.data?.last_name ?? null,
		books: lines,
		asOfYmd: scheduledFor,
		reminderLeadDays: profileRes.data?.loan_reminder_lead_days,
		ownerFullName: profileRes.data?.full_name
	});
	const rendered = renderPair(subject, html, values);
	if ('error' in rendered) return fail(400, { kind, message: rendered.error });

	const { error: updateError } = await supabase
		.from('book_loan_messages')
		.update({
			subject: rendered.subject,
			html_body: rendered.html,
			scheduled_for: scheduledFor,
			status: 'queued',
			error: null
		})
		.eq('id', messageId);
	if (updateError) {
		console.error('[loans] reminder', updateError);
		return fail(500, { kind, message: 'Could not save the reminder.' });
	}
	return { kind, success: true as const, messageId };
}

export async function updateLoanDueAction(supabase: Db, userId: string, fd: FormData) {
	const kind = 'updateLoanDue' as const;
	if (!(await requireOwner(supabase, userId))) {
		return fail(403, { kind, message: 'Only the owner can change a due date.' });
	}
	const loanId = trim(fd, 'loan_id');
	if (!UUID_RE.test(loanId)) return fail(400, { kind, message: 'Loan not found.' });
	const { data: loan, error } = await supabase
		.from('book_loans')
		.select('id, due_on, contact_id')
		.eq('id', loanId)
		.is('deleted_at', null)
		.is('returned_at', null)
		.maybeSingle();
	if (error || !loan) return fail(404, { kind, message: 'Loan not found.' });

	const requested = trim(fd, 'due_on');
	const extend = trim(fd, 'extend_days');
	const dueOn = isYmd(requested)
		? requested
		: extend === '14'
			? addDaysYmd(loan.due_on, 14)
			: null;
	if (!dueOn) return fail(400, { kind, message: 'Choose a due date.' });

	const { error: updateError } = await supabase
		.from('book_loans')
		.update({ due_on: dueOn })
		.eq('id', loanId);
	if (updateError) {
		console.error('[loans] due', updateError);
		return fail(500, { kind, message: 'Could not save the due date.' });
	}
	await refreshContactReminder(supabase, userId, loan.contact_id);
	return { kind, success: true as const, loanId };
}

export async function updateLoanDefaultsAction(supabase: Db, userId: string, fd: FormData) {
	const kind = 'updateLoanDefaults' as const;
	if (!(await requireOwner(supabase, userId))) {
		return fail(403, { kind, message: 'Only the owner can change loan defaults.' });
	}
	const dueDays = parseLoanInterval(trim(fd, 'loan_due_days'));
	const leadDays = parseReminderLead(trim(fd, 'loan_reminder_lead_days'));
	if (dueDays == null || leadDays == null) {
		return fail(400, { kind, message: 'Due length is 1–366 days. The reminder lead is 0–60 days.' });
	}
	const { error } = await supabase
		.from('profiles')
		.update({ loan_due_days: dueDays, loan_reminder_lead_days: leadDays })
		.eq('id', userId);
	if (error) {
		console.error('[loans] defaults', error);
		return fail(500, { kind, message: 'Could not save the loan defaults.' });
	}
	return { kind, success: true as const };
}

export async function updateLoanEmailAction(supabase: Db, userId: string, fd: FormData) {
	const kind = 'updateLoanEmail' as const;
	if (!(await requireOwner(supabase, userId))) {
		return fail(403, { kind, message: 'Only the owner can change the email.' });
	}
	const loanId = trim(fd, 'loan_id');
	const email = trim(fd, 'recipient_email');
	if (!UUID_RE.test(loanId) || !isLoanEmail(email)) {
		return fail(400, { kind, message: 'Enter a valid email address.' });
	}
	const { error } = await supabase
		.from('book_loans')
		.update({ recipient_email: email })
		.eq('id', loanId)
		.is('deleted_at', null)
		.is('returned_at', null);
	if (error) {
		console.error('[loans] email', error);
		return fail(500, { kind, message: 'Could not save the email.' });
	}
	return { kind, success: true as const, loanId };
}

export async function retryLoanMessageAction(supabase: Db, userId: string, fd: FormData) {
	const kind = 'retryLoanMessage' as const;
	if (!(await requireOwner(supabase, userId))) {
		return fail(403, { kind, message: 'Only the owner can send email.' });
	}
	const messageId = trim(fd, 'message_id');
	if (!UUID_RE.test(messageId)) return fail(400, { kind, message: 'Message not found.' });
	const sendError = await invokeSend(supabase, messageId);
	if (sendError) return fail(502, { kind, message: sendError, messageId });
	return { kind, success: true as const, messageId };
}
