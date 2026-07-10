/**
 * Resend inbound webhook → MYN task in Email Inbox.
 * Auth: Svix signature (RESEND_WEBHOOK_SECRET), not user JWT.
 * Mirrors pure helpers in src/lib/projects/email-inbound.ts.
 */
import { createClient } from '@supabase/supabase-js';

const TASK_TITLE_MAX = 500;
const TASK_NOTES_MAX = 10_000;
const SVIX_TOLERANCE_SEC = 300;
/** Fallback only if secret unset — prefer INBOUND_TASK_RECIPIENT env. */
const DEFAULT_INBOUND_TASK_RECIPIENT = 'tasks@zeneoldai.resend.app';

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

function extractEmailAddress(raw: string | null | undefined): string | null {
	const s = String(raw ?? '').trim();
	if (!s) return null;
	const angle = /<([^>]+)>/.exec(s);
	const candidate = (angle?.[1] ?? s).trim().toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) return null;
	return candidate;
}

function isAllowedSender(fromRaw: string | null | undefined, allowlistCsv: string): boolean {
	const from = extractEmailAddress(fromRaw);
	if (!from) return false;
	const allowed = allowlistCsv
		.split(',')
		.map((p) => extractEmailAddress(p.trim()) ?? p.trim().toLowerCase())
		.filter((p) => p.length > 0 && p.includes('@'));
	if (allowed.length === 0) return false;
	return allowed.includes(from);
}

function isInboundTaskRecipient(addresses: unknown, expected: string): boolean {
	if (!Array.isArray(addresses)) return false;
	const want = expected.trim().toLowerCase();
	if (!want.includes('@')) return false;
	for (const a of addresses) {
		if (typeof a !== 'string') continue;
		const bare = extractEmailAddress(a) ?? a.trim().toLowerCase();
		if (bare === want) return true;
	}
	return false;
}

function cleanEmailSubject(raw: string | null | undefined): string {
	let s = String(raw ?? '').trim();
	if (!s) return '(no subject)';
	for (let i = 0; i < 8; i++) {
		const next = s.replace(/^\s*((re|fw|fwd)\s*:|\[[^\]]*\]\s*)+/i, '').trim();
		if (next === s) break;
		s = next;
	}
	if (!s) return '(no subject)';
	if (s.length > TASK_TITLE_MAX) return s.slice(0, TASK_TITLE_MAX);
	return s;
}

function stripHtmlToText(html: string): string {
	let s = html
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'");
	s = s
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/[ \t]{2,}/g, ' ')
		.trim();
	return s;
}

function emailBodyToNotes(text: string | null | undefined, html: string | null | undefined): string | null {
	const plain = String(text ?? '').trim();
	if (plain) return plain.length > TASK_NOTES_MAX ? plain.slice(0, TASK_NOTES_MAX) : plain;
	const h = String(html ?? '').trim();
	if (!h) return null;
	const stripped = stripHtmlToText(h);
	if (!stripped) return null;
	return stripped.length > TASK_NOTES_MAX ? stripped.slice(0, TASK_NOTES_MAX) : stripped;
}

function ymdInChicago(now: Date = new Date()): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Chicago',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(now);
	let y = '';
	let mo = '';
	let d = '';
	for (const p of parts) {
		if (p.type === 'year') y = p.value;
		else if (p.type === 'month') mo = p.value;
		else if (p.type === 'day') d = p.value;
	}
	return `${y}-${mo}-${d}`;
}

function base64ToBytes(b64: string): Uint8Array {
	const normalized = b64.replace(/-/g, '+').replace(/_/g, '/');
	const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
	const binary = atob(normalized + pad);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
	return out;
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
	return btoa(binary);
}

function timingSafeEqualStr(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/** Standard Webhooks / Svix: HMAC-SHA256 over `${id}.${timestamp}.${body}`. */
async function verifySvixSignature(
	rawBody: string,
	headers: Headers,
	secret: string
): Promise<boolean> {
	const id = headers.get('svix-id');
	const timestamp = headers.get('svix-timestamp');
	const signatureHeader = headers.get('svix-signature');
	if (!id || !timestamp || !signatureHeader) return false;

	const ts = Number(timestamp);
	if (!Number.isFinite(ts)) return false;
	const nowSec = Math.floor(Date.now() / 1000);
	if (Math.abs(nowSec - ts) > SVIX_TOLERANCE_SEC) return false;

	// Secret is `whsec_<base64>`
	const secretPart = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
	let keyBytes: Uint8Array;
	try {
		keyBytes = base64ToBytes(secretPart);
	} catch {
		return false;
	}

	const encoder = new TextEncoder();
	const toSign = encoder.encode(`${id}.${timestamp}.${rawBody}`);
	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		keyBytes,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, toSign);
	const expectedB64 = bytesToBase64(new Uint8Array(sigBuf));

	for (const part of signatureHeader.split(' ')) {
		const [ver, b64] = part.split(',');
		if (ver !== 'v1' || !b64) continue;
		if (timingSafeEqualStr(expectedB64, b64)) return true;
	}
	return false;
}

type ReceivedEmailPayload = {
	type?: string;
	data?: {
		email_id?: string;
		from?: string;
		to?: string[];
		received_for?: string[];
		subject?: string;
	};
};

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response(null, { status: 204 });
	}
	if (req.method !== 'POST') {
		return jsonResponse({ error: 'Method not allowed' }, 405);
	}

	const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')?.trim();
	const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
	const projectId = Deno.env.get('INBOUND_TASK_PROJECT_ID')?.trim();
	const allowlist = Deno.env.get('INBOUND_TASK_ALLOWED_SENDERS')?.trim() ?? '';
	const recipient =
		Deno.env.get('INBOUND_TASK_RECIPIENT')?.trim().toLowerCase() ||
		DEFAULT_INBOUND_TASK_RECIPIENT;
	const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
	const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

	if (!webhookSecret || !resendKey || !projectId || !supabaseUrl || !serviceRole) {
		console.error('email-inbound-task: missing required secrets');
		return jsonResponse({ error: 'Server misconfigured' }, 500);
	}
	if (!recipient.includes('@')) {
		console.error('email-inbound-task: INBOUND_TASK_RECIPIENT invalid');
		return jsonResponse({ error: 'Server misconfigured' }, 500);
	}

	const rawBody = await req.text();
	const okSig = await verifySvixSignature(rawBody, req.headers, webhookSecret);
	if (!okSig) {
		return jsonResponse({ error: 'Invalid signature' }, 401);
	}

	let event: ReceivedEmailPayload;
	try {
		event = JSON.parse(rawBody) as ReceivedEmailPayload;
	} catch {
		return jsonResponse({ error: 'Invalid JSON' }, 400);
	}

	if (event.type !== 'email.received') {
		console.log('email-inbound-task: skipped', {
			skipped: 'not_email_received',
			type: event.type ?? null
		});
		return jsonResponse({ ok: true, skipped: 'not_email_received' });
	}

	const data = event.data;
	const emailId = typeof data?.email_id === 'string' ? data.email_id.trim() : '';
	if (!emailId) {
		console.log('email-inbound-task: skipped', {
			skipped: 'missing_email_id',
			from: data?.from ?? null,
			recipients: [...(data?.to ?? []), ...(data?.received_for ?? [])]
		});
		return jsonResponse({ ok: true, skipped: 'missing_email_id' });
	}

	const recipients = [...(data?.to ?? []), ...(data?.received_for ?? [])];
	if (!isInboundTaskRecipient(recipients, recipient)) {
		console.log('email-inbound-task: skipped', {
			skipped: 'wrong_recipient',
			email_id: emailId,
			from: data?.from ?? null,
			recipients,
			expected_recipient: recipient
		});
		return jsonResponse({ ok: true, skipped: 'wrong_recipient' });
	}

	if (!isAllowedSender(data?.from, allowlist)) {
		console.log('email-inbound-task: skipped', {
			skipped: 'sender_not_allowed',
			email_id: emailId,
			from: data?.from ?? null,
			recipients
		});
		return jsonResponse({ ok: true, skipped: 'sender_not_allowed' });
	}

	const contentRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
		headers: { Authorization: `Bearer ${resendKey}` }
	});
	if (!contentRes.ok) {
		const errText = await contentRes.text().catch(() => '');
		console.error('email-inbound-task: fetch body failed', contentRes.status, errText);
		// 5xx so Resend retries when API is briefly down
		return jsonResponse({ error: 'Failed to fetch email content' }, 502);
	}

	const content = (await contentRes.json()) as {
		from?: string;
		subject?: string;
		text?: string | null;
		html?: string | null;
	};

	// Re-check allowlist against Receiving API `from` (not only webhook metadata).
	if (!isAllowedSender(content.from ?? data?.from, allowlist)) {
		console.log('email-inbound-task: skipped', {
			skipped: 'sender_not_allowed_after_fetch',
			email_id: emailId,
			from: content.from ?? data?.from ?? null,
			recipients
		});
		return jsonResponse({ ok: true, skipped: 'sender_not_allowed_after_fetch' });
	}

	const title = cleanEmailSubject(content.subject ?? data?.subject);
	const notes = emailBodyToNotes(content.text, content.html);
	const startDate = ymdInChicago();

	const supabase = createClient(supabaseUrl, serviceRole, {
		auth: { persistSession: false, autoRefreshToken: false }
	});

	const { data: inserted, error } = await supabase
		.from('project_tasks')
		.insert({
			project_id: projectId,
			title,
			notes,
			priority: 'opportunity_now',
			start_date: startDate,
			source_email_id: emailId
		})
		.select('id')
		.maybeSingle();

	if (error) {
		// Unique violation on source_email_id → already processed
		if (error.code === '23505') {
			return jsonResponse({ ok: true, deduped: true, email_id: emailId });
		}
		console.error('email-inbound-task: insert failed', error);
		return jsonResponse({ error: 'Insert failed' }, 500);
	}

	return jsonResponse({
		ok: true,
		task_id: inserted?.id ?? null,
		email_id: emailId
	});
});
