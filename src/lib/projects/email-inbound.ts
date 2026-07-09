/** Pure helpers for Resend inbound → MYN task capture. Client-safe. */

/** Default receiving address (Resend free managed domain). Override via Edge secret. */
export const INBOUND_TASK_RECIPIENT = 'tasks@zeneoldai.resend.app';
export const TASK_TITLE_MAX = 500;
export const TASK_NOTES_MAX = 10_000;

/** Strip Fwd:/FW:/Re: prefixes (repeated) and truncate for project_tasks.title. */
export function cleanEmailSubject(raw: string | null | undefined): string {
	let s = String(raw ?? '').trim();
	if (!s) return '(no subject)';
	// Collapse common forward/reply prefixes (case-insensitive, optional brackets).
	for (let i = 0; i < 8; i++) {
		const next = s.replace(/^\s*((re|fw|fwd)\s*:|\[[^\]]*\]\s*)+/i, '').trim();
		if (next === s) break;
		s = next;
	}
	if (!s) return '(no subject)';
	if (s.length > TASK_TITLE_MAX) return s.slice(0, TASK_TITLE_MAX);
	return s;
}

/** Extract bare email from `Name <addr@host>` or bare address. */
export function extractEmailAddress(raw: string | null | undefined): string | null {
	const s = String(raw ?? '').trim();
	if (!s) return null;
	const angle = /<([^>]+)>/.exec(s);
	const candidate = (angle?.[1] ?? s).trim().toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) return null;
	return candidate;
}

/** Comma-separated allowlist; empty list rejects everyone. */
export function isAllowedSender(
	fromRaw: string | null | undefined,
	allowlistCsv: string | null | undefined
): boolean {
	const from = extractEmailAddress(fromRaw);
	if (!from) return false;
	const allowed = String(allowlistCsv ?? '')
		.split(',')
		.map((p) => extractEmailAddress(p.trim()) ?? p.trim().toLowerCase())
		.filter((p) => p.length > 0 && p.includes('@'));
	if (allowed.length === 0) return false;
	return allowed.includes(from);
}

/** True if `to` / `received_for` includes the inbound tasks address. */
export function isInboundTaskRecipient(
	addresses: readonly string[] | null | undefined,
	expected: string = INBOUND_TASK_RECIPIENT
): boolean {
	if (!addresses?.length) return false;
	const want = expected.trim().toLowerCase();
	for (const a of addresses) {
		const bare = extractEmailAddress(a) ?? a.trim().toLowerCase();
		if (bare === want) return true;
	}
	return false;
}

/** Prefer plain text; else naive HTML → text. Truncate for notes column. */
export function emailBodyToNotes(opts: {
	text?: string | null;
	html?: string | null;
	maxLen?: number;
}): string | null {
	const max = opts.maxLen ?? TASK_NOTES_MAX;
	const plain = String(opts.text ?? '').trim();
	if (plain) {
		return plain.length > max ? plain.slice(0, max) : plain;
	}
	const html = String(opts.html ?? '').trim();
	if (!html) return null;
	const stripped = stripHtmlToText(html);
	if (!stripped) return null;
	return stripped.length > max ? stripped.slice(0, max) : stripped;
}

export function stripHtmlToText(html: string): string {
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

/** Civil YYYY-MM-DD in America/Chicago (Edge-safe; no app imports). */
export function ymdInChicagoUtc(now: Date = new Date()): string {
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
