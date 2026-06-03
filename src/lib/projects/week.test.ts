import { describe, expect, it } from 'vitest';
import {
	currentSundayChicago,
	sundayContaining,
	previousSunday,
	parseYmd
} from '$lib/projects/week';

describe('projects week math', () => {
	it('parseYmd accepts valid civil dates', () => {
		expect(parseYmd('2026-06-01')).toBe('2026-06-01');
		expect(parseYmd('bad')).toBeNull();
	});

	it('sundayContaining returns same day when already Sunday', () => {
		// 2026-06-07 is a Sunday
		expect(sundayContaining('2026-06-07')).toBe('2026-06-07');
	});

	it('sundayContaining walks back to prior Sunday', () => {
		// 2026-06-03 is Wednesday → prior Sunday is 2026-05-31
		expect(sundayContaining('2026-06-03')).toBe('2026-05-31');
	});

	it('previousSunday subtracts seven days', () => {
		expect(previousSunday('2026-06-07')).toBe('2026-05-31');
	});

	it('currentSundayChicago returns a Sunday YMD', () => {
		const sun = currentSundayChicago();
		expect(parseYmd(sun)).toBe(sun);
		const mid = new Date(`${sun}T12:00:00Z`);
		expect(mid.getUTCDay()).toBe(0);
	});
});
