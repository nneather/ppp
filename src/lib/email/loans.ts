import { addDaysYmd } from '$lib/invoicing/chicago-date';
import { DEFAULT_LOAN_INTERVAL_DAYS, DEFAULT_REMINDER_LEAD_DAYS } from '$lib/email/variables';

export type LoanMessageStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled';

export type LoanMessageSnapshot = {
	kind: 'checkout' | 'reminder';
	status: LoanMessageStatus;
};

const OPEN_REMINDER: ReadonlySet<LoanMessageStatus> = new Set(['queued', 'sending', 'failed']);

/** One physical copy. Not-owned stubs and a full shelf cannot go out. */
export function canCheckOutCopy(opts: {
	owned: boolean;
	copyCount: number;
	openLoanCount: number;
}): boolean {
	if (!opts.owned) return false;
	if (!Number.isInteger(opts.copyCount) || opts.copyCount < 1) return false;
	if (!Number.isInteger(opts.openLoanCount) || opts.openLoanCount < 0) return false;
	return opts.openLoanCount < opts.copyCount;
}

export function clampLoanInterval(days: number): number | null {
	if (!Number.isInteger(days)) return null;
	if (days < 1 || days > 366) return null;
	return days;
}

export function parseLoanInterval(raw: string, fallback = DEFAULT_LOAN_INTERVAL_DAYS): number | null {
	const trimmed = raw.trim();
	if (!trimmed) return fallback;
	if (!/^\d+$/.test(trimmed)) return null;
	return clampLoanInterval(Number(trimmed));
}

export function parseReminderLead(raw: string, fallback = DEFAULT_REMINDER_LEAD_DAYS): number | null {
	const trimmed = raw.trim();
	if (!trimmed) return fallback;
	if (!/^\d+$/.test(trimmed)) return null;
	const days = Number(trimmed);
	if (!Number.isInteger(days) || days < 0 || days > 60) return null;
	return days;
}

/**
 * One reminder for the person: the earliest due date minus the lead.
 * A lead that has already passed sends today. Keep this in step with
 * `nextReminderYmd` in `supabase/functions/_shared/loan-email.ts`.
 */
export function nextReminderYmd(
	dueDates: readonly string[],
	leadDays: number,
	today: string
): string | null {
	const earliest = [...dueDates].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()[0];
	if (!earliest) return null;
	const lead = Number.isInteger(leadDays) && leadDays >= 0 && leadDays <= 60 ? leadDays : 0;
	const scheduled = addDaysYmd(earliest, -lead);
	if (!scheduled || scheduled < today) return today;
	return scheduled;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The profile default CC, minus the person already on To.
 * Keep this in step with `ccBesidesRecipient` in `supabase/functions/_shared/loan-email.ts`.
 */
export function ccBesidesRecipient(cc: readonly string[], recipient: string): string[] {
	const to = recipient.trim().toLowerCase();
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of cc) {
		const addr = raw.trim();
		if (!EMAIL_RE.test(addr)) continue;
		const key = addr.toLowerCase();
		if (key === to || seen.has(key)) continue;
		seen.add(key);
		out.push(addr);
	}
	return out;
}

/** One title, or "Title and N others", so a subject still reads for a batch. */
export function bookTitleSummary(titles: readonly string[]): string {
	const clean = titles.map((title) => title.trim()).filter((title) => title.length > 0);
	if (clean.length === 0) return 'a book';
	if (clean.length === 1) return clean[0] ?? 'a book';
	const extra = clean.length - 1;
	return `${clean[0]} and ${extra} ${extra === 1 ? 'other' : 'others'}`;
}

/**
 * An open loan needs a new reminder only when nothing is already waiting,
 * in flight, or failed (a failure is retried, not replaced).
 */
export function loanNeedsNextReminder(
	returned: boolean,
	messages: readonly LoanMessageSnapshot[]
): boolean {
	if (returned) return false;
	return !messages.some((m) => m.kind === 'reminder' && OPEN_REMINDER.has(m.status));
}

export function isLoanEmail(value: string): boolean {
	const email = value.trim();
	return email.length >= 5 && email.length <= 320 && EMAIL_RE.test(email);
}
