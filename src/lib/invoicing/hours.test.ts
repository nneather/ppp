import { describe, expect, it } from 'vitest';
import { formatHoursForInput, parseHoursInput, snapHoursToQuarter } from './hours';

describe('snapHoursToQuarter', () => {
	it('snaps near-quarter fractions', () => {
		expect(snapHoursToQuarter(0.28)).toBe(0.25);
		expect(snapHoursToQuarter(1.5)).toBe(1.5);
		expect(snapHoursToQuarter(1.12)).toBe(1);
		expect(snapHoursToQuarter(1.875)).toBe(2);
	});

	it('leaves whole hours unchanged', () => {
		expect(snapHoursToQuarter(3)).toBe(3);
	});
});

describe('formatHoursForInput', () => {
	it('formats without trailing zeros', () => {
		expect(formatHoursForInput(1.5)).toBe('1.5');
		expect(formatHoursForInput(2)).toBe('2');
	});
});

describe('parseHoursInput', () => {
	it('accepts comma decimals', () => {
		expect(parseHoursInput('1,5')).toBe(1.5);
	});

	it('rejects empty and invalid', () => {
		expect(parseHoursInput('')).toBeNull();
		expect(parseHoursInput('abc')).toBeNull();
		expect(parseHoursInput('0')).toBeNull();
		expect(parseHoursInput('-1')).toBeNull();
	});
});
