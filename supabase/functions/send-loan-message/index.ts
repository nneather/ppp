import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
	bookTitleSummary,
	ccBesidesRecipient,
	daysBetweenYmd,
	emailHtmlToText,
	formatLoanDate,
	loanBooksHtml,
	nextReminderYmd,
	ownerFirstName,
	renderEmailTemplate,
	sanitizeEmailHtml,
	secretsMatch,
	type LoanMergeValues,
	withLoanBookList,
	wrapLoanEmail,
	ymdInChicago
} from '../_shared/loan-email.ts';

const REMINDER_KEY = 'library.loan.reminder';
const DEFAULT_FROM = 'Parker Neathery <parker@npneathery.com>';
const REPLY_TO = 'parker@npneathery.com';
const DRAIN_LIMIT = 25;

type Admin = SupabaseClient;

type LoanRow = {
	id: string;
	book_id: string;
	contact_id: string;
	recipient_name: string;
	recipient_email: string;
	checked_out_on: string;
	due_on: string;
	returned_at: string | null;
	created_by: string | null;
	deleted_at: string | null;
};

type MessageRow = {
	id: string;
	loan_id: string | null;
	contact_id: string;
	kind: 'checkout' | 'reminder';
	subject: string;
	html_body: string;
	scheduled_for: string;
	status: string;
};

type BookLine = {
	title: string;
	authors: string | null;
	checkedOutOn: string;
	dueOn: string;
};

function resolveCorsOrigin(req: Request): string | null {
	const origin = req.headers.get('Origin');
	if (!origin) return null;
	const site = Deno.env.get('SITE_URL')?.replace(/\/$/, '');
	if (site && origin === site) return origin;
	const extras = Deno.env.get('CORS_ALLOWED_ORIGINS')?.split(',').map((s) => s.trim()) ?? [];
	if (extras.includes(origin)) return origin;
	if (origin.endsWith('.vercel.app')) return origin;
	return null;
}

function corsHeadersFor(req: Request): Record<string, string> {
	const origin = resolveCorsOrigin(req);
	return {
		...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
		'Access-Control-Allow-Headers':
			'authorization, x-client-info, apikey, content-type, x-loan-cron-secret',
		Vary: 'Origin'
	};
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' }
	});
}

function fromAddress(): string {
	const raw = Deno.env.get('LIBRARY_LOAN_RESEND_FROM')?.trim();
	if (!raw || raw.length < 5 || raw.length > 512 || !raw.includes('@')) return DEFAULT_FROM;
	return raw;
}

async function getUserIdFromAuthApi(
	supabaseUrl: string,
	anonKey: string,
	authHeader: string
): Promise<string | null> {
	const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
		headers: { Authorization: authHeader, apikey: anonKey }
	});
	if (!res.ok) return null;
	const body = (await res.json().catch(() => null)) as { id?: unknown } | null;
	return body && typeof body.id === 'string' && body.id.length > 0 ? body.id : null;
}

async function requireOwner(admin: Admin, userId: string): Promise<boolean> {
	const { data, error } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
	if (error || !data) return false;
	return (data as { role: string }).role === 'owner';
}

function mergeFor(input: {
	recipientName: string;
	books: readonly BookLine[];
	asOfYmd: string;
	reminderLeadDays: number;
	ownerFullName: string | null;
}): LoanMergeValues {
	const [first, ...rest] = input.recipientName.trim().split(/\s+/);
	const books = [...input.books];
	const earliestOut = [...books].sort((a, b) => a.checkedOutOn.localeCompare(b.checkedOutOn))[0];
	const earliestDue = [...books].sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
	const checkedOutOn = earliestOut?.checkedOutOn ?? input.asOfYmd;
	const days = daysBetweenYmd(checkedOutOn, input.asOfYmd);
	const sole = books.length === 1 ? books[0] : null;
	const lead = input.reminderLeadDays;
	const reminderLead =
		Number.isInteger(lead) && lead >= 0 && lead <= 60 ? String(lead) : '7';
	return {
		'contact.first_name': first ?? '',
		'contact.last_name': rest.join(' '),
		'contact.full_name': input.recipientName.trim(),
		'book.title': bookTitleSummary(books.map((book) => book.title)),
		'book.authors': (sole?.authors ?? '').trim(),
		'loan.checked_out_on': formatLoanDate(checkedOutOn),
		'loan.due_on': earliestDue ? formatLoanDate(earliestDue.dueOn) : '',
		'loan.days_out': String(days != null && days > 0 ? days : 0),
		'loan.reminder_lead': reminderLead,
		'loan.books': loanBooksHtml(books),
		'client.name': '',
		'invoice.number': '',
		'invoice.period': '',
		'invoice.total': '',
		'invoice.message': '',
		'owner.first_name': ownerFirstName(input.ownerFullName)
	};
}

const LOAN_COLUMNS =
	'id, book_id, contact_id, recipient_name, recipient_email, checked_out_on, due_on, returned_at, created_by, deleted_at';

async function openLoansForContact(admin: Admin, contactId: string): Promise<LoanRow[]> {
	const { data } = await admin
		.from('book_loans')
		.select(LOAN_COLUMNS)
		.eq('contact_id', contactId)
		.is('returned_at', null)
		.is('deleted_at', null);
	return (data ?? []) as LoanRow[];
}

async function linesFor(admin: Admin, loans: readonly LoanRow[]): Promise<BookLine[]> {
	if (loans.length === 0) return [];
	const { data } = await admin
		.from('books')
		.select('id, title, volume_number, author_display')
		.in('id', [...new Set(loans.map((loan) => loan.book_id))]);
	const byId = new Map(
		((data ?? []) as { id: string; title: string | null; volume_number: string | null; author_display: string | null }[]).map(
			(book) => [book.id, book]
		)
	);
	return [...loans]
		.sort((a, b) => a.due_on.localeCompare(b.due_on))
		.map((loan) => {
			const book = byId.get(loan.book_id);
			const title = book?.title?.trim() || 'Untitled';
			const volume = book?.volume_number?.trim();
			return {
				title: volume ? `${title}, vol. ${volume}` : title,
				authors: book?.author_display ?? null,
				checkedOutOn: loan.checked_out_on,
				dueOn: loan.due_on
			};
		});
}

async function ownerDefaultCc(admin: Admin): Promise<string[]> {
	const { data } = await admin
		.from('profiles')
		.select('default_cc_emails')
		.eq('role', 'owner')
		.limit(1)
		.maybeSingle();
	const raw = (data as { default_cc_emails?: unknown } | null)?.default_cc_emails;
	if (!Array.isArray(raw)) return [];
	return raw.filter((item): item is string => typeof item === 'string');
}

async function ownerProfile(
	admin: Admin
): Promise<{ full_name: string | null; loan_reminder_lead_days: number }> {
	const { data } = await admin
		.from('profiles')
		.select('full_name, loan_reminder_lead_days')
		.eq('role', 'owner')
		.limit(1)
		.maybeSingle();
	const row = data as { full_name: string | null; loan_reminder_lead_days: number } | null;
	return { full_name: row?.full_name ?? null, loan_reminder_lead_days: row?.loan_reminder_lead_days ?? 7 };
}

async function reminderTemplate(
	admin: Admin
): Promise<{ id: string; subject: string; html_body: string } | null> {
	const { data: binding } = await admin
		.from('email_template_bindings')
		.select('template_id')
		.eq('binding_key', REMINDER_KEY)
		.is('deleted_at', null)
		.maybeSingle();
	const templateId = (binding as { template_id?: string } | null)?.template_id;
	if (!templateId) return null;
	const { data: template } = await admin
		.from('email_templates')
		.select('id, subject, html_body, is_active')
		.eq('id', templateId)
		.is('deleted_at', null)
		.maybeSingle();
	const row = template as { id: string; subject: string; html_body: string; is_active: boolean } | null;
	if (!row?.is_active) return null;
	return row;
}

async function queueNextReminder(admin: Admin, loans: readonly LoanRow[]): Promise<void> {
	const lead = loans[0];
	if (!lead) return;
	const owner = await ownerProfile(admin);
	const today = ymdInChicago();
	const lines = await linesFor(admin, loans);
	const scheduled = nextReminderYmd(
		lines.map((line) => line.dueOn),
		owner.loan_reminder_lead_days,
		today
	);
	if (!scheduled) return;
	const template = await reminderTemplate(admin);
	if (!template) {
		console.error('[send-loan-message] reminder template missing');
		return;
	}
	const values = mergeFor({
		recipientName: lead.recipient_name,
		books: lines,
		asOfYmd: scheduled,
		reminderLeadDays: owner.loan_reminder_lead_days,
		ownerFullName: owner.full_name
	});
	const rendered = renderEmailTemplate(template.html_body, values, { html: true });
	const { error } = await admin.from('book_loan_messages').insert({
		loan_id: null,
		contact_id: lead.contact_id,
		kind: 'reminder',
		template_id: template.id,
		subject: renderEmailTemplate(template.subject, values).trim(),
		html_body: sanitizeEmailHtml(withLoanBookList(template.html_body, rendered, values['loan.books'])),
		scheduled_for: scheduled,
		status: 'queued',
		created_by: lead.created_by
	});
	if (error && error.code !== '23505') console.error('[send-loan-message] queue next', error);
}

async function sendClaimed(
	admin: Admin,
	resendKey: string,
	message: MessageRow,
	loans: readonly LoanRow[]
): Promise<{ ok: true } | { ok: false; error: string }> {
	const open = loans.filter((loan) => !loan.returned_at && !loan.deleted_at);
	const recipient = [...open].sort((a, b) => a.due_on.localeCompare(b.due_on))[0];
	if (!recipient) {
		await admin
			.from('book_loan_messages')
			.update({ status: 'cancelled', error: null })
			.eq('id', message.id);
		return { ok: true };
	}

	const html = wrapLoanEmail(message.html_body);
	const cc = ccBesidesRecipient(await ownerDefaultCc(admin), recipient.recipient_email);
	const payload: Record<string, unknown> = {
		from: fromAddress(),
		to: [recipient.recipient_email],
		reply_to: REPLY_TO,
		subject: message.subject,
		html,
		text: emailHtmlToText(html)
	};
	if (cc.length > 0) payload.cc = cc;
	const resendRes = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (!resendRes.ok) {
		const errText = await resendRes.text();
		console.error('[send-loan-message] Resend', resendRes.status, errText);
		let detail = 'Failed to send email';
		try {
			const parsed = JSON.parse(errText) as { message?: string };
			if (typeof parsed.message === 'string' && parsed.message.length > 0) detail = parsed.message;
		} catch {
			if (errText.length > 0 && errText.length < 400) detail = errText;
		}
		await admin
			.from('book_loan_messages')
			.update({ status: 'failed', error: detail.slice(0, 500) })
			.eq('id', message.id);
		return { ok: false, error: detail };
	}

	const sent = (await resendRes.json().catch(() => null)) as { id?: string } | null;
	const sentAt = new Date().toISOString();
	await admin
		.from('book_loan_messages')
		.update({
			status: 'sent',
			sent_at: sentAt,
			provider_id: sent?.id ?? null,
			error: null
		})
		.eq('id', message.id);

	if (message.kind === 'reminder') {
		await queueNextReminder(admin, open);
	}
	return { ok: true };
}

async function claimAndSend(
	admin: Admin,
	resendKey: string,
	messageId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
	const { data: existing } = await admin
		.from('book_loan_messages')
		.select('id, loan_id, contact_id, kind, subject, html_body, scheduled_for, status')
		.eq('id', messageId)
		.is('deleted_at', null)
		.maybeSingle();
	const message = existing as MessageRow | null;
	if (!message) return { ok: false, error: 'Email not found.', status: 404 };
	if (message.status === 'sent' || message.status === 'cancelled') {
		return { ok: true };
	}
	if (message.status !== 'queued' && message.status !== 'failed') {
		return { ok: false, error: 'That email is already on its way.', status: 409 };
	}

	const { data: claimed, error: claimError } = await admin
		.from('book_loan_messages')
		.update({ status: 'sending', error: null })
		.eq('id', message.id)
		.in('status', ['queued', 'failed'])
		.select('id')
		.maybeSingle();
	if (claimError || !claimed) {
		return { ok: false, error: 'That email is already on its way.', status: 409 };
	}

	const loans = await openLoansForContact(admin, message.contact_id);
	if (loans.length === 0 && message.kind === 'checkout' && message.loan_id) {
		const { data: loanRow } = await admin
			.from('book_loans')
			.select(LOAN_COLUMNS)
			.eq('id', message.loan_id)
			.maybeSingle();
		const loan = loanRow as LoanRow | null;
		if (loan && !loan.returned_at && !loan.deleted_at) loans.push(loan);
	}
	if (loans.length === 0) {
		await admin
			.from('book_loan_messages')
			.update({ status: 'cancelled', error: null })
			.eq('id', message.id);
		return { ok: true };
	}
	return sendClaimed(admin, resendKey, message, loans);
}

async function repairOpenReminders(admin: Admin): Promise<void> {
	const { data: loans } = await admin
		.from('book_loans')
		.select(LOAN_COLUMNS)
		.is('returned_at', null)
		.is('deleted_at', null);
	const open = (loans ?? []) as LoanRow[];
	if (open.length === 0) return;

	const byContact = new Map<string, LoanRow[]>();
	for (const loan of open) {
		const group = byContact.get(loan.contact_id) ?? [];
		group.push(loan);
		byContact.set(loan.contact_id, group);
	}
	const contactIds = [...byContact.keys()];
	const { data: messages } = await admin
		.from('book_loan_messages')
		.select('contact_id, status')
		.in('contact_id', contactIds)
		.eq('kind', 'reminder')
		.is('deleted_at', null)
		.in('status', ['queued', 'sending', 'failed']);
	const covered = new Set(
		((messages ?? []) as { contact_id: string }[]).map((row) => row.contact_id)
	);
	for (const [contactId, group] of byContact) {
		if (covered.has(contactId)) continue;
		await queueNextReminder(admin, group);
	}
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeadersFor(req) });
	}
	if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405);

	const supabaseUrl = Deno.env.get('SUPABASE_URL');
	const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
	const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
	const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
	if (!supabaseUrl || !anonKey || !serviceKey || !resendKey) {
		return jsonResponse(req, { error: 'Server configuration error' }, 500);
	}
	const admin = createClient(supabaseUrl, serviceKey);

	let body: { message_id?: string; drain?: boolean } = {};
	try {
		body = (await req.json()) as { message_id?: string; drain?: boolean };
	} catch {
		return jsonResponse(req, { error: 'Expected JSON.' }, 400);
	}

	if (body.drain === true) {
		const expected = Deno.env.get('LOAN_REMINDER_CRON_SECRET')?.trim() ?? '';
		const given = req.headers.get('x-loan-cron-secret')?.trim() ?? '';
		if (expected.length < 16 || !secretsMatch(given, expected)) {
			return jsonResponse(req, { error: 'Unauthorized' }, 401);
		}
		const today = ymdInChicago();
		await repairOpenReminders(admin);
		const { data: due, error } = await admin
			.from('book_loan_messages')
			.select('id')
			.eq('status', 'queued')
			.is('deleted_at', null)
			.lte('scheduled_for', today)
			.order('scheduled_for')
			.limit(DRAIN_LIMIT);
		if (error) {
			console.error('[send-loan-message] drain', error);
			return jsonResponse(req, { error: 'Could not load due emails.' }, 500);
		}
		let sent = 0;
		let failed = 0;
		for (const row of (due ?? []) as { id: string }[]) {
			const result = await claimAndSend(admin, resendKey, row.id);
			if (result.ok) sent += 1;
			else failed += 1;
		}
		return jsonResponse(req, { success: true, sent, failed });
	}

	const authHeader = req.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer ')) return jsonResponse(req, { error: 'Unauthorized' }, 401);
	const userId = await getUserIdFromAuthApi(supabaseUrl, anonKey, authHeader);
	if (!userId) return jsonResponse(req, { error: 'Unauthorized' }, 401);
	if (!(await requireOwner(admin, userId))) return jsonResponse(req, { error: 'Forbidden' }, 403);
	const messageId = body.message_id?.trim() ?? '';
	if (!/^[0-9a-f-]{36}$/i.test(messageId)) {
		return jsonResponse(req, { error: 'Missing message.' }, 400);
	}
	const result = await claimAndSend(admin, resendKey, messageId);
	if (!result.ok) return jsonResponse(req, { error: result.error }, result.status);
	return jsonResponse(req, { success: true });
});
