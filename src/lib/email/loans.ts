import { DEFAULT_LOAN_INTERVAL_DAYS } from '$lib/email/variables';

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isLoanEmail(value: string): boolean {
	const email = value.trim();
	return email.length >= 5 && email.length <= 320 && EMAIL_RE.test(email);
}
