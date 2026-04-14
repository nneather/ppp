import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';

const corsHeaders: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

type InvoiceRow = {
	id: string;
	client_id: string;
	invoice_number: string;
	period_start: string;
	period_end: string;
	status: string;
	subtotal: string | number | null;
	total: string | number | null;
	notes: string | null;
	created_at: string;
	deleted_at: string | null;
};

type ClientRow = {
	name: string;
	email: string | null;
	billing_contact: string | null;
};

type LineRow = {
	description: string;
	quantity: string | number | null;
	unit_price: string | number | null;
	total: string | number;
	is_one_off: boolean;
	sort_order: number;
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

function formatDateYmd(ymd: string): string {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
	if (!m) return ymd;
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatIsoDate(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** WinAnsi-safe subset for StandardFonts */
function safePdfText(s: string): string {
	return s
		.replace(/\r\n/g, '\n')
		.replace(/[\u2018\u2019]/g, "'")
		.replace(/[\u201c\u201d]/g, '"')
		.replace(/[\u2013\u2014]/g, '-')
		.replace(/[^\x20-\x7E\n]/g, '?');
}

function wrapText(text: string, maxChars: number): string[] {
	const words = text.split(/\s+/);
	const lines: string[] = [];
	let current = '';
	for (const w of words) {
		if (!current.length) {
			current = w;
			continue;
		}
		if (current.length + 1 + w.length <= maxChars) {
			current += ' ' + w;
		} else {
			lines.push(current);
			current = w;
		}
	}
	if (current.length) lines.push(current);
	return lines.length ? lines : [''];
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

function drawLine(
	page: PDFPage,
	font: PDFFont,
	fontBold: PDFFont,
	text: string,
	x: number,
	y: number,
	size: number,
	bold = false
): number {
	page.drawText(safePdfText(text), { x, y, size, font: bold ? fontBold : font });
	return y - size - 3;
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
	if (!supabaseUrl || !anonKey || !serviceKey) {
		return jsonResponse({ error: 'Server configuration error' }, 500);
	}

	const authHeader = req.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	const userClient = createClient(supabaseUrl, anonKey, {
		global: { headers: { Authorization: authHeader } }
	});
	const {
		data: { user },
		error: userErr
	} = await userClient.auth.getUser();
	if (userErr || !user) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	const admin = createClient(supabaseUrl, serviceKey);
	if (!(await requireOwner(admin, user.id))) {
		return jsonResponse({ error: 'Forbidden' }, 403);
	}

	let body: { invoice_id?: string };
	try {
		body = await req.json();
	} catch {
		return jsonResponse({ error: 'Invalid JSON body' }, 400);
	}

	const invoiceId = body.invoice_id?.trim();
	if (!invoiceId) {
		return jsonResponse({ error: 'invoice_id is required' }, 400);
	}

	const { data: inv, error: invErr } = await admin
		.from('invoices')
		.select(
			`
      id,
      client_id,
      invoice_number,
      period_start,
      period_end,
      status,
      subtotal,
      total,
      notes,
      created_at,
      deleted_at
    `
		)
		.eq('id', invoiceId)
		.maybeSingle();

	if (invErr) {
		console.error(invErr);
		return jsonResponse({ error: 'Could not load invoice' }, 500);
	}
	const invoice = inv as InvoiceRow | null;
	if (!invoice || invoice.deleted_at != null) {
		return jsonResponse({ error: 'Invoice not found' }, 404);
	}

	const { data: clientRow, error: clientErr } = await admin
		.from('clients')
		.select('name, email, billing_contact')
		.eq('id', invoice.client_id)
		.is('deleted_at', null)
		.maybeSingle();

	if (clientErr || !clientRow) {
		console.error(clientErr);
		return jsonResponse({ error: 'Could not load client' }, 500);
	}
	const client = clientRow as ClientRow;

	const { data: lines, error: linesErr } = await admin
		.from('invoice_line_items')
		.select('description, quantity, unit_price, total, is_one_off, sort_order')
		.eq('invoice_id', invoiceId)
		.order('sort_order', { ascending: true });

	if (linesErr) {
		console.error(linesErr);
		return jsonResponse({ error: 'Could not load line items' }, 500);
	}

	const lineItems = (lines ?? []) as LineRow[];

	const senderName = Deno.env.get('SENDER_NAME')?.trim() || 'Sender';
	const senderEmail = Deno.env.get('SENDER_EMAIL')?.trim();
	const senderLine1 = Deno.env.get('SENDER_ADDRESS_LINE_1')?.trim();
	const senderLine2 = Deno.env.get('SENDER_ADDRESS_LINE_2')?.trim();
	const senderPhone = Deno.env.get('SENDER_PHONE')?.trim();

	const pdfDoc = await PDFDocument.create();
	const page = pdfDoc.addPage([612, 792]);
	const { width, height } = page.getSize();
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

	const margin = 50;
	let y = height - margin;

	y = drawLine(page, font, fontBold, 'INVOICE', margin, y, 18, true);
	y -= 8;

	y = drawLine(page, font, fontBold, senderName, margin, y, 11, true);
	if (senderLine1) y = drawLine(page, font, fontBold, senderLine1, margin, y, 10);
	if (senderLine2) y = drawLine(page, font, fontBold, senderLine2, margin, y, 10);
	if (senderEmail) y = drawLine(page, font, fontBold, senderEmail, margin, y, 10);
	if (senderPhone) y = drawLine(page, font, fontBold, senderPhone, margin, y, 10);

	y -= 12;
	const billX = width - margin - 220;
	let billY = height - margin;
	billY = drawLine(page, font, fontBold, 'Bill To:', billX, billY, 10, true);
	billY = drawLine(page, font, fontBold, client.name, billX, billY, 10);
	if (client.billing_contact) {
		billY = drawLine(page, font, fontBold, client.billing_contact, billX, billY, 10);
	}
	if (client.email) {
		billY = drawLine(page, font, fontBold, client.email, billX, billY, 10);
	}

	y = Math.min(y, billY) - 16;

	y = drawLine(page, font, fontBold, `Invoice #: ${invoice.invoice_number}`, margin, y, 11, true);
	y = drawLine(
		page,
		font,
		fontBold,
		`Period: ${formatDateYmd(invoice.period_start)} – ${formatDateYmd(invoice.period_end)}`,
		margin,
		y,
		10
	);
	y = drawLine(page, font, fontBold, `Date: ${formatIsoDate(invoice.created_at)}`, margin, y, 10);
	y -= 14;

	// Table header
	const colDesc = margin;
	const colQty = width - margin - 200;
	const colRate = width - margin - 130;
	const colAmt = width - margin - 60;
	y = drawLine(page, font, fontBold, 'Description', colDesc, y, 9, true);
	page.drawText('Qty', { x: colQty, y, size: 9, font: fontBold });
	page.drawText('Rate', { x: colRate, y, size: 9, font: fontBold });
	page.drawText('Amount', { x: colAmt, y, size: 9, font: fontBold });
	y -= 14;
	page.drawLine({
		start: { x: margin, y: y + 6 },
		end: { x: width - margin, y: y + 6 },
		thickness: 0.5
	});
	y -= 8;

	let activePage = page;
	function ensureSpace(needed: number) {
		if (y < margin + needed) {
			activePage = pdfDoc.addPage([612, 792]);
			y = height - margin;
		}
	}

	for (const line of lineItems) {
		const desc =
			line.is_one_off && !line.description.includes('(one-off)')
				? `${line.description} (one-off)`
				: line.description;
		const descLines = wrapText(desc, 55);
		const blockH = descLines.length * 11 + 8;
		ensureSpace(blockH + 40);
		for (let i = 0; i < descLines.length; i++) {
			const rowY = y;
			activePage.drawText(safePdfText(descLines[i]!), { x: colDesc, y: rowY, size: 9, font });
			if (i === 0) {
				const q = line.quantity != null ? String(line.quantity) : '—';
				const r = line.unit_price != null ? money(num(line.unit_price)) : '—';
				activePage.drawText(q, { x: colQty, y: rowY, size: 9, font });
				activePage.drawText(r, { x: colRate, y: rowY, size: 9, font });
				activePage.drawText(money(num(line.total)), { x: colAmt, y: rowY, size: 9, font });
			}
			y -= 11;
		}
		y -= 4;
	}

	y -= 8;
	ensureSpace(80);
	activePage.drawLine({
		start: { x: margin, y: y + 4 },
		end: { x: width - margin, y: y + 4 },
		thickness: 0.5
	});
	y -= 12;

	const sub = num(invoice.subtotal);
	const tot = num(invoice.total);
	y = drawLine(
		activePage,
		font,
		fontBold,
		`Subtotal: ${money(sub)}`,
		width - margin - 120,
		y,
		10,
		true
	);
	y = drawLine(
		activePage,
		font,
		fontBold,
		`Total: ${money(tot)}`,
		width - margin - 120,
		y,
		11,
		true
	);

	if (invoice.notes?.trim()) {
		y -= 16;
		ensureSpace(60);
		y = drawLine(activePage, font, fontBold, 'Notes', margin, y, 10, true);
		for (const para of invoice.notes.split('\n')) {
			for (const wl of wrapText(para, 90)) {
				ensureSpace(20);
				y = drawLine(activePage, font, fontBold, wl, margin, y, 9);
			}
		}
	}

	const pdfBytes = await pdfDoc.save();
	const base64 = uint8ArrayToBase64(pdfBytes);

	return jsonResponse({ pdf: base64 });
});

function uint8ArrayToBase64(bytes: Uint8Array): string {
	const chunk = 8192;
	let binary = '';
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}
