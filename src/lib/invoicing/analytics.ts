/**
 * Pure helpers for /invoicing/analytics — bucket time entries by Chicago week/month.
 */
import {
	addDaysYmd,
	calendarMonthContainingYmd,
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

export type AnalyticsEntryInput = {
	date: string;
	hours: number;
	rate: number;
	client_id: string;
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
};

export const ANALYTICS_WEEK_BUCKETS = 26;
export const ANALYTICS_MONTH_BUCKETS = 12;

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

/** Inclusive civil range ending at Chicago today (or `todayYmd`). */
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
		const prev = sums.get(key) ?? { hours: 0, money: 0 };
		prev.hours += hours;
		prev.money += hours * rate;
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

export function summarizeAnalyticsSeries(series: AnalyticsBucket[]): AnalyticsSummary {
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
		bucketCount
	};
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

export type AnalyticsUrlState = {
	grain: AnalyticsGrain;
	metric: AnalyticsMetric;
	clientId: string | null;
};

export function parseAnalyticsSearchParams(params: URLSearchParams): AnalyticsUrlState {
	return {
		grain: parseAnalyticsGrain(params.get('grain')),
		metric: parseAnalyticsMetric(params.get('metric')),
		clientId: parseAnalyticsClientId(params.get('client'))
	};
}

export function analyticsHref(state: AnalyticsUrlState): string {
	const u = new URLSearchParams();
	if (state.grain !== 'week') u.set('grain', state.grain);
	if (state.metric !== 'hours') u.set('metric', state.metric);
	if (state.clientId) u.set('client', state.clientId);
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
