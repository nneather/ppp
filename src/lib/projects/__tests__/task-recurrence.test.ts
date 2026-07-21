import { describe, expect, it } from 'vitest';
import {
	defaultRuleFromStartDate,
	formatRecurrenceSummary,
	isoWeekdayFromYmd,
	nextStartDate,
	seriesHasEnded,
	type RecurrenceRule
} from '../task-recurrence';

const weeklyMon: RecurrenceRule = {
	freq: 'weekly',
	interval: 1,
	byweekday: [1],
	bymonthday: null,
	ends: 'never',
	ends_count: null,
	ends_on: null
};

describe('task-recurrence', () => {
	it('maps ISO weekday from YMD', () => {
		// 2026-07-20 is Monday
		expect(isoWeekdayFromYmd('2026-07-20')).toBe(1);
		expect(isoWeekdayFromYmd('2026-07-26')).toBe(7);
	});

	it('weekly: next same weekday one week later', () => {
		expect(nextStartDate(weeklyMon, '2026-07-20')).toBe('2026-07-27');
	});

	it('weekly: multi-day picks later day in same week', () => {
		const rule: RecurrenceRule = {
			...weeklyMon,
			byweekday: [1, 3]
		};
		expect(nextStartDate(rule, '2026-07-20')).toBe('2026-07-22'); // Wed
		expect(nextStartDate(rule, '2026-07-22')).toBe('2026-07-27'); // next Mon
	});

	it('weekly: every 2 weeks skips intervening week', () => {
		const rule: RecurrenceRule = { ...weeklyMon, interval: 2 };
		expect(nextStartDate(rule, '2026-07-20')).toBe('2026-08-03');
	});

	it('monthly: next month same day', () => {
		const rule: RecurrenceRule = {
			freq: 'monthly',
			interval: 1,
			byweekday: null,
			bymonthday: 15,
			ends: 'never',
			ends_count: null,
			ends_on: null
		};
		expect(nextStartDate(rule, '2026-01-15')).toBe('2026-02-15');
	});

	it('monthly: clamps short months', () => {
		const rule: RecurrenceRule = {
			freq: 'monthly',
			interval: 1,
			byweekday: null,
			bymonthday: 31,
			ends: 'never',
			ends_count: null,
			ends_on: null
		};
		expect(nextStartDate(rule, '2026-01-31')).toBe('2026-02-28');
		expect(nextStartDate(rule, '2026-02-28')).toBe('2026-03-31');
	});

	it('seriesHasEnded after_count and on_date', () => {
		const after: RecurrenceRule = {
			...weeklyMon,
			ends: 'after_count',
			ends_count: 3
		};
		expect(seriesHasEnded(after, 3, '2026-08-01')).toBe(false);
		expect(seriesHasEnded(after, 4, '2026-08-01')).toBe(true);

		const onDate: RecurrenceRule = {
			...weeklyMon,
			ends: 'on_date',
			ends_on: '2026-08-01'
		};
		expect(seriesHasEnded(onDate, 2, '2026-08-01')).toBe(false);
		expect(seriesHasEnded(onDate, 2, '2026-08-02')).toBe(true);
		expect(seriesHasEnded(onDate, 2, '2026-08-02', '2026-07-01T00:00:00Z')).toBe(true);
	});

	it('defaultRuleFromStartDate + summary', () => {
		const rule = defaultRuleFromStartDate('2026-07-20', 'weekly');
		expect(rule.byweekday).toEqual([1]);
		expect(formatRecurrenceSummary(rule)).toContain('Every week');
		expect(formatRecurrenceSummary(rule)).toContain('Mon');
	});
});
