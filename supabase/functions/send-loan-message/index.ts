import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
	addDaysYmd,
	daysBetweenYmd,
	emailHtmlToText,
	formatLoanDate,
	loanNeedsNextReminder,
	ownerFirstName,
	renderEmailTemplate,
	sanitizeEmailHtml,
	secretsMatch,
	type LoanMergeValues,
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
	returned_at: string | null;
	interval_days: number;
	created_by: string | null;
	deleted_at: string | null;
};

type MessageRow = {
	id: string;
	loan_id: string;
	kind: 'checkout' | 'reminder';
	subject: string;
	html_body: string;
	scheduled_for: string;
	status: string;
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
	bookTitle: string;
	bookAuthors: string | null;
	checkedOutOn: string;
	asOfYmd: string;
	ownerFullName: string | null;
}): LoanMergeValues {
	const [first, ...rest] = input.recipientName.trim().split(/\s+/);
	const days = daysBetweenYmd(input.checkedOutOn, input.asOfYmd);
	return {
		'contact.first_name': first ?? '',
		'contact.last_name': rest.join(' '),
		'contact.full_name': input.recipientName.trim(),
		'book.title': input.bookTitle.trim() || 'a book',
		'book.authors': (input.bookAuthors ?? '').trim(),
		'loan.checked_out_on': formatLoanDate(input.checkedOutOn),
		'loan.days_out': String(days != null && days > 0 ? days : 0),
		'owner.first_name': ownerFirstName(input.ownerFullName)
	};
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

async function queueNextReminder(
	admin: Admin,
	loan: LoanRow,
	ownerFullName: string | null,
	bookTitle: string,
	bookAuthors: string | null,
	anchorYmd: string
): Promise<void> {
	const scheduled = addDaysYmd(anchorYmd, loan.interval_days);
	if (!scheduled) return;
	const template = await reminderTemplate(admin);
	if (!template) {
		console.error('[send-loan-message] reminder template missing');
		return;
	}
	const values = mergeFor({
		recipientName: loan.recipient_name,
		bookTitle,
		bookAuthors,
		checkedOutOn: loan.checked_out_on,
		asOfYmd: scheduled,
		ownerFullName
	});
	const { error } = await admin.from('book_loan_messages').insert({
		loan_id: loan.id,
		kind: 'reminder',
		template_id: template.id,
		subject: renderEmailTemplate(template.subject, values).trim(),
		html_body: sanitizeEmailHtml(renderEmailTemplate(template.html_body, values)),
		scheduled_for: scheduled,
		status: 'queued',
		created_by: loan.created_by
	});
	if (error && error.code !== '23505') console.error('[send-loan-message] queue next', error);
}

async function sendClaimed(
	admin: Admin,
	resendKey: string,
	message: MessageRow,
	loan: LoanRow
): Promise<{ ok: true } | { ok: false; error: string }> {
	if (loan.returned_at || loan.deleted_at) {
		await admin
			.from('book_loan_messages')
			.update({ status: 'cancelled', error: null })
			.eq('id', message.id);
		return { ok: true };
	}

	const html = wrapLoanEmail(message.html_body);
	const resendRes = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			from: fromAddress(),
			to: [loan.recipient_email],
			reply_to: REPLY_TO,
			subject: message.subject,
			html,
			text: emailHtmlToText(html)
		})
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
		const { data: book } = await admin
			.from('books')
			.select('title, author_display')
			.eq('id', loan.book_id)
			.maybeSingle();
		const { data: owner } = await admin
			.from('profiles')
			.select('full_name')
			.eq('role', 'owner')
			.limit(1)
			.maybeSingle();
		await queueNextReminder(
			admin,
			loan,
			(owner as { full_name: string | null } | null)?.full_name ?? null,
			(book as { title: string | null } | null)?.title ?? '',
			(book as { author_display: string | null } | null)?.author_display ?? null,
			ymdInChicago(new Date(sentAt))
		);
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
		.select('id, loan_id, kind, subject, html_body, scheduled_for, status')
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

	const { data: loanRow } = await admin
		.from('book_loans')
		.select(
			'id, book_id, contact_id, recipient_name, recipient_email, checked_out_on, returned_at, interval_days, created_by, deleted_at'
		)
		.eq('id', message.loan_id)
		.maybeSingle();
	const loan = loanRow as LoanRow | null;
	if (!loan) {
		await admin
			.from('book_loan_messages')
			.update({ status: 'failed', error: 'Loan not found.' })
			.eq('id', message.id);
		return { ok: false, error: 'Loan not found.', status: 404 };
	}
	return sendClaimed(admin, resendKey, message, loan);
}

async function repairOpenReminders(admin: Admin): Promise<void> {
	const { data: loans } = await admin
		.from('book_loans')
		.select(
			'id, book_id, contact_id, recipient_name, recipient_email, checked_out_on, returned_at, interval_days, created_by, deleted_at'
		)
		.is('returned_at', null)
		.is('deleted_at', null);
	const open = (loans ?? []) as LoanRow[];
	if (open.length === 0) return;

	const ids = open.map((loan) => loan.id);
	const { data: messages } = await admin
		.from('book_loan_messages')
		.select('loan_id, kind, status, scheduled_for, sent_at')
		.in('loan_id', ids)
		.eq('kind', 'reminder')
		.is('deleted_at', null);
	const rows = (messages ?? []) as {
		loan_id: string;
		kind: string;
		status: string;
		scheduled_for: string;
		sent_at: string | null;
	}[];

	const bookIds = [...new Set(open.map((loan) => loan.book_id))];
	const [{ data: books }, { data: owner }] = await Promise.all([
		admin.from('books').select('id, title, author_display').in('id', bookIds),
		admin.from('profiles').select('full_name').eq('role', 'owner').limit(1).maybeSingle()
	]);
	const bookById = new Map(
		((books ?? []) as { id: string; title: string | null; author_display: string | null }[]).map((b) => [
			b.id,
			b
		])
	);
	const ownerName = (owner as { full_name: string | null } | null)?.full_name ?? null;

	for (const loan of open) {
		const mine = rows.filter((row) => row.loan_id === loan.id);
		if (!loanNeedsNextReminder(false, mine)) continue;
		const sent = mine
			.filter((row) => row.status === 'sent')
			.sort((a, b) => (a.scheduled_for < b.scheduled_for ? 1 : -1));
		const latest = sent[0];
		const anchor = latest
			? latest.sent_at
				? ymdInChicago(new Date(latest.sent_at))
				: latest.scheduled_for
			: loan.checked_out_on;
		const book = bookById.get(loan.book_id);
		await queueNextReminder(admin, loan, ownerName, book?.title ?? '', book?.author_display ?? null, anchor);
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
