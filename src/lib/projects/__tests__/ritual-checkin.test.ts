import { describe, expect, it } from 'vitest';
import {
	startDateInSundayWeek,
	sundayWeekEndYmd,
	WEEKLY_PROJECT_CHECKIN_RITUAL
} from '$lib/projects/ritual-checkin';

describe('ritual-checkin', () => {
	it('exports the weekly check-in ritual kind', () => {
		expect(WEEKLY_PROJECT_CHECKIN_RITUAL).toBe('weekly_project_checkin');
	});

	it('sundayWeekEndYmd is Saturday of that week', () => {
		// 2026-10-18 is Sunday
		expect(sundayWeekEndYmd('2026-10-18')).toBe('2026-10-24');
	});

	it('startDateInSundayWeek includes Monday ritual in the Sunday week', () => {
		const weekOf = '2026-10-18';
		expect(startDateInSundayWeek('2026-10-18', weekOf)).toBe(true); // Sunday
		expect(startDateInSundayWeek('2026-10-19', weekOf)).toBe(true); // Monday
		expect(startDateInSundayWeek('2026-10-24', weekOf)).toBe(true); // Saturday
		expect(startDateInSundayWeek('2026-10-25', weekOf)).toBe(false); // next Sunday
		expect(startDateInSundayWeek('2026-10-17', weekOf)).toBe(false); // prior Saturday
	});
});
