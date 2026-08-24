/**
 * Period-based due helpers for dashboard + MCP (pure; unit-tested).
 * Due = active, scheduled frequency (Q/S/A), unfulfilled current period, not skipped.
 * Suggestion order = oldest last meet first. Couples collapse to one household row.
 */

import {
	activePeriodForFrequency,
	daysLeftInPeriod,
	isScheduledFrequency,
	touchFulfillsPeriod,
	type PeriodWindow
} from '$lib/contacts/period';
import type {
	ContactDueRow,
	ContactFrequency,
	ContactsPaceSummary,
	GivingGrade,
	RelationshipGrade
} from '$lib/types/contacts';

export type ContactDueCandidate = {
	id: string;
	display_name: string;
	frequency: ContactFrequency;
	last_touched_on: string | null;
	household_id: string | null;
	household_name: string | null;
	status: 'active' | 'retired';
	/** Period keys this contact has skipped (live). */
	skipped_period_keys: readonly string[];
	giving_grade: GivingGrade | null;
	relationship_grade: RelationshipGrade | null;
};

/** Civil-day delta: `a - b` in days (positive when a is after b). */
export function daysBetweenYmd(laterYmd: string, earlierYmd: string): number {
	const later = Date.parse(`${laterYmd}T12:00:00Z`);
	const earlier = Date.parse(`${earlierYmd}T12:00:00Z`);
	if (!Number.isFinite(later) || !Number.isFinite(earlier)) return 0;
	return Math.round((later - earlier) / 86_400_000);
}

/**
 * @deprecated Rolling cadence — prefer period helpers.
 * Days past the cadence window (today − (last_touch + cadence)).
 */
export function daysOverdueForContact(
	lastTouchedOn: string | null,
	effectiveCadenceDays: number,
	todayYmd: string
): number | null {
	if (lastTouchedOn == null) return null;
	const dueMs = Date.parse(`${lastTouchedOn}T12:00:00Z`) + effectiveCadenceDays * 86_400_000;
	const todayMs = Date.parse(`${todayYmd}T12:00:00Z`);
	if (!Number.isFinite(dueMs) || !Number.isFinite(todayMs)) return null;
	return Math.round((todayMs - dueMs) / 86_400_000);
}

export function isContactDueForPeriod(opts: {
	status: 'active' | 'retired';
	frequency: ContactFrequency;
	last_touched_on: string | null;
	skipped_period_keys: readonly string[];
	todayYmd: string;
}): { due: boolean; period: PeriodWindow | null } {
	if (opts.status !== 'active') return { due: false, period: null };
	if (!isScheduledFrequency(opts.frequency)) return { due: false, period: null };
	const period = activePeriodForFrequency(opts.frequency, opts.todayYmd);
	if (opts.skipped_period_keys.includes(period.key)) return { due: false, period };
	if (touchFulfillsPeriod(opts.last_touched_on, period)) return { due: false, period };
	return { due: true, period };
}

/** @deprecated Use isContactDueForPeriod */
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
	if (overdue === null) return true;
	return overdue >= 0;
}

function gradeRank(g: string | null | undefined): number {
	if (!g) return 99;
	return g.charCodeAt(0) - 64; // A=1 … E=5
}

/**
 * Filter + sort due contacts, collapsing households to one row.
 * Sort: oldest last_touched first (nulls = never = oldest), then relationship, giving, name.
 */
export function selectContactsDue(
	candidates: readonly ContactDueCandidate[],
	opts: { todayYmd: string; limit?: number }
): ContactDueRow[] {
	const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
	const dueRaw: {
		c: ContactDueCandidate;
		period: PeriodWindow;
	}[] = [];

	for (const c of candidates) {
		const { due, period } = isContactDueForPeriod({
			status: c.status,
			frequency: c.frequency,
			last_touched_on: c.last_touched_on,
			skipped_period_keys: c.skipped_period_keys,
			todayYmd: opts.todayYmd
		});
		if (!due || !period) continue;
		dueRaw.push({ c, period });
	}

	// Collapse by household_id (null household = own row)
	const collapsed = new Map<string, { c: ContactDueCandidate; period: PeriodWindow }>();
	for (const row of dueRaw) {
		const key = row.c.household_id ?? `contact:${row.c.id}`;
		const prev = collapsed.get(key);
		if (!prev) {
			collapsed.set(key, row);
			continue;
		}
		// Keep the one with older last_touched (null wins as oldest)
		const a = row.c.last_touched_on;
		const b = prev.c.last_touched_on;
		if (a == null && b != null) collapsed.set(key, row);
		else if (a != null && b != null && a < b) collapsed.set(key, row);
		else if (a == null && b == null) {
			// Prefer better relationship grade as representative
			if (gradeRank(row.c.relationship_grade) < gradeRank(prev.c.relationship_grade)) {
				collapsed.set(key, row);
			}
		}
	}

	const out: ContactDueRow[] = [];
	for (const { c, period } of collapsed.values()) {
		const daysLeft = daysLeftInPeriod(period, opts.todayYmd);
		const overdue =
			opts.todayYmd > period.end ? daysBetweenYmd(opts.todayYmd, period.end) : null;
		const display =
			c.household_id && c.household_name ? c.household_name : c.display_name;
		out.push({
			id: c.household_id ?? c.id,
			display_name: display,
			contact_id: c.id,
			household_id: c.household_id,
			household_name: c.household_name,
			frequency: c.frequency,
			period_key: period.key,
			period_end: period.end,
			last_touched_on: c.last_touched_on,
			days_overdue: overdue,
			days_left: daysLeft,
			effective_cadence_days: 0
		});
	}

	out.sort((a, b) => {
		const aTouch = a.last_touched_on;
		const bTouch = b.last_touched_on;
		if (aTouch == null && bTouch != null) return -1;
		if (aTouch != null && bTouch == null) return 1;
		if (aTouch != null && bTouch != null && aTouch !== bTouch) {
			return aTouch.localeCompare(bTouch);
		}
		return (
			a.display_name.localeCompare(b.display_name) ||
			a.contact_id.localeCompare(b.contact_id)
		);
	});

	return out.slice(0, limit);
}

/**
 * Pace for the open due pool (household-collapsed).
 * Even pace: expected remaining = total * (days_left / period_days).
 */
export function computePaceSummary(
	dueRows: readonly ContactDueRow[],
	opts: {
		totalObligations: number;
		period: PeriodWindow;
		todayYmd: string;
	}
): ContactsPaceSummary {
	const remaining = dueRows.length;
	const total = Math.max(opts.totalObligations, remaining);
	const daysLeft = daysLeftInPeriod(opts.period, opts.todayYmd);
	const periodDays = Math.max(1, daysBetweenYmd(opts.period.end, opts.period.start) + 1);
	const elapsed = Math.min(periodDays, Math.max(0, periodDays - daysLeft));
	const expectedDone = total * (elapsed / periodDays);
	const actualDone = total - remaining;
	const delta = actualDone - expectedDone;
	let pace: ContactsPaceSummary['pace'] = 'on_track';
	if (delta < -0.5) pace = 'behind';
	else if (delta > 0.5) pace = 'ahead';

	return {
		remaining,
		total,
		days_left: daysLeft,
		pace,
		period_key: opts.period.key,
		period_end: opts.period.end
	};
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
