import { createClient } from '@supabase/supabase-js';
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';

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
	email: string[] | null;
	billing_contact: string | null;
	address_line_1: string | null;
	address_line_2: string | null;
};

type LineRow = {
	description: string;
	quantity: string | number | null;
	unit_price: string | number | null;
	total: string | number;
	is_one_off: boolean;
	sort_order: number;
	start_date: string | null;
	end_date: string | null;
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

function moneyPlain(n: number): string {
	return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
		n
	);
}

/** M/D/YYYY for table cells */
function formatShortYmd(ymd: string | null): string {
	if (!ymd) return '—';
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
	if (!m) return ymd;
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

function formatInvoiceDateShort(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
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

/** DB fields may contain embedded newlines; pdf-lib drawText does not lay them out as separate lines */
function splitDbMultiline(raw: string | null | undefined): string[] {
	const s = raw?.trim();
	if (!s) return [];
	return s
		.split(/\n+/)
		.map((t) => t.trim())
		.filter(Boolean);
}

/** Recipient / company / street / city lines for the TO block (order: contact, org, address, email) */
function buildToRecipientLines(c: ClientRow): string[] {
	const lines: string[] = [];
	for (const p of splitDbMultiline(c.billing_contact)) lines.push(p);
	const company = c.name?.trim() ?? '';
	if (company && !lines.some((l) => l.toLowerCase() === company.toLowerCase())) {
		lines.push(company);
	}
	for (const p of splitDbMultiline(c.address_line_1)) lines.push(p);
	for (const p of splitDbMultiline(c.address_line_2)) lines.push(p);
	const emails = Array.isArray(c.email) ? c.email : [];
	for (const addr of emails) {
		const t = String(addr ?? '').trim();
		if (t) lines.push(t);
	}
	if (lines.length === 0) lines.push(c.name?.trim() || 'Client');
	return lines;
}

function roundMoney(n: number): number {
	return Math.round(n * 100) / 100;
}

function fmtQtyHours(q: string | number | null): string {
	if (q == null) return '—';
	const n = typeof q === 'number' ? q : Number(q);
	if (!Number.isFinite(n)) return '—';
	const r = roundMoney(n);
	if (Number.isInteger(r)) return String(r);
	return String(r);
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

function drawHRule(page: PDFPage, x1: number, x2: number, y: number, thickness = 0.5) {
	page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness });
}

function drawTextRight(
	page: PDFPage,
	font: PDFFont,
	text: string,
	rightX: number,
	y: number,
	size: number
) {
	const t = safePdfText(text);
	const w = font.widthOfTextAtSize(t, size);
	page.drawText(t, { x: rightX - w, y, size, font });
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

	const userId = await getUserIdFromAuthApi(supabaseUrl, anonKey, authHeader);
	if (!userId) {
		return jsonResponse({ error: 'Unauthorized' }, 401);
	}

	const admin = createClient(supabaseUrl, serviceKey);
	if (!(await requireOwner(admin, userId))) {
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
		.select('name, email, billing_contact, address_line_1, address_line_2')
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
		.select('description, quantity, unit_price, total, is_one_off, sort_order, start_date, end_date')
		.eq('invoice_id', invoiceId)
		.order('sort_order', { ascending: true });

	if (linesErr) {
		console.error(linesErr);
		return jsonResponse({ error: 'Could not load line items' }, 500);
	}

	const lineItems = (lines ?? []) as LineRow[];

	const senderName =
		Deno.env.get('SENDER_NAME')?.trim() || 'N. P. Neathery Consulting';
	const senderTagline =
		Deno.env.get('SENDER_TAGLINE')?.trim() || 'Building teams, solving problems';
	const senderLine1 = Deno.env.get('SENDER_ADDRESS_LINE_1')?.trim() || '725 Kirkshire Dr.';
	const senderLine2 = Deno.env.get('SENDER_ADDRESS_LINE_2')?.trim() || 'Kirkwood, MO 63122';
	const senderPhone =
		Deno.env.get('SENDER_PHONE')?.trim() || 'Phone: (210) 602-6259';
	const senderEmail = Deno.env.get('SENDER_EMAIL')?.trim();

	const serviceForLabel =
		Deno.env.get('INVOICE_SERVICE_LABEL')?.trim() || 'Consultation Services';

	const payeeLine =
		Deno.env.get('INVOICE_PAYABLE_TO')?.trim() ||
		'Make all checks payable to Neal P Neathery Jr.';
	const termsLine =
		Deno.env.get('INVOICE_TERMS')?.trim() ||
		'Total due in 15 days. Overdue accounts subject to a service charge of 1% per month.';
	const thankYouLine =
		Deno.env.get('INVOICE_THANK_YOU')?.trim() || 'Thank you for your time!';

	const pdfDoc = await PDFDocument.create();
	const pageSize: [number, number] = [612, 792];
	const margin = 50;
	const width = pageSize[0];
	const height = pageSize[1];
	const innerRight = width - margin;

	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
	const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

	/** Column right edges (points) — amounts right-aligned to innerRight */
	const R_AMT = innerRight;
	const R_RATE = innerRight - 70;
	const R_HOURS = innerRight - 140;
	const R_END = innerRight - 205;
	const R_START = innerRight - 290;
	const DESC_MAX = R_START - margin - 12;

	function drawTableHeader(p: PDFPage, headerY: number): number {
		const y0 = headerY;
		let hy = y0;
		p.drawText('DESCRIPTION', { x: margin, y: hy, size: 8, font: fontBold });
		drawTextRight(p, fontBold, 'START DATE', R_START, hy, 8);
		drawTextRight(p, fontBold, 'END DATE', R_END, hy, 8);
		drawTextRight(p, fontBold, 'HOURS', R_HOURS, hy, 8);
		drawTextRight(p, fontBold, 'RATE', R_RATE, hy, 8);
		drawTextRight(p, fontBold, 'AMOUNT', R_AMT, hy, 8);
		hy -= 10;
		drawHRule(p, margin, innerRight, hy + 4, 0.6);
		hy -= 14;
		return hy;
	}

	let activePage = pdfDoc.addPage(pageSize);
	let y = height - margin;

	function ensureSpace(needed: number) {
		if (y < margin + needed) {
			activePage = pdfDoc.addPage(pageSize);
			y = height - margin;
			y = drawTableHeader(activePage, y);
		}
	}

	// --- Right column: invoice title & meta (aligned top) ---
	let metaY = height - margin;
	metaY -= 14;
	activePage.drawText('INVOICE', {
		x: innerRight - fontBold.widthOfTextAtSize('INVOICE', 11),
		y: metaY,
		size: 11,
		font: fontBold
	});
	metaY -= 13;
	const invMeta = `INVOICE: ${invoice.invoice_number}`;
	activePage.drawText(safePdfText(invMeta), {
		x: innerRight - font.widthOfTextAtSize(safePdfText(invMeta), 9),
		y: metaY,
		size: 9,
		font
	});
	metaY -= 12;
	const dateMeta = `DATE: ${formatInvoiceDateShort(invoice.created_at)}`;
	activePage.drawText(safePdfText(dateMeta), {
		x: innerRight - font.widthOfTextAtSize(safePdfText(dateMeta), 9),
		y: metaY,
		size: 9,
		font
	});

	// --- Left: letterhead ---
	const headerStartY = height - margin;
	y = headerStartY;
	activePage.drawText(safePdfText(senderName), { x: margin, y, size: 14, font: fontBold });
	y -= 16;
	activePage.drawText(safePdfText(senderTagline), { x: margin, y, size: 9, font: fontItalic });
	y -= 12;
	activePage.drawText(safePdfText(senderLine1), { x: margin, y, size: 10, font });
	y -= 12;
	activePage.drawText(safePdfText(senderLine2), { x: margin, y, size: 10, font });
	y -= 12;
	activePage.drawText(safePdfText(senderPhone), { x: margin, y, size: 10, font });
	if (senderEmail) {
		y -= 12;
		activePage.drawText(safePdfText(senderEmail), { x: margin, y, size: 9, font });
	}

	y = Math.min(y, metaY) - 20;
	drawHRule(activePage, margin, innerRight, y + 8, 0.75);
	y -= 20;

	// --- TO / FOR ---
	const mid = margin + (innerRight - margin) * 0.48;
	activePage.drawText('TO:', { x: margin, y, size: 10, font: fontBold });
	activePage.drawText('FOR:', { x: mid, y, size: 10, font: fontBold });
	y -= 13;
	const toLogical = buildToRecipientLines(client);
	const toColWidthPts = mid - margin - 10;
	const toColMaxChars = Math.max(28, Math.floor(toColWidthPts / 5.2));
	const toDrawLines: string[] = [];
	for (const logical of toLogical) {
		toDrawLines.push(...wrapText(logical, toColMaxChars));
	}

	for (let ti = 0; ti < toDrawLines.length; ti++) {
		const tl = toDrawLines[ti]!;
		activePage.drawText(safePdfText(tl), { x: margin, y, size: 9, font });
		if (ti === 0) {
			activePage.drawText(safePdfText(serviceForLabel), { x: mid, y, size: 9, font });
		}
		y -= 11;
	}

	y -= 8;
	drawHRule(activePage, margin, innerRight, y + 4, 0.6);
	y -= 18;

	y = drawTableHeader(activePage, y);

	for (const line of lineItems) {
		const descRaw =
			line.is_one_off && !line.description.includes('(one-off)')
				? `${line.description} (one-off)`
				: line.description;
		const descChunks = wrapText(descRaw, Math.max(20, Math.floor(DESC_MAX / 5)));
		const rowLines = Math.max(1, descChunks.length);
		const blockH = rowLines * 11 + 14;
		ensureSpace(blockH + 100);

		const startStr = formatShortYmd(line.start_date);
		const endStr = formatShortYmd(line.end_date);
		const hrs = fmtQtyHours(line.quantity);
		const rateStr =
			line.unit_price != null && Number.isFinite(num(line.unit_price))
				? moneyPlain(num(line.unit_price))
				: '—';
		const amtStr = money(num(line.total));

		for (let i = 0; i < descChunks.length; i++) {
			const rowY = y;
			const chunk = descChunks[i]!.slice(0, 80);
			activePage.drawText(safePdfText(chunk), { x: margin, y: rowY, size: 9, font });
			if (i === 0) {
				drawTextRight(activePage, font, startStr, R_START, rowY, 9);
				drawTextRight(activePage, font, endStr, R_END, rowY, 9);
				drawTextRight(activePage, font, hrs, R_HOURS, rowY, 9);
				drawTextRight(activePage, font, rateStr, R_RATE, rowY, 9);
				drawTextRight(activePage, font, amtStr, R_AMT, rowY, 9);
			}
			y -= 11;
		}
		y -= 4;
	}

	y -= 6;
	ensureSpace(120);
	drawHRule(activePage, margin, innerRight, y + 4, 0.6);
	y -= 14;

	const tot = num(invoice.total);
	activePage.drawText('TOTAL', { x: margin, y, size: 10, font: fontBold });
	drawTextRight(activePage, fontBold, money(tot), R_AMT, y, 10);
	y -= 22;

	if (invoice.notes?.trim()) {
		ensureSpace(40);
		activePage.drawText('Notes', { x: margin, y, size: 9, font: fontBold });
		y -= 12;
		for (const para of invoice.notes.split('\n')) {
			for (const wl of wrapText(para, 92)) {
				ensureSpace(18);
				activePage.drawText(safePdfText(wl), { x: margin, y, size: 8, font });
				y -= 10;
			}
		}
		y -= 8;
	}

	ensureSpace(72);
	for (const wl of wrapText(payeeLine, 85)) {
		ensureSpace(14);
		activePage.drawText(safePdfText(wl), { x: margin, y, size: 8, font });
		y -= 11;
	}
	for (const wl of wrapText(termsLine, 85)) {
		ensureSpace(14);
		activePage.drawText(safePdfText(wl), { x: margin, y, size: 8, font });
		y -= 11;
	}
	y -= 10;
	ensureSpace(22);
	const th = safePdfText(thankYouLine);
	const tw = fontBold.widthOfTextAtSize(th, 11);
	activePage.drawText(th, { x: (width - tw) / 2, y, size: 11, font: fontBold });
	y -= 28;

	const pageTotal = pdfDoc.getPageCount();
	const footerLabel = (i: number) => `— ${i} of ${pageTotal} —`;
	for (let i = 0; i < pageTotal; i++) {
		const p = pdfDoc.getPage(i);
		const label = footerLabel(i + 1);
		const lw = font.widthOfTextAtSize(label, 8);
		p.drawText(label, {
			x: (width - lw) / 2,
			y: 28,
			size: 8,
			font,
			color: rgb(0.4, 0.4, 0.4)
		});
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
