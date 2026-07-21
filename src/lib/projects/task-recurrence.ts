/**
 * MYN task recurrence — weekly/monthly rules, civil YYYY-MM-DD arithmetic.
 * Instances spawn on complete; this module is pure date/rule math.
 */
import { utcNoonFromYmd, ymdFromUtcNoon } from '$lib/invoicing/chicago-date';
import { parseYmd } from '$lib/projects/week';
import type { TaskPriority } from '$lib/types/projects';

export const RECURRENCE_FREQS = ['weekly', 'monthly'] as const;
export type RecurrenceFreq = (typeof RECURRENCE_FREQS)[number];

export const RECURRENCE_ENDS = ['never', 'after_count', 'on_date'] as const;
export type RecurrenceEnds = (typeof RECURRENCE_ENDS)[number];

/** ISO weekday: 1=Mon … 7=Sun */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type RecurrenceRule = {
	freq: RecurrenceFreq;
	interval: number;
	byweekday: IsoWeekday[] | null;
	bymonthday: number | null;
	ends: RecurrenceEnds;
	ends_count: number | null;
	ends_on: string | null;
};

export type TaskSeriesScope = 'this' | 'series';

const WEEKDAY_LABELS: Record<IsoWeekday, string> = {
	1: 'Mon',
	2: 'Tue',
	3: 'Wed',
	4: 'Thu',
	5: 'Fri',
	6: 'Sat',
	7: 'Sun'
};

export function isoWeekdayFromYmd(ymd: string): IsoWeekday | null {
	const mid = utcNoonFromYmd(ymd);
	if (!mid) return null;
	const js = mid.getUTCDay(); // 0=Sun … 6=Sat
	return (js === 0 ? 7 : js) as IsoWeekday;
}

export function monthDayFromYmd(ymd: string): number | null {
	const mid = utcNoonFromYmd(ymd);
	if (!mid) return null;
	return mid.getUTCDate();
}

function addDaysYmd(ymd: string, days: number): string | null {
	const mid = utcNoonFromYmd(ymd);
	if (!mid) return null;
	const d = new Date(mid);
	d.setUTCDate(d.getUTCDate() + days);
	return ymdFromUtcNoon(d);
}

function mondayOfWeek(ymd: string): string | null {
	const mid = utcNoonFromYmd(ymd);
	if (!mid) return null;
	const js = mid.getUTCDay();
	const diffToMonday = (js + 6) % 7;
	const mon = new Date(mid);
	mon.setUTCDate(mon.getUTCDate() - diffToMonday);
	return ymdFromUtcNoon(mon);
}

function daysBetweenYmd(a: string, b: string): number | null {
	const da = utcNoonFromYmd(a);
	const db = utcNoonFromYmd(b);
	if (!da || !db) return null;
	return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

function daysInMonthUtc(year: number, monthIndex0: number): number {
	return new Date(Date.UTC(year, monthIndex0 + 1, 0, 12, 0, 0)).getUTCDate();
}

function ymdClampedMonthDay(year: number, monthIndex0: number, day: number): string {
	const dim = daysInMonthUtc(year, monthIndex0);
	const d = Math.min(Math.max(1, day), dim);
	return ymdFromUtcNoon(new Date(Date.UTC(year, monthIndex0, d, 12, 0, 0)));
}

export function isValidRecurrenceRule(rule: RecurrenceRule): boolean {
	if (!RECURRENCE_FREQS.includes(rule.freq)) return false;
	if (!Number.isInteger(rule.interval) || rule.interval < 1) return false;
	if (rule.freq === 'weekly') {
		if (!rule.byweekday || rule.byweekday.length === 0) return false;
		if (rule.bymonthday != null) return false;
		for (const d of rule.byweekday) {
			if (!Number.isInteger(d) || d < 1 || d > 7) return false;
		}
	} else {
		if (rule.bymonthday == null || rule.bymonthday < 1 || rule.bymonthday > 31) return false;
		if (rule.byweekday != null) return false;
	}
	if (!RECURRENCE_ENDS.includes(rule.ends)) return false;
	if (rule.ends === 'never') {
		if (rule.ends_count != null || rule.ends_on != null) return false;
	} else if (rule.ends === 'after_count') {
		if (rule.ends_count == null || rule.ends_count < 1 || rule.ends_on != null) return false;
	} else {
		if (!rule.ends_on || !parseYmd(rule.ends_on) || rule.ends_count != null) return false;
	}
	return true;
}

/**
 * Next occurrence start strictly after `fromYmd`.
 * Weekly interval is measured in weeks from the Monday of `fromYmd`'s week
 * (same-week remaining BYDAY dates are allowed when interval divides 0).
 */
export function nextStartDate(rule: RecurrenceRule, fromYmd: string): string | null {
	if (!isValidRecurrenceRule(rule) || !parseYmd(fromYmd)) return null;
	if (rule.freq === 'weekly') return nextWeeklyStart(rule, fromYmd);
	return nextMonthlyStart(rule, fromYmd);
}

function nextWeeklyStart(rule: RecurrenceRule, fromYmd: string): string | null {
	const days = [...(rule.byweekday ?? [])].sort((a, b) => a - b);
	const anchorMonday = mondayOfWeek(fromYmd);
	if (!anchorMonday) return null;

	for (let offset = 1; offset <= 400; offset++) {
		const candidate = addDaysYmd(fromYmd, offset);
		if (!candidate) return null;
		const iso = isoWeekdayFromYmd(candidate);
		if (iso == null || !days.includes(iso)) continue;
		const candMonday = mondayOfWeek(candidate);
		if (!candMonday) continue;
		const between = daysBetweenYmd(anchorMonday, candMonday);
		if (between == null) continue;
		const weeksApart = Math.floor(between / 7);
		if (weeksApart % rule.interval === 0) return candidate;
	}
	return null;
}

function nextMonthlyStart(rule: RecurrenceRule, fromYmd: string): string | null {
	const mid = utcNoonFromYmd(fromYmd);
	if (!mid || rule.bymonthday == null) return null;
	const baseYear = mid.getUTCFullYear();
	const baseMonth = mid.getUTCMonth();
	for (let step = 1; step <= 120; step++) {
		let year = baseYear;
		let month = baseMonth + rule.interval * step;
		while (month > 11) {
			month -= 12;
			year += 1;
		}
		const candidate = ymdClampedMonthDay(year, month, rule.bymonthday);
		if (candidate > fromYmd) return candidate;
	}
	return null;
}

/** True if the next occurrence (1-based index `nextOccurrence`) must not be created. */
export function seriesHasEnded(
	rule: RecurrenceRule,
	nextOccurrence: number,
	candidateStart: string,
	stoppedAt: string | null = null
): boolean {
	if (stoppedAt) return true;
	if (!isValidRecurrenceRule(rule)) return true;
	if (rule.ends === 'after_count') {
		return nextOccurrence > (rule.ends_count ?? 0);
	}
	if (rule.ends === 'on_date') {
		return candidateStart > (rule.ends_on ?? '');
	}
	return false;
}

export function formatRecurrenceSummary(rule: RecurrenceRule): string {
	if (!isValidRecurrenceRule(rule)) return 'Invalid recurrence';
	const every =
		rule.interval === 1
			? rule.freq === 'weekly'
				? 'Every week'
				: 'Every month'
			: rule.freq === 'weekly'
				? `Every ${rule.interval} weeks`
				: `Every ${rule.interval} months`;

	let when = '';
	if (rule.freq === 'weekly' && rule.byweekday) {
		const labels = [...rule.byweekday]
			.sort((a, b) => a - b)
			.map((d) => WEEKDAY_LABELS[d])
			.join(', ');
		when = ` on ${labels}`;
	} else if (rule.freq === 'monthly' && rule.bymonthday != null) {
		when = ` on day ${rule.bymonthday}`;
	}

	let end = '';
	if (rule.ends === 'after_count') end = ` · ends after ${rule.ends_count}`;
	else if (rule.ends === 'on_date') end = ` · ends ${rule.ends_on}`;
	else end = ' · no end';

	return `${every}${when}${end}`;
}

export function defaultRuleFromStartDate(startYmd: string, freq: RecurrenceFreq = 'weekly'): RecurrenceRule {
	const iso = isoWeekdayFromYmd(startYmd) ?? 1;
	const day = monthDayFromYmd(startYmd) ?? 1;
	if (freq === 'weekly') {
		return {
			freq: 'weekly',
			interval: 1,
			byweekday: [iso],
			bymonthday: null,
			ends: 'never',
			ends_count: null,
			ends_on: null
		};
	}
	return {
		freq: 'monthly',
		interval: 1,
		byweekday: null,
		bymonthday: day,
		ends: 'never',
		ends_count: null,
		ends_on: null
	};
}

/** Parse recurrence fields from FormData; returns null if recurrence is off. */
export function parseRecurrenceFormData(fd: FormData): RecurrenceRule | null | { error: string } {
	const enabled = String(fd.get('recurring') ?? '').trim();
	if (enabled !== '1' && enabled.toLowerCase() !== 'true' && enabled.toLowerCase() !== 'on') {
		return null;
	}

	const freqRaw = String(fd.get('recurrence_freq') ?? '').trim();
	if (!(RECURRENCE_FREQS as readonly string[]).includes(freqRaw)) {
		return { error: 'Choose weekly or monthly recurrence.' };
	}
	const freq = freqRaw as RecurrenceFreq;

	const interval = Number.parseInt(String(fd.get('recurrence_interval') ?? '1'), 10);
	if (!Number.isInteger(interval) || interval < 1 || interval > 99) {
		return { error: 'Recurrence interval must be 1–99.' };
	}

	let byweekday: IsoWeekday[] | null = null;
	let bymonthday: number | null = null;

	if (freq === 'weekly') {
		const raw = String(fd.get('recurrence_byweekday') ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		const days: IsoWeekday[] = [];
		for (const s of raw) {
			const n = Number.parseInt(s, 10);
			if (!Number.isInteger(n) || n < 1 || n > 7) {
				return { error: 'Invalid weekday in recurrence.' };
			}
			if (!days.includes(n as IsoWeekday)) days.push(n as IsoWeekday);
		}
		if (days.length === 0) return { error: 'Pick at least one weekday.' };
		byweekday = days;
	} else {
		const n = Number.parseInt(String(fd.get('recurrence_bymonthday') ?? ''), 10);
		if (!Number.isInteger(n) || n < 1 || n > 31) {
			return { error: 'Day of month must be 1–31.' };
		}
		bymonthday = n;
	}

	const endsRaw = String(fd.get('recurrence_ends') ?? 'never').trim();
	if (!(RECURRENCE_ENDS as readonly string[]).includes(endsRaw)) {
		return { error: 'Invalid recurrence end.' };
	}
	const ends = endsRaw as RecurrenceEnds;
	let ends_count: number | null = null;
	let ends_on: string | null = null;

	if (ends === 'after_count') {
		const n = Number.parseInt(String(fd.get('recurrence_ends_count') ?? ''), 10);
		if (!Number.isInteger(n) || n < 1 || n > 999) {
			return { error: 'End after count must be 1–999.' };
		}
		ends_count = n;
	} else if (ends === 'on_date') {
		const ymd = parseYmd(String(fd.get('recurrence_ends_on') ?? ''));
		if (!ymd) return { error: 'Valid end date is required.' };
		ends_on = ymd;
	}

	const rule: RecurrenceRule = {
		freq,
		interval,
		byweekday,
		bymonthday,
		ends,
		ends_count,
		ends_on
	};
	if (!isValidRecurrenceRule(rule)) return { error: 'Invalid recurrence rule.' };
	return rule;
}

export function parseSeriesScope(raw: FormDataEntryValue | null): TaskSeriesScope | null {
	const t = String(raw ?? '').trim();
	if (t === 'this' || t === 'series') return t;
	return null;
}

export function ruleFromSeriesRow(row: {
	freq: string;
	interval: number;
	byweekday: number[] | null;
	bymonthday: number | null;
	ends: string;
	ends_count: number | null;
	ends_on: string | null;
}): RecurrenceRule | null {
	if (!(RECURRENCE_FREQS as readonly string[]).includes(row.freq)) return null;
	if (!(RECURRENCE_ENDS as readonly string[]).includes(row.ends)) return null;
	const byweekday =
		row.byweekday == null
			? null
			: (row.byweekday.filter((d) => d >= 1 && d <= 7) as IsoWeekday[]);
	const rule: RecurrenceRule = {
		freq: row.freq as RecurrenceFreq,
		interval: row.interval,
		byweekday,
		bymonthday: row.bymonthday,
		ends: row.ends as RecurrenceEnds,
		ends_count: row.ends_count,
		ends_on: row.ends_on
	};
	return isValidRecurrenceRule(rule) ? rule : null;
}

export type SeriesTemplateFields = {
	project_id: string;
	title: string;
	priority: TaskPriority;
	notes: string | null;
};
