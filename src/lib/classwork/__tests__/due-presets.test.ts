import { describe, expect, it } from 'vitest';
import {
	dueDateForPreset,
	parseAssignmentDuePreset
} from '$lib/classwork/due-presets';

describe('due-presets', () => {
	it('parseAssignmentDuePreset accepts known keys', () => {
		expect(parseAssignmentDuePreset('tomorrow')).toBe('tomorrow');
		expect(parseAssignmentDuePreset('monday')).toBe('monday');
		expect(parseAssignmentDuePreset('week')).toBe('week');
		expect(parseAssignmentDuePreset('nope')).toBeNull();
		expect(parseAssignmentDuePreset(null)).toBeNull();
	});

	it('dueDateForPreset resolves tomorrow and +1 week', () => {
		expect(dueDateForPreset('tomorrow', '2026-10-19')).toBe('2026-10-20');
		expect(dueDateForPreset('week', '2026-10-19')).toBe('2026-10-26');
	});

	it('dueDateForPreset next Monday skips today when today is Monday', () => {
		// 2026-10-19 is Monday → next Monday is 2026-10-26
		expect(dueDateForPreset('monday', '2026-10-19')).toBe('2026-10-26');
		// 2026-10-18 is Sunday → next Monday is 2026-10-19
		expect(dueDateForPreset('monday', '2026-10-18')).toBe('2026-10-19');
	});
});
