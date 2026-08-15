/**
 * Pure helpers for /invoicing/analytics — bucket time entries by Chicago week/month.
 */
import {
	addDaysYmd,
	calendarMonthContainingYmd,
	firstOfYearThroughYmd,
	formatYmdMediumChicago,
	formatYmdMonthYearChicago,
	formatYmdShortChicago,
	mondaySundayWeekContainingYmd,
	utcNoonFromYmd,
	ymdFromUtcNoon,
	ymdInChicago
} from './chicago-date';

export type AnalyticsGrain = 'week' | 'month';
export type AnalyticsMetric = 'hours' | 'money' | 'both';

/** Named range presets; omit / `ytd` = year-to-date (default). */
export type AnalyticsRangePreset = 'ytd' | '12m' | '26w' | 'all' | 'custom';

export type AnalyticsEntryInput = {
	date: string;
	hours: number;
	rate: number;
	client_id: string;
	/** One-off ledger rows contribute money but not hours. */
	is_one_off?: boolean;
};

export type AnalyticsBucket = {
	/** Week Monday YMD or `YYYY-MM`. */
	key: string;
	label: string;
	hours: number;
	money: number;
};

export type AnalyticsSummary = {
	totalHours: number;
	totalMoney: number;
	avgHours: number;
	avgMoney: number;
	bucketCount: number;
	/** Money from one-off charges in the series (subset of totalMoney). */
	oneOffMoney: number;
};

export const ANALYTICS_WEEK_BUCKETS = 26;
export const ANALYTICS_MONTH_BUCKETS = 12;
export const ANALYTICS_MAX_WEEK_BUCKETS = 104;
export const ANALYTICS_MAX_MONTH_BUCKETS = 36;

export function bucketKeyForYmd(ymd: string, grain: AnalyticsGrain): string {
	if (grain === 'week') return mondaySundayWeekContainingYmd(ymd).start;
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
	if (!m) return ymd.slice(0, 7);
	return `${m[1]}-${m[2]}`;
}

export function bucketLabelForKey(key: string, grain: AnalyticsGrain): string {
	if (grain === 'week') return formatYmdShortChicago(key);
	const ymd = /^\d{4}-\d{2}$/.test(key) ? `${key}-01` : key;
	return formatYmdMonthYearChicago(ymd);
}

/** Inclusive civil range ending at Chicago today (or `todayYmd`). Legacy 26w / 12mo. */
export function analyticsRangeEndingToday(
	grain: AnalyticsGrain,
	todayYmd: string = ymdInChicago()
): { start: string; end: string } {
	if (grain === 'week') {
		const thisMon = mondaySundayWeekContainingYmd(todayYmd).start;
		const start = addDaysYmd(thisMon, -(ANALYTICS_WEEK_BUCKETS - 1) * 7);
		return { start: start ?? thisMon, end: todayYmd };
	}
	const { start: thisMonthStart } = calendarMonthContainingYmd(todayYmd);
	const mid = utcNoonFromYmd(thisMonthStart);
	if (!mid) return { start: thisMonthStart, end: todayYmd };
	mid.setUTCMonth(mid.getUTCMonth() - (ANALYTICS_MONTH_BUCKETS - 1));
	return { start: ymdFromUtcNoon(mid), end: todayYmd };
}

/** Rolling 12 calendar months ending at `todayYmd` (first of month 11 months ago). */
export function analyticsRange12Months(todayYmd: string = ymdInChicago()): {
	start: string;
	end: string;
} {
	const { start: thisMonthStart } = calendarMonthContainingYmd(todayYmd);
	const mid = utcNoonFromYmd(thisMonthStart);
	if (!mid) return { start: thisMonthStart, end: todayYmd };
	mid.setUTCMonth(mid.getUTCMonth() - (ANALYTICS_MONTH_BUCKETS - 1));
	return { start: ymdFromUtcNoon(mid), end: todayYmd };
}

/** Rolling 26 Chicago weeks ending at `todayYmd`. */
export function analyticsRange26Weeks(todayYmd: string = ymdInChicago()): {
	start: string;
	end: string;
} {
	return analyticsRangeEndingToday('week', todayYmd);
}

export function analyticsRangeYtd(todayYmd: string = ymdInChicago()): { start: string; end: string } {
	return firstOfYearThroughYmd(todayYmd);
}

function countBuckets(grain: AnalyticsGrain, rangeStart: string, rangeEnd: string): number {
	let n = 0;
	for (const _ of iterateBucketKeys(grain, rangeStart, rangeEnd)) n += 1;
	return n;
}

export function analyticsBucketLimitExceeded(
	grain: AnalyticsGrain,
	rangeStart: string,
	rangeEnd: string
): boolean {
	const n = countBuckets(grain, rangeStart, rangeEnd);
	if (grain === 'week') return n > ANALYTICS_MAX_WEEK_BUCKETS;
	return n > ANALYTICS_MAX_MONTH_BUCKETS;
}

export function resolveAnalyticsRange(opts: {
	preset: AnalyticsRangePreset;
	from: string | null;
	to: string | null;
	todayYmd?: string;
	/** Earliest live entry date for `all` preset; falls back to YTD start if null. */
	earliestEntryYmd?: string | null;
}): { start: string; end: string; preset: AnalyticsRangePreset } {
	const today = opts.todayYmd ?? ymdInChicago();
	const preset = opts.preset;

	if (preset === 'custom' || (opts.from && opts.to)) {
		const from = opts.from && utcNoonFromYmd(opts.from) ? opts.from : null;
		const to = opts.to && utcNoonFromYmd(opts.to) ? opts.to : null;
		if (from && to) {
			const start = from <= to ? from : to;
			const end = from <= to ? to : from;
			const clampedEnd = end > today ? today : end;
			return { start, end: clampedEnd, preset: 'custom' };
		}
		// Incomplete custom → fall through to YTD
	}

	if (preset === '12m') {
		const r = analyticsRange12Months(today);
		return { ...r, preset: '12m' };
	}
	if (preset === '26w') {
		const r = analyticsRange26Weeks(today);
		return { ...r, preset: '26w' };
	}
	if (preset === 'all') {
		const earliest = opts.earliestEntryYmd;
		const start =
			earliest && utcNoonFromYmd(earliest) ? earliest : firstOfYearThroughYmd(today).start;
		return { start, end: today, preset: 'all' };
	}

	const r = analyticsRangeYtd(today);
	return { ...r, preset: 'ytd' };
}

function* iterateBucketKeys(
	grain: AnalyticsGrain,
	rangeStart: string,
	rangeEnd: string
): Generator<string> {
	if (grain === 'week') {
		let key = mondaySundayWeekContainingYmd(rangeStart).start;
		const last = mondaySundayWeekContainingYmd(rangeEnd).start;
		while (key <= last) {
			yield key;
			const next = addDaysYmd(key, 7);
			if (!next || next === key) break;
			key = next;
		}
		return;
	}
	let key = bucketKeyForYmd(rangeStart, 'month');
	const last = bucketKeyForYmd(rangeEnd, 'month');
	while (key <= last) {
		yield key;
		const mid = utcNoonFromYmd(`${key}-01`);
		if (!mid) break;
		mid.setUTCMonth(mid.getUTCMonth() + 1);
		key = bucketKeyForYmd(ymdFromUtcNoon(mid), 'month');
	}
}

/** Zero-filled series for [rangeStart, rangeEnd]; entries outside the range are ignored. */
export function buildAnalyticsSeries(
	entries: AnalyticsEntryInput[],
	opts: { grain: AnalyticsGrain; rangeStart: string; rangeEnd: string }
): AnalyticsBucket[] {
	const { grain, rangeStart, rangeEnd } = opts;
	const sums = new Map<string, { hours: number; money: number }>();

	for (const e of entries) {
		if (e.date < rangeStart || e.date > rangeEnd) continue;
		const key = bucketKeyForYmd(e.date, grain);
		const hours = Number(e.hours) || 0;
		const rate = Number(e.rate) || 0;
		const money = hours * rate;
		const prev = sums.get(key) ?? { hours: 0, money: 0 };
		if (!e.is_one_off) prev.hours += hours;
		prev.money += money;
		sums.set(key, prev);
	}

	const series: AnalyticsBucket[] = [];
	for (const key of iterateBucketKeys(grain, rangeStart, rangeEnd)) {
		const s = sums.get(key) ?? { hours: 0, money: 0 };
		series.push({
			key,
			label: bucketLabelForKey(key, grain),
			hours: roundHours(s.hours),
			money: roundMoney(s.money)
		});
	}
	return series;
}

export function summarizeAnalyticsSeries(
	series: AnalyticsBucket[],
	opts?: { oneOffMoney?: number }
): AnalyticsSummary {
	const bucketCount = series.length;
	let totalHours = 0;
	let totalMoney = 0;
	for (const b of series) {
		totalHours += b.hours;
		totalMoney += b.money;
	}
	totalHours = roundHours(totalHours);
	totalMoney = roundMoney(totalMoney);
	return {
		totalHours,
		totalMoney,
		avgHours: bucketCount > 0 ? roundHours(totalHours / bucketCount) : 0,
		avgMoney: bucketCount > 0 ? roundMoney(totalMoney / bucketCount) : 0,
		bucketCount,
		oneOffMoney: roundMoney(opts?.oneOffMoney ?? 0)
	};
}

/** Sum one-off money in range (for summary caption). */
export function sumOneOffMoney(
	entries: AnalyticsEntryInput[],
	rangeStart: string,
	rangeEnd: string
): number {
	let t = 0;
	for (const e of entries) {
		if (!e.is_one_off) continue;
		if (e.date < rangeStart || e.date > rangeEnd) continue;
		t += (Number(e.hours) || 0) * (Number(e.rate) || 0);
	}
	return roundMoney(t);
}

export function parseAnalyticsGrain(raw: string | null): AnalyticsGrain {
	return raw === 'month' ? 'month' : 'week';
}

export function parseAnalyticsMetric(raw: string | null): AnalyticsMetric {
	if (raw === 'money' || raw === 'both') return raw;
	return 'hours';
}

/** `null` = all clients. */
export function parseAnalyticsClientId(raw: string | null): string | null {
	if (!raw || raw === 'all') return null;
	const t = raw.trim();
	return t.length > 0 ? t : null;
}

export function parseAnalyticsRangePreset(raw: string | null): AnalyticsRangePreset {
	if (raw === '12m' || raw === '26w' || raw === 'all' || raw === 'custom') return raw;
	return 'ytd';
}

export type AnalyticsUrlState = {
	grain: AnalyticsGrain;
	metric: AnalyticsMetric;
	clientId: string | null;
	rangePreset: AnalyticsRangePreset;
	from: string | null;
	to: string | null;
};

export function parseAnalyticsSearchParams(params: URLSearchParams): AnalyticsUrlState {
	const from = params.get('from');
	const to = params.get('to');
	const hasCustomDates =
		!!from && !!to && !!utcNoonFromYmd(from) && !!utcNoonFromYmd(to);
	const rangeRaw = params.get('range');
	let rangePreset = parseAnalyticsRangePreset(rangeRaw);
	if (hasCustomDates && (!rangeRaw || rangeRaw === 'custom')) {
		rangePreset = 'custom';
	} else if (hasCustomDates && rangeRaw === 'custom') {
		rangePreset = 'custom';
	}
	return {
		grain: parseAnalyticsGrain(params.get('grain')),
		metric: parseAnalyticsMetric(params.get('metric')),
		clientId: parseAnalyticsClientId(params.get('client')),
		rangePreset,
		from: from && utcNoonFromYmd(from) ? from : null,
		to: to && utcNoonFromYmd(to) ? to : null
	};
}

export function analyticsHref(state: AnalyticsUrlState): string {
	const u = new URLSearchParams();
	if (state.grain !== 'week') u.set('grain', state.grain);
	if (state.metric !== 'hours') u.set('metric', state.metric);
	if (state.clientId) u.set('client', state.clientId);
	if (state.rangePreset !== 'ytd') u.set('range', state.rangePreset);
	if (state.rangePreset === 'custom') {
		if (state.from) u.set('from', state.from);
		if (state.to) u.set('to', state.to);
	}
	const q = u.toString();
	return q ? `/invoicing/analytics?${q}` : '/invoicing/analytics';
}

export function tooltipPeriodLabel(key: string, grain: AnalyticsGrain): string {
	if (grain === 'month') return bucketLabelForKey(key, grain);
	const week = mondaySundayWeekContainingYmd(key);
	if (week.start === week.end) return formatYmdMediumChicago(week.start);
	return `${formatYmdShortChicago(week.start)} – ${formatYmdMediumChicago(week.end)}`;
}

function roundHours(n: number): number {
	return Math.round(n * 100) / 100;
}

function roundMoney(n: number): number {
	return Math.round(n * 100) / 100;
}
