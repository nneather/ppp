import { createClient } from '@supabase/supabase-js';

const corsHeaders: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' }
	});
}

function num(v: string | number | null | undefined): number {
	if (v == null) return 0;
	return typeof v === 'number' ? v : Number(v);
}

function money(n: number): string {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
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

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	if (req.method !== 'POST') {
		return jsonResponse({ error: 'Method not allowed' }, 405);
	}

	const supabaseUrl = Deno.env.get('SUPABASE_URL');
	const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
	const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
	const resendKey = Deno.env.get('RESEND_API_KEY');
	if (!supabaseUrl || !anonKey || !serviceKey) {
		return jsonResponse({ error: 'Server configuration error' }, 500);
	}
	if (!resendKey?.trim()) {
		return jsonResponse({ error: 'RESEND_API_KEY is not configured' }, 500);
	}

	const authHeader = req.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	const userId = await getUserIdFromAuthApi(supabaseUrl, anonKey, authHeader);
	if (!userId) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	const admin = createClient(supabaseUrl, serviceKey);
	if (!(await requireOwner(admin, userId))) {
		return jsonResponse({ error: 'Forbidden' }, 403);
	}

	let body: {
		invoice_id?: string;
		pdf_base64?: string;
		custom_message?: string;
		test_recipient?: string;
	};
	try {
		body = await req.json();
	} catch {
		return jsonResponse({ error: 'Invalid JSON body' }, 400);
	}

	const invoiceId = body.invoice_id?.trim();
	const pdfBase64 = body.pdf_base64?.trim();
	const customMessage = body.custom_message ?? '';
	const testRecipient = body.test_recipient?.trim();

	if (!invoiceId || !pdfBase64) {
		return jsonResponse({ error: 'invoice_id and pdf_base64 are required' }, 400);
	}

	const { data: inv, error: invErr } = await admin
		.from('invoices')
		.select('id, client_id, invoice_number, period_start, period_end, total, deleted_at')
		.eq('id', invoiceId)
		.maybeSingle();

	if (invErr) {
		console.error(invErr);
		return jsonResponse({ error: 'Could not load invoice' }, 500);
	}
	if (!inv || inv.deleted_at != null) {
		return jsonResponse({ error: 'Invoice not found' }, 404);
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

	const { data: clientRow, error: clientErr } = await admin
		.from('clients')
		.select('name, email')
		.eq('id', invoice.client_id)
		.is('deleted_at', null)
		.maybeSingle();

	if (clientErr || !clientRow) {
		console.error(clientErr);
		return jsonResponse({ error: 'Could not load client' }, 500);
	}

	const client = clientRow as { name: string; email: string | null };

	let toEmail: string;
	let subjectPrefix = '';
	if (testRecipient) {
		toEmail = testRecipient;
		subjectPrefix = '[TEST] ';
	} else {
		const clientEmail = client.email?.trim();
		if (!clientEmail) {
			return jsonResponse({ error: 'Client has no email address' }, 400);
		}
		toEmail = clientEmail;
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

	const safeFileBase = invoice.invoice_number.replace(/[^a-zA-Z0-9._-]+/g, '_');
	const filename = `${safeFileBase || 'invoice'}.pdf`;

	const resendRes = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${resendKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: 'onboarding@resend.dev',
			to: [toEmail],
			subject: `${subjectPrefix}Invoice ${invoice.invoice_number} — ${client.name}`,
			html,
			attachments: [{ filename, content: pdfBase64 }]
		})
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
		return jsonResponse({ error: detail }, 502);
	}

	return jsonResponse({ success: true });
});
