/**
 * Civil-calendar meet periods for contacts (Chicago YMD).
 * Q = calendar quarters; S = Jan–Jun / Jul–Dec; A = calendar year.
 * Import on-ramp: Q→Q4 2026 (extended from Jul 1); S→H2 2026; A→2027.
 */

import { utcNoonFromYmd, ymdFromUtcNoon } from '$lib/invoicing/chicago-date';
import type { ContactFrequency } from '$lib/types/contacts';

function daysBetweenYmd(laterYmd: string, earlierYmd: string): number {
	const later = Date.parse(`${laterYmd}T12:00:00Z`);
	const earlier = Date.parse(`${earlierYmd}T12:00:00Z`);
	if (!Number.isFinite(later) || !Number.isFinite(earlier)) return 0;
	return Math.round((later - earlier) / 86_400_000);
}

export type PeriodWindow = {
	/** Stable key e.g. q:2026-Q4, s:2026-H2, a:2027 */
	key: string;
	start: string;
	end: string;
	frequency: 'quarterly' | 'semiannual' | 'annual';
};

/** First obligations after sheet import (nobody starts already missed). */
export const ON_RAMP = {
	quarterly: {
		key: 'q:2026-Q4',
		start: '2026-07-01',
		end: '2026-12-31',
		frequency: 'quarterly' as const
	},
	semiannual: {
		key: 's:2026-H2',
		start: '2026-07-01',
		end: '2026-12-31',
		frequency: 'semiannual' as const
	},
	annual: {
		key: 'a:2027',
		start: '2027-01-01',
		end: '2027-12-31',
		frequency: 'annual' as const
	}
} as const;

export function isScheduledFrequency(
	f: ContactFrequency
): f is 'quarterly' | 'semiannual' | 'annual' {
	return f === 'quarterly' || f === 'semiannual' || f === 'annual';
}

function lastDayOfMonth(year: number, month0: number): string {
	const end = new Date(Date.UTC(year, month0 + 1, 0, 12, 0, 0));
	return ymdFromUtcNoon(end);
}

/** Civil quarter containing todayYmd (no on-ramp). */
export function civilQuarterContaining(todayYmd: string): PeriodWindow {
	const mid = utcNoonFromYmd(todayYmd);
	if (!mid) {
		return { key: 'q:1970-Q1', start: '1970-01-01', end: '1970-03-31', frequency: 'quarterly' };
	}
	const y = mid.getUTCFullYear();
	const q = Math.floor(mid.getUTCMonth() / 3) + 1;
	const startMonth = (q - 1) * 3;
	const start = ymdFromUtcNoon(new Date(Date.UTC(y, startMonth, 1, 12, 0, 0)));
	const end = lastDayOfMonth(y, startMonth + 2);
	return { key: `q:${y}-Q${q}`, start, end, frequency: 'quarterly' };
}

/** Civil half-year containing todayYmd (no on-ramp). */
export function civilHalfContaining(todayYmd: string): PeriodWindow {
	const mid = utcNoonFromYmd(todayYmd);
	if (!mid) {
		return { key: 's:1970-H1', start: '1970-01-01', end: '1970-06-30', frequency: 'semiannual' };
	}
	const y = mid.getUTCFullYear();
	const h = mid.getUTCMonth() < 6 ? 1 : 2;
	const start =
		h === 1
			? ymdFromUtcNoon(new Date(Date.UTC(y, 0, 1, 12, 0, 0)))
			: ymdFromUtcNoon(new Date(Date.UTC(y, 6, 1, 12, 0, 0)));
	const end = h === 1 ? lastDayOfMonth(y, 5) : lastDayOfMonth(y, 11);
	return { key: `s:${y}-H${h}`, start, end, frequency: 'semiannual' };
}

/** Calendar year containing todayYmd (no on-ramp). */
export function civilYearContaining(todayYmd: string): PeriodWindow {
	const mid = utcNoonFromYmd(todayYmd);
	if (!mid) {
		return { key: 'a:1970', start: '1970-01-01', end: '1970-12-31', frequency: 'annual' };
	}
	const y = mid.getUTCFullYear();
	return {
		key: `a:${y}`,
		start: ymdFromUtcNoon(new Date(Date.UTC(y, 0, 1, 12, 0, 0))),
		end: lastDayOfMonth(y, 11),
		frequency: 'annual'
	};
}

/**
 * Active obligation period for a scheduled frequency (applies import on-ramp).
 * Before the first period ends, returns the on-ramp window even if today is earlier
 * than its civil start (so annuals appear with a 2027 deadline in 2026).
 */
export function activePeriodForFrequency(
	frequency: 'quarterly' | 'semiannual' | 'annual',
	todayYmd: string
): PeriodWindow {
	if (frequency === 'quarterly') {
		if (todayYmd <= ON_RAMP.quarterly.end) return { ...ON_RAMP.quarterly };
		return civilQuarterContaining(todayYmd);
	}
	if (frequency === 'semiannual') {
		if (todayYmd <= ON_RAMP.semiannual.end) return { ...ON_RAMP.semiannual };
		return civilHalfContaining(todayYmd);
	}
	// annual — stay on 2027 until that year ends
	if (todayYmd <= ON_RAMP.annual.end) return { ...ON_RAMP.annual };
	return civilYearContaining(todayYmd);
}

/** True when touched_on falls inside [start, end] inclusive. */
export function touchFulfillsPeriod(touchedOn: string | null, period: PeriodWindow): boolean {
	if (!touchedOn) return false;
	return touchedOn >= period.start && touchedOn <= period.end;
}

export function daysLeftInPeriod(period: PeriodWindow, todayYmd: string): number {
	return Math.max(0, daysBetweenYmd(period.end, todayYmd));
}

/** Parse period key into a closed window when possible (for history). */
export function periodFromKey(key: string): PeriodWindow | null {
	const q = /^q:(\d{4})-Q([1-4])$/.exec(key);
	if (q) {
		const y = Number(q[1]);
		const qi = Number(q[2]);
		const startMonth = (qi - 1) * 3;
		const start = ymdFromUtcNoon(new Date(Date.UTC(y, startMonth, 1, 12, 0, 0)));
		const end = lastDayOfMonth(y, startMonth + 2);
		// On-ramp Q4 key may use extended start
		if (key === ON_RAMP.quarterly.key) return { ...ON_RAMP.quarterly };
		return { key, start, end, frequency: 'quarterly' };
	}
	const s = /^s:(\d{4})-H([12])$/.exec(key);
	if (s) {
		if (key === ON_RAMP.semiannual.key) return { ...ON_RAMP.semiannual };
		const y = Number(s[1]);
		const h = Number(s[2]);
		const start =
			h === 1
				? ymdFromUtcNoon(new Date(Date.UTC(y, 0, 1, 12, 0, 0)))
				: ymdFromUtcNoon(new Date(Date.UTC(y, 6, 1, 12, 0, 0)));
		const end = h === 1 ? lastDayOfMonth(y, 5) : lastDayOfMonth(y, 11);
		return { key, start, end, frequency: 'semiannual' };
	}
	const a = /^a:(\d{4})$/.exec(key);
	if (a) {
		if (key === ON_RAMP.annual.key) return { ...ON_RAMP.annual };
		const y = Number(a[1]);
		return {
			key,
			start: ymdFromUtcNoon(new Date(Date.UTC(y, 0, 1, 12, 0, 0))),
			end: lastDayOfMonth(y, 11),
			frequency: 'annual'
		};
	}
	return null;
}

/** Previous closed periods for history (most recent first), excluding active. */
export function recentClosedPeriods(
	frequency: 'quarterly' | 'semiannual' | 'annual',
	todayYmd: string,
	limit = 4
): PeriodWindow[] {
	const active = activePeriodForFrequency(frequency, todayYmd);
	const out: PeriodWindow[] = [];
	let cursor = active.start;
	// Walk backward from day before active.start
	const mid = utcNoonFromYmd(cursor);
	if (!mid) return out;
	mid.setUTCDate(mid.getUTCDate() - 1);
	let probe = ymdFromUtcNoon(mid);
	while (out.length < limit) {
		let p: PeriodWindow;
		if (frequency === 'quarterly') p = civilQuarterContaining(probe);
		else if (frequency === 'semiannual') p = civilHalfContaining(probe);
		else p = civilYearContaining(probe);
		// Skip on-ramp duplicate if already listed as active
		if (p.key === active.key) break;
		// Don't invent pre-on-ramp history that overlaps on-ramp keys oddly
		if (frequency === 'quarterly' && p.end < ON_RAMP.quarterly.start) break;
		if (frequency === 'semiannual' && p.end < ON_RAMP.semiannual.start) break;
		if (frequency === 'annual' && p.end < ON_RAMP.annual.start) break;
		out.push(p);
		const startMid = utcNoonFromYmd(p.start);
		if (!startMid) break;
		startMid.setUTCDate(startMid.getUTCDate() - 1);
		probe = ymdFromUtcNoon(startMid);
	}
	return out;
}
