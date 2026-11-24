import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ymdInChicago } from '$lib/invoicing/chicago-date';
import { canCheckOutCopy, isLoanEmail, parseLoanInterval } from '$lib/email/loans';
import {
	contactFullName,
	daysBetweenYmd,
	formatLoanDate,
	ownerFirstName,
	reminderDateAfter,
	renderEmailTemplate,
	type EmailMergeValues
} from '$lib/email/render';
import { sanitizeEmailHtml } from '$lib/email/sanitize';
import {
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
	| 'updateLoanInterval'
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

export function buildLoanMergeValues(input: {
	firstName: string;
	lastName: string | null;
	bookTitle: string | null;
	bookAuthors: string | null;
	checkedOutOn: string;
	asOfYmd: string;
	ownerFullName: string | null | undefined;
}): EmailMergeValues {
	const days = daysBetweenYmd(input.checkedOutOn, input.asOfYmd);
	return {
		'contact.first_name': input.firstName.trim(),
		'contact.last_name': (input.lastName ?? '').trim(),
		'contact.full_name': contactFullName(input.firstName, input.lastName),
		'book.title': input.bookTitle?.trim() || 'a book',
		'book.authors': (input.bookAuthors ?? '').trim(),
		'loan.checked_out_on': formatLoanDate(input.checkedOutOn),
		'loan.days_out': String(days != null && days > 0 ? days : 0),
		'owner.first_name': ownerFirstName(input.ownerFullName)
	};
}

function renderPair(
	subject: string,
	html: string,
	values: EmailMergeValues
): { subject: string; html: string } | { error: string } {
	const unknown = unknownEmailTokens(subject, html);
	if (unknown.length > 0) return { error: `Unknown merge field: ${unknown.join(', ')}` };
	return {
		subject: renderEmailTemplate(subject, values).trim(),
		html: sanitizeEmailHtml(renderEmailTemplate(html, values))
	};
}

export async function checkoutBookAction(supabase: Db, userId: string, fd: FormData) {
	const kind = 'checkoutBook' as const;
	if (!(await requireOwner(supabase, userId))) {
		return fail(403, { kind, message: 'Only the owner can check out a book.' });
	}
	const bookId = trim(fd, 'book_id');
	const contactId = trim(fd, 'contact_id');
	if (!UUID_RE.test(bookId) || !UUID_RE.test(contactId)) {
		return fail(400, { kind, message: 'Choose a book and a contact.' });
	}

	const [bookRes, contactRes, countRes, profileRes, checkoutTemplate, reminderTemplate] =
		await Promise.all([
			supabase
				.from('books')
				.select('id, title, owned, copy_count, author_display')
				.eq('id', bookId)
				.is('deleted_at', null)
				.maybeSingle(),
			supabase
				.from('contacts')
				.select('id, first_name, last_name, email')
				.eq('id', contactId)
				.is('deleted_at', null)
				.maybeSingle(),
			supabase
				.from('book_loans')
				.select('id', { count: 'exact', head: true })
				.eq('book_id', bookId)
				.is('deleted_at', null)
				.is('returned_at', null),
			supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
			templateForKey(supabase, LIBRARY_LOAN_CHECKOUT_KEY),
			templateForKey(supabase, LIBRARY_LOAN_REMINDER_KEY)
		]);

	if (bookRes.error || !bookRes.data) {
		return fail(404, { kind, message: 'Book not found.' });
	}
	if (contactRes.error || !contactRes.data) {
		return fail(404, { kind, message: 'Contact not found.' });
	}
	const email = (contactRes.data.email ?? '').trim();
	if (!isLoanEmail(email)) {
		return fail(400, { kind, message: 'Add an email address on the contact before checking a book out.' });
	}
	const openCount = countRes.count ?? 0;
	if (
		!canCheckOutCopy({
			owned: bookRes.data.owned,
			copyCount: bookRes.data.copy_count,
			openLoanCount: openCount
		})
	) {
		const why = bookRes.data.owned ? 'Every copy is already out.' : 'This book is not in the physical library.';
		return fail(400, { kind, message: why });
	}
	if (!checkoutTemplate || !reminderTemplate) {
		return fail(400, { kind, message: 'The checkout or reminder template is missing. Edit it in Settings.' });
	}

	const today = ymdInChicago();
	const interval = 30;
	const reminderOn = reminderDateAfter(today, interval);
	if (!reminderOn) return fail(400, { kind, message: 'Could not schedule the reminder.' });

	const checkoutValues = buildLoanMergeValues({
		firstName: contactRes.data.first_name,
		lastName: contactRes.data.last_name,
		bookTitle: bookRes.data.title,
		bookAuthors: bookRes.data.author_display,
		checkedOutOn: today,
		asOfYmd: today,
		ownerFullName: profileRes.data?.full_name
	});
	const reminderValues = buildLoanMergeValues({
		firstName: contactRes.data.first_name,
		lastName: contactRes.data.last_name,
		bookTitle: bookRes.data.title,
		bookAuthors: bookRes.data.author_display,
		checkedOutOn: today,
		asOfYmd: reminderOn,
		ownerFullName: profileRes.data?.full_name
	});
	const checkoutCopy = renderPair(checkoutTemplate.subject, checkoutTemplate.html_body, checkoutValues);
	const reminderCopy = renderPair(reminderTemplate.subject, reminderTemplate.html_body, reminderValues);
	if ('error' in checkoutCopy) return fail(400, { kind, message: checkoutCopy.error });
	if ('error' in reminderCopy) return fail(400, { kind, message: reminderCopy.error });

	const name = contactFullName(contactRes.data.first_name, contactRes.data.last_name) || email;
	const { data: loan, error: loanError } = await supabase
		.from('book_loans')
		.insert({
			book_id: bookId,
			contact_id: contactId,
			recipient_name: name,
			recipient_email: email,
			checked_out_on: today,
			interval_days: interval,
			created_by: userId
		})
		.select('id')
		.single();
	if (loanError || !loan) {
		console.error('[loans] insert', loanError);
		return fail(500, { kind, message: 'Could not check the book out.' });
	}

	const { data: messages, error: messageError } = await supabase
		.from('book_loan_messages')
		.insert([
			{
				loan_id: loan.id,
				kind: 'checkout',
				template_id: checkoutTemplate.id,
				subject: checkoutCopy.subject,
				html_body: checkoutCopy.html,
				scheduled_for: today,
				status: 'queued',
				created_by: userId
			},
			{
				loan_id: loan.id,
				kind: 'reminder',
				template_id: reminderTemplate.id,
				subject: reminderCopy.subject,
				html_body: reminderCopy.html,
				scheduled_for: reminderOn,
				status: 'queued',
				created_by: userId
			}
		])
		.select('id, kind');
	if (messageError || !messages) {
		console.error('[loans] messages', messageError);
		await supabase.from('book_loans').update({ deleted_at: new Date().toISOString() }).eq('id', loan.id);
		return fail(500, { kind, message: 'Could not queue the emails.' });
	}

	const checkoutMessage = messages.find((m) => m.kind === 'checkout');
	const sendError = checkoutMessage ? await invokeSend(supabase, checkoutMessage.id) : 'Checkout email is missing.';
	return {
		kind,
		success: true as const,
		loanId: loan.id,
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
		.select('id')
		.maybeSingle();
	if (error || !data) {
		console.error('[loans] return', error);
		return fail(400, { kind, message: 'That loan is already closed.' });
	}
	const { error: cancelError } = await supabase
		.from('book_loan_messages')
		.update({ status: 'cancelled' })
		.eq('loan_id', loanId)
		.is('deleted_at', null)
		.in('status', ['queued', 'failed']);
	if (cancelError) console.error('[loans] cancel', cancelError);
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
		.select('id, loan_id, status, kind')
		.eq('id', messageId)
		.is('deleted_at', null)
		.maybeSingle();
	if (error || !message || message.kind !== 'reminder') {
		return fail(404, { kind, message: 'Reminder not found.' });
	}
	if (message.status !== 'queued' && message.status !== 'failed') {
		return fail(400, { kind, message: 'That reminder has already been sent.' });
	}

	const { data: loan } = await supabase
		.from('book_loans')
		.select('id, checked_out_on, returned_at, contact_id, book_id')
		.eq('id', message.loan_id)
		.is('deleted_at', null)
		.maybeSingle();
	if (!loan || loan.returned_at) return fail(400, { kind, message: 'This book is already back.' });

	const [contactRes, bookRes, profileRes] = await Promise.all([
		supabase.from('contacts').select('first_name, last_name').eq('id', loan.contact_id).maybeSingle(),
		supabase.from('books').select('title, author_display').eq('id', loan.book_id).maybeSingle(),
		supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle()
	]);
	const values = buildLoanMergeValues({
		firstName: contactRes.data?.first_name ?? '',
		lastName: contactRes.data?.last_name ?? null,
		bookTitle: bookRes.data?.title ?? '',
		bookAuthors: bookRes.data?.author_display ?? null,
		checkedOutOn: loan.checked_out_on,
		asOfYmd: scheduledFor,
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

export async function updateLoanIntervalAction(supabase: Db, userId: string, fd: FormData) {
	const kind = 'updateLoanInterval' as const;
	if (!(await requireOwner(supabase, userId))) {
		return fail(403, { kind, message: 'Only the owner can change the interval.' });
	}
	const loanId = trim(fd, 'loan_id');
	const interval = parseLoanInterval(trim(fd, 'interval_days'));
	if (!UUID_RE.test(loanId) || interval == null) {
		return fail(400, { kind, message: 'Interval must be between 1 and 366 days.' });
	}
	const { error } = await supabase
		.from('book_loans')
		.update({ interval_days: interval })
		.eq('id', loanId)
		.is('deleted_at', null)
		.is('returned_at', null);
	if (error) {
		console.error('[loans] interval', error);
		return fail(500, { kind, message: 'Could not save the interval.' });
	}
	return { kind, success: true as const, loanId };
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
