import { describe, expect, it } from 'vitest';
import {
	clockForInput,
	formatClock,
	formatVenueLogistics,
	parseHymnal,
	parseVenueLogisticsFields
} from '../venue-logistics';

describe('formatClock', () => {
	it('drops :00 and keeps minutes', () => {
		expect(formatClock('09:30:00')).toBe('9:30 AM');
		expect(formatClock('11:00')).toBe('11 AM');
		expect(formatClock('08:15:00')).toBe('8:15 AM');
		expect(formatClock('00:15')).toBe('12:15 AM');
		expect(formatClock('12:00:00')).toBe('12 PM');
	});

	it('returns null for empty or garbage', () => {
		expect(formatClock(null)).toBeNull();
		expect(formatClock('')).toBeNull();
		expect(formatClock('noon')).toBeNull();
	});
});

describe('clockForInput', () => {
	it('strips seconds for a time input', () => {
		expect(clockForInput('09:30:00')).toBe('09:30');
		expect(clockForInput(null)).toBe('');
	});
});

describe('formatVenueLogistics', () => {
	it('joins the fields a church actually has', () => {
		expect(
			formatVenueLogistics({
				service_start: '09:30:00',
				depart_by: '08:15:00',
				drive_minutes: 55,
				hymnal: 'trinity'
			})
		).toBe('9:30 AM · leave by 8:15 AM · 55 min drive · Trinity Hymnal');
	});

	it('omits unset fields', () => {
		expect(
			formatVenueLogistics({
				service_start: '10:30',
				depart_by: null,
				drive_minutes: null,
				hymnal: null
			})
		).toBe('10:30 AM');
		expect(
			formatVenueLogistics({
				service_start: null,
				depart_by: null,
				drive_minutes: null,
				hymnal: null
			})
		).toBeNull();
	});
});

describe('parseVenueLogisticsFields', () => {
	it('accepts empty optionals and normalizes clocks', () => {
		const parsed = parseVenueLogisticsFields({
			serviceStart: '9:30',
			driveMinutes: '',
			departBy: null,
			hymnal: '',
			notes: '  '
		});
		expect(parsed).toEqual({
			ok: true,
			value: {
				service_start: '09:30:00',
				drive_minutes: null,
				depart_by: null,
				hymnal: null,
				notes: null
			}
		});
	});

	it('rejects a bad clock, drive, or hymnal', () => {
		expect(
			parseVenueLogisticsFields({
				serviceStart: '25:00',
				driveMinutes: null,
				departBy: null,
				hymnal: null,
				notes: null
			}).ok
		).toBe(false);
		expect(
			parseVenueLogisticsFields({
				serviceStart: null,
				driveMinutes: '0',
				departBy: null,
				hymnal: null,
				notes: null
			}).ok
		).toBe(false);
		expect(
			parseVenueLogisticsFields({
				serviceStart: null,
				driveMinutes: null,
				departBy: null,
				hymnal: 'baptist',
				notes: null
			}).ok
		).toBe(false);
	});

	it('keeps the celebration preset', () => {
		expect(parseHymnal('celebration')).toBe('celebration');
		expect(parseHymnal('worship_and_celebration')).toBe('worship_and_celebration');
		expect(parseHymnal(null)).toBeNull();
	});
});
