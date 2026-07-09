import { createClient } from '@supabase/supabase-js';

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
		'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
		Vary: 'Origin'
	};
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' }
	});
}

function num(v: string | number | null | undefined): number {
	if (v == null) return 0;
	return typeof v === 'number' ? v : Number(v);
}

function money(n: number): string {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function isValidEmail(s: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function normalizeEmailList(v: unknown): string[] {
	if (Array.isArray(v)) {
		const out: string[] = [];
		for (const x of v) {
			if (typeof x !== 'string') continue;
			for (const part of x.split(',')) {
				const t = part.trim();
				if (t.length > 0) out.push(t);
			}
		}
		return out;
	}
	if (typeof v === 'string') {
		return v
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	}
	return [];
}

/** Client `email` column: text[] (first = primary To, rest merged into CC when no explicit To). */
function normalizeClientEmailsFromDb(v: unknown): string[] {
	if (Array.isArray(v)) {
		return v
			.map((x) => String(x ?? '').trim())
			.filter((s) => s.length > 0);
	}
	if (typeof v === 'string') {
		return normalizeEmailList(v);
	}
	return [];
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** Resend-friendly default; matches https://resend.com/docs/api-reference/emails/send-email */
const DEFAULT_INVOICE_RESEND_FROM = 'Parker Neathery <invoicing@npneathery.com>';

function resolveInvoiceResendFrom(): string {
	const raw = Deno.env.get('INVOICE_RESEND_FROM')?.trim();
	if (!raw || raw.length < 5 || raw.length > 512 || !raw.includes('@')) {
		return DEFAULT_INVOICE_RESEND_FROM;
	}
	return raw;
}

function formatDateYmd(ymd: string): string {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
	if (!m) return ymd;
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function requireOwner(
	admin: ReturnType<typeof createClient>,
	userId: string
): Promise<boolean> {
	const { data, error } = await admin
		.from('profiles')
		.select('role')
		.eq('id', userId)
		.maybeSingle();
	if (error || !data) return false;
	return (data as { role: string }).role === 'owner';
}

/** Resolves the current user id via GoTrue (supports ES256); avoids local JWT verify in Edge. */
async function getUserIdFromAuthApi(
	supabaseUrl: string,
	anonKey: string,
	authHeader: string
): Promise<string | null> {
	const base = supabaseUrl.replace(/\/$/, '');
	const res = await fetch(`${base}/auth/v1/user`, {
		headers: {
			Authorization: authHeader,
			apikey: anonKey
		}
	});
	if (!res.ok) return null;
	let body: unknown;
	try {
		body = await res.json();
	} catch {
		return null;
	}
	if (!body || typeof body !== 'object') return null;
	const id = (body as { id?: unknown }).id;
	return typeof id === 'string' && id.length > 0 ? id : null;
}

function buildEmailHtml(opts: {
	invoiceNumber: string;
	clientName: string;
	periodStart: string;
	periodEnd: string;
	total: number;
	customMessageHtml: string;
}): string {
	const { invoiceNumber, clientName, periodStart, periodEnd, total, customMessageHtml } = opts;
	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice ${escapeHtml(invoiceNumber)}</title>
</head>
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#18181b;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px 28px;border:1px solid #e4e4e7;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
    <p style="margin:0 0 16px 0;font-size:18px;font-weight:600;">Invoice ${escapeHtml(invoiceNumber)}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
      <tr><td style="padding:6px 0;color:#71717a;">Client</td><td style="padding:6px 0;text-align:right;font-weight:500;">${escapeHtml(clientName)}</td></tr>
      <tr><td style="padding:6px 0;color:#71717a;">Period</td><td style="padding:6px 0;text-align:right;">${escapeHtml(formatDateYmd(periodStart))} – ${escapeHtml(formatDateYmd(periodEnd))}</td></tr>
      <tr><td style="padding:6px 0;color:#71717a;">Total</td><td style="padding:6px 0;text-align:right;font-weight:600;">${escapeHtml(money(total))}</td></tr>
    </table>
    <div style="border-top:1px solid #e4e4e7;padding-top:16px;margin-top:4px;">
      ${customMessageHtml}
    </div>
    <p style="margin:20px 0 0 0;font-size:13px;color:#71717a;">The detailed invoice is attached as a PDF.</p>
  </div>
</body>
</html>`;
}

/** Plain-text sibling of buildEmailHtml — multipart/alternative for attachment-friendly MIME. */
function buildEmailText(opts: {
	invoiceNumber: string;
	clientName: string;
	periodStart: string;
	periodEnd: string;
	total: number;
	customMessage: string;
}): string {
	const { invoiceNumber, clientName, periodStart, periodEnd, total, customMessage } = opts;
	const message = customMessage.trim() || 'Please see the attached invoice.';
	return [
		message,
		'',
		`Invoice ${invoiceNumber} — ${clientName}`,
		`Period: ${formatDateYmd(periodStart)} – ${formatDateYmd(periodEnd)}`,
		`Total: ${money(total)}`,
		'',
		'The detailed invoice is attached as a PDF.'
	].join('\n');
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeadersFor(req) });
	}

	if (req.method !== 'POST') {
		return jsonResponse(req, { error: 'Method not allowed' }, 405);
	}

	const supabaseUrl = Deno.env.get('SUPABASE_URL');
	const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
	const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
	const resendKey = Deno.env.get('RESEND_API_KEY');
	if (!supabaseUrl || !anonKey || !serviceKey) {
		return jsonResponse(req, { error: 'Server configuration error' }, 500);
	}
	if (!resendKey?.trim()) {
		return jsonResponse(req, { error: 'RESEND_API_KEY is not configured' }, 500);
	}

	const authHeader = req.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		return jsonResponse(req, { error: 'Unauthorized' }, 401);
	}

	const userId = await getUserIdFromAuthApi(supabaseUrl, anonKey, authHeader);
	if (!userId) {
		return jsonResponse(req, { error: 'Unauthorized' }, 401);
	}

	const admin = createClient(supabaseUrl, serviceKey);
	if (!(await requireOwner(admin, userId))) {
		return jsonResponse(req, { error: 'Forbidden' }, 403);
	}

	let body: {
		invoice_id?: string;
		pdf_base64?: string;
		custom_message?: string;
		test_recipient?: string;
		to?: unknown;
		cc?: unknown;
		bcc?: unknown;
	};
	try {
		body = await req.json();
	} catch {
		return jsonResponse(req, { error: 'Invalid JSON body' }, 400);
	}

	const invoiceId = body.invoice_id?.trim();
	const pdfBase64 = body.pdf_base64?.trim();
	const customMessage = body.custom_message ?? '';
	const testRecipient = body.test_recipient?.trim();
	// `to` accepts a comma-delimited string OR an array (mixed array+commas also OK).
	// All resolved addresses go on the To line of the email so recipients can see each other.
	const explicitToList = normalizeEmailList(body.to);
	const ccListRaw = normalizeEmailList(body.cc);
	const bccListRaw = normalizeEmailList(body.bcc);

	if (!invoiceId || !pdfBase64) {
		return jsonResponse(req, { error: 'invoice_id and pdf_base64 are required' }, 400);
	}

	const { data: inv, error: invErr } = await admin
		.from('invoices')
		.select('id, client_id, invoice_number, period_start, period_end, total, deleted_at')
		.eq('id', invoiceId)
		.maybeSingle();

	if (invErr) {
		console.error(invErr);
		return jsonResponse(req, { error: 'Could not load invoice' }, 500);
	}
	if (!inv || inv.deleted_at != null) {
		return jsonResponse(req, { error: 'Invoice not found' }, 404);
	}

	const invoice = inv as {
		id: string;
		client_id: string;
		invoice_number: string;
		period_start: string;
		period_end: string;
		total: string | number | null;
		deleted_at: string | null;
	};

	// Allow re-send after client soft-delete (existing invoices stay accessible).
	const { data: clientRow, error: clientErr } = await admin
		.from('clients')
		.select('name, email')
		.eq('id', invoice.client_id)
		.maybeSingle();

	if (clientErr || !clientRow) {
		console.error(clientErr);
		return jsonResponse(req, { error: 'Could not load client' }, 500);
	}

	const client = clientRow as { name: string; email: unknown };

	let toList: string[];
	let subjectPrefix = '';
	let ccList: string[] = [];
	let bccList: string[] = [];

	if (testRecipient) {
		toList = [testRecipient];
		subjectPrefix = '[TEST] ';
	} else {
		const clientEmails = normalizeClientEmailsFromDb(client.email);
		if (explicitToList.length > 0) {
			for (const addr of explicitToList) {
				if (!isValidEmail(addr)) {
					return jsonResponse(req, { error: `Invalid To email address: ${addr}` }, 400);
				}
			}
			toList = explicitToList;
			ccList = [...ccListRaw];
		} else {
			if (clientEmails.length === 0) {
				return jsonResponse(req, { error: 'Client has no email address' }, 400);
			}
			for (const addr of clientEmails) {
				if (!isValidEmail(addr)) {
					return jsonResponse(req, { error: 'Invalid client email address' }, 400);
				}
			}
			// Default behavior preserved: primary client email is To, the rest auto-CC.
			toList = [clientEmails[0]];
			ccList = [...clientEmails.slice(1), ...ccListRaw];
		}
		for (const addr of ccList) {
			if (!isValidEmail(addr)) {
				return jsonResponse(req, { error: 'Invalid email in CC' }, 400);
			}
		}
		for (const addr of bccListRaw) {
			if (!isValidEmail(addr)) {
				return jsonResponse(req, { error: 'Invalid email in BCC' }, 400);
			}
		}
		bccList = bccListRaw;
	}

	const total = num(invoice.total);
	const messageEscaped = escapeHtml(customMessage.trim() || 'Please see the attached invoice.');
	const customMessageHtml = `<p style="margin:0;white-space:pre-wrap;">${messageEscaped.replace(/\n/g, '<br/>')}</p>`;

	const html = buildEmailHtml({
		invoiceNumber: invoice.invoice_number,
		clientName: client.name,
		periodStart: invoice.period_start,
		periodEnd: invoice.period_end,
		total,
		customMessageHtml
	});
	const text = buildEmailText({
		invoiceNumber: invoice.invoice_number,
		clientName: client.name,
		periodStart: invoice.period_start,
		periodEnd: invoice.period_end,
		total,
		customMessage
	});

	const safeFileBase = invoice.invoice_number.replace(/[^a-zA-Z0-9._-]+/g, '_');
	const filename = `${safeFileBase || 'invoice'}.pdf`;

	const resendFrom = resolveInvoiceResendFrom();
	console.info('[send-invoice] Resend from:', resendFrom);

	const resendPayload: Record<string, unknown> = {
		from: resendFrom,
		reply_to: ['parker@npneathery.com'],
		headers: { 'Reply-To': 'parker@npneathery.com' },
		to: toList,
		subject: `${subjectPrefix}Invoice ${invoice.invoice_number} — ${client.name}`,
		html,
		text,
		attachments: [{ filename, content: pdfBase64, content_type: 'application/pdf' }]
	};
	if (!testRecipient && ccList.length > 0) {
		resendPayload.cc = ccList;
	}
	if (!testRecipient && bccList.length > 0) {
		resendPayload.bcc = bccList;
	}

	const resendRes = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${resendKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(resendPayload)
	});

	if (!resendRes.ok) {
		const errText = await resendRes.text();
		console.error('Resend error:', resendRes.status, errText);
		let detail = 'Failed to send email';
		try {
			const parsed = JSON.parse(errText) as { message?: string };
			if (parsed?.message && typeof parsed.message === 'string') {
				detail = parsed.message;
			}
		} catch {
			if (errText.length > 0 && errText.length < 500) detail = errText;
		}
		return jsonResponse(req, { error: detail }, 502);
	}

	return jsonResponse(req, { success: true });
});
