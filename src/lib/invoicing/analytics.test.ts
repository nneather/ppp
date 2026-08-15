import { describe, expect, it } from 'vitest';
import {
	analyticsHref,
	analyticsRangeEndingToday,
	analyticsRangeYtd,
	bucketKeyForYmd,
	buildAnalyticsSeries,
	parseAnalyticsSearchParams,
	resolveAnalyticsRange,
	summarizeAnalyticsSeries,
	sumOneOffMoney
} from './analytics';

describe('bucketKeyForYmd', () => {
	it('uses Monday for week grain', () => {
		// 2026-08-05 is Wednesday → week starts 2026-08-03
		expect(bucketKeyForYmd('2026-08-05', 'week')).toBe('2026-08-03');
		expect(bucketKeyForYmd('2026-08-03', 'week')).toBe('2026-08-03');
	});

	it('uses YYYY-MM for month grain', () => {
		expect(bucketKeyForYmd('2026-08-05', 'month')).toBe('2026-08');
	});
});

describe('analyticsRangeEndingToday', () => {
	it('returns 26 week buckets ending at today', () => {
		const { start, end } = analyticsRangeEndingToday('week', '2026-08-05');
		expect(end).toBe('2026-08-05');
		// Monday of current week minus 25 weeks
		expect(start).toBe('2026-02-09');
	});

	it('returns 12 months ending at today', () => {
		const { start, end } = analyticsRangeEndingToday('month', '2026-08-05');
		expect(end).toBe('2026-08-05');
		expect(start).toBe('2025-09-01');
	});
});

describe('analyticsRangeYtd / resolveAnalyticsRange', () => {
	it('YTD is Jan 1 through today', () => {
		expect(analyticsRangeYtd('2026-08-15')).toEqual({
			start: '2026-01-01',
			end: '2026-08-15'
		});
	});

	it('defaults to YTD', () => {
		const r = resolveAnalyticsRange({
			preset: 'ytd',
			from: null,
			to: null,
			todayYmd: '2026-08-15'
		});
		expect(r).toEqual({ start: '2026-01-01', end: '2026-08-15', preset: 'ytd' });
	});

	it('resolves 12m and 26w', () => {
		expect(
			resolveAnalyticsRange({
				preset: '12m',
				from: null,
				to: null,
				todayYmd: '2026-08-05'
			})
		).toEqual({ start: '2025-09-01', end: '2026-08-05', preset: '12m' });
		expect(
			resolveAnalyticsRange({
				preset: '26w',
				from: null,
				to: null,
				todayYmd: '2026-08-05'
			})
		).toEqual({ start: '2026-02-09', end: '2026-08-05', preset: '26w' });
	});

	it('resolves all from earliest entry', () => {
		expect(
			resolveAnalyticsRange({
				preset: 'all',
				from: null,
				to: null,
				todayYmd: '2026-08-15',
				earliestEntryYmd: '2025-06-23'
			})
		).toEqual({ start: '2025-06-23', end: '2026-08-15', preset: 'all' });
	});

	it('resolves custom from/to', () => {
		expect(
			resolveAnalyticsRange({
				preset: 'custom',
				from: '2026-03-01',
				to: '2026-06-30',
				todayYmd: '2026-08-15'
			})
		).toEqual({ start: '2026-03-01', end: '2026-06-30', preset: 'custom' });
	});
});

describe('buildAnalyticsSeries', () => {
	const entries = [
		{ date: '2026-08-03', hours: 2, rate: 100, client_id: 'a' },
		{ date: '2026-08-05', hours: 1.5, rate: 100, client_id: 'a' },
		{ date: '2026-07-15', hours: 4, rate: 50, client_id: 'b' },
		{ date: '2026-06-01', hours: 10, rate: 100, client_id: 'a' } // outside week range below
	];

	it('aggregates weeks with zero-fill', () => {
		const series = buildAnalyticsSeries(entries, {
			grain: 'week',
			rangeStart: '2026-07-13',
			rangeEnd: '2026-08-05'
		});
		// Jul 13, Jul 20, Jul 27, Aug 3
		expect(series).toHaveLength(4);
		expect(series.map((b) => b.key)).toEqual([
			'2026-07-13',
			'2026-07-20',
			'2026-07-27',
			'2026-08-03'
		]);
		const jul15Week = series.find((b) => b.key === '2026-07-13');
		expect(jul15Week?.hours).toBe(4);
		expect(jul15Week?.money).toBe(200);
		const augWeek = series.find((b) => b.key === '2026-08-03');
		expect(augWeek?.hours).toBe(3.5);
		expect(augWeek?.money).toBe(350);
		expect(series.find((b) => b.key === '2026-07-20')?.hours).toBe(0);
	});

	it('aggregates months with zero-fill', () => {
		const series = buildAnalyticsSeries(entries, {
			grain: 'month',
			rangeStart: '2026-06-01',
			rangeEnd: '2026-08-05'
		});
		expect(series.map((b) => b.key)).toEqual(['2026-06', '2026-07', '2026-08']);
		expect(series[0].hours).toBe(10);
		expect(series[0].money).toBe(1000);
		expect(series[1].hours).toBe(4);
		expect(series[2].hours).toBe(3.5);
	});

	it('ignores entries outside range', () => {
		const series = buildAnalyticsSeries(entries, {
			grain: 'week',
			rangeStart: '2026-08-03',
			rangeEnd: '2026-08-05'
		});
		expect(series).toHaveLength(1);
		expect(series[0].hours).toBe(3.5);
	});

	it('one-offs add money but not hours', () => {
		const mixed = [
			{ date: '2026-08-03', hours: 2, rate: 100, client_id: 'a', is_one_off: false },
			{
				date: '2026-08-04',
				hours: 1,
				rate: 1600,
				client_id: 'a',
				is_one_off: true
			}
		];
		const series = buildAnalyticsSeries(mixed, {
			grain: 'week',
			rangeStart: '2026-08-03',
			rangeEnd: '2026-08-09'
		});
		expect(series).toHaveLength(1);
		expect(series[0].hours).toBe(2);
		expect(series[0].money).toBe(1800);
		expect(sumOneOffMoney(mixed, '2026-08-03', '2026-08-09')).toBe(1600);
	});
});

describe('summarizeAnalyticsSeries', () => {
	it('totals and averages', () => {
		const summary = summarizeAnalyticsSeries(
			[
				{ key: 'a', label: 'a', hours: 2, money: 200 },
				{ key: 'b', label: 'b', hours: 0, money: 0 },
				{ key: 'c', label: 'c', hours: 4, money: 100 }
			],
			{ oneOffMoney: 50 }
		);
		expect(summary.totalHours).toBe(6);
		expect(summary.totalMoney).toBe(300);
		expect(summary.bucketCount).toBe(3);
		expect(summary.avgHours).toBe(2);
		expect(summary.avgMoney).toBe(100);
		expect(summary.oneOffMoney).toBe(50);
	});
});

describe('URL helpers', () => {
	it('parses defaults', () => {
		expect(parseAnalyticsSearchParams(new URLSearchParams())).toEqual({
			grain: 'week',
			metric: 'hours',
			clientId: null,
			rangePreset: 'ytd',
			from: null,
			to: null
		});
	});

	it('parses grain metric client range', () => {
		const p = new URLSearchParams('grain=month&metric=both&client=abc&range=12m');
		expect(parseAnalyticsSearchParams(p)).toEqual({
			grain: 'month',
			metric: 'both',
			clientId: 'abc',
			rangePreset: '12m',
			from: null,
			to: null
		});
	});

	it('parses custom from/to', () => {
		const p = new URLSearchParams('range=custom&from=2026-01-01&to=2026-03-31');
		expect(parseAnalyticsSearchParams(p)).toEqual({
			grain: 'week',
			metric: 'hours',
			clientId: null,
			rangePreset: 'custom',
			from: '2026-01-01',
			to: '2026-03-31'
		});
	});

	it('builds compact href', () => {
		expect(
			analyticsHref({
				grain: 'week',
				metric: 'hours',
				clientId: null,
				rangePreset: 'ytd',
				from: null,
				to: null
			})
		).toBe('/invoicing/analytics');
		expect(
			analyticsHref({
				grain: 'month',
				metric: 'both',
				clientId: 'x',
				rangePreset: '12m',
				from: null,
				to: null
			})
		).toBe('/invoicing/analytics?grain=month&metric=both&client=x&range=12m');
		expect(
			analyticsHref({
				grain: 'week',
				metric: 'hours',
				clientId: null,
				rangePreset: 'custom',
				from: '2026-01-01',
				to: '2026-02-01'
			})
		).toBe('/invoicing/analytics?range=custom&from=2026-01-01&to=2026-02-01');
	});
});
