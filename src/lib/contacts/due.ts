/**
 * Cadence-due helpers for dashboard + MCP (pure; unit-tested).
 * Due = active, !no_reminders, and (never touched OR last touch older than effective cadence).
 */

import { addDaysYmd } from '$lib/invoicing/chicago-date';
import type { ContactDueRow } from '$lib/types/contacts';

export type ContactDueCandidate = {
	id: string;
	display_name: string;
	effective_cadence_days: number;
	last_touched_on: string | null;
	household_name: string | null;
	no_reminders: boolean;
	status: 'active' | 'retired';
};

/** Civil-day delta: `a - b` in days (positive when a is after b). */
export function daysBetweenYmd(laterYmd: string, earlierYmd: string): number {
	const later = Date.parse(`${laterYmd}T12:00:00Z`);
	const earlier = Date.parse(`${earlierYmd}T12:00:00Z`);
	if (!Number.isFinite(later) || !Number.isFinite(earlier)) return 0;
	return Math.round((later - earlier) / 86_400_000);
}

/**
 * Days past the cadence window (today − (last_touch + cadence)).
 * Never touched → null (caller sorts nulls first).
 * Not yet due → negative (caller filters those out).
 */
export function daysOverdueForContact(
	lastTouchedOn: string | null,
	effectiveCadenceDays: number,
	todayYmd: string
): number | null {
	if (lastTouchedOn == null) return null;
	const dueOn = addDaysYmd(lastTouchedOn, effectiveCadenceDays);
	if (!dueOn) return null;
	return daysBetweenYmd(todayYmd, dueOn);
}

export function isContactDue(opts: {
	status: 'active' | 'retired';
	no_reminders: boolean;
	last_touched_on: string | null;
	effective_cadence_days: number;
	todayYmd: string;
}): boolean {
	if (opts.status !== 'active') return false;
	if (opts.no_reminders) return false;
	const overdue = daysOverdueForContact(
		opts.last_touched_on,
		opts.effective_cadence_days,
		opts.todayYmd
	);
	if (overdue === null) return true; // never touched
	return overdue >= 0;
}

/**
 * Filter + sort due contacts: never-touched first, then most overdue.
 * Pure helper for unit tests; loader applies the same rules after fetch.
 */
export function selectContactsDue(
	candidates: readonly ContactDueCandidate[],
	opts: { todayYmd: string; limit?: number }
): ContactDueRow[] {
	const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
	const out: ContactDueRow[] = [];
	for (const c of candidates) {
		if (
			!isContactDue({
				status: c.status,
				no_reminders: c.no_reminders,
				last_touched_on: c.last_touched_on,
				effective_cadence_days: c.effective_cadence_days,
				todayYmd: opts.todayYmd
			})
		) {
			continue;
		}
		out.push({
			id: c.id,
			display_name: c.display_name,
			effective_cadence_days: c.effective_cadence_days,
			last_touched_on: c.last_touched_on,
			days_overdue: daysOverdueForContact(
				c.last_touched_on,
				c.effective_cadence_days,
				opts.todayYmd
			),
			household_name: c.household_name
		});
	}
	out.sort((a, b) => {
		// Never-touched (null) first, then highest days_overdue, then name.
		if (a.days_overdue == null && b.days_overdue != null) return -1;
		if (a.days_overdue != null && b.days_overdue == null) return 1;
		const od = (b.days_overdue ?? 0) - (a.days_overdue ?? 0);
		if (od !== 0) return od;
		return (
			a.display_name.localeCompare(b.display_name) || a.id.localeCompare(b.id)
		);
	});
	return out.slice(0, limit);
}

/**
 * C2 — Christmas card / list roster: a household stays on the card list only
 * while it has ≥1 live active member. Retired-only (or empty) households are
 * excluded from the effective roster; membership rows stay in DB so un-retire
 * restores them without re-add.
 */
export function householdEligibleForCardList(opts: {
	/** Live contacts on this household (any status). */
	liveMembers: readonly { status: 'active' | 'retired' }[];
}): boolean {
	return opts.liveMembers.some((m) => m.status === 'active');
}
