import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PROGRESS_MAX,
	formatProgressLabel,
	isProgressEnabled,
	progressPercent,
	parseProgressMax,
	parseProgressValue
} from '$lib/projects/progress';

describe('formatProgressLabel', () => {
	it('uses percent suffix when max is 100', () => {
		expect(formatProgressLabel(42, 100)).toBe('42/100%');
	});

	it('uses plain fraction for custom max', () => {
		expect(formatProgressLabel(5, 12)).toBe('5/12');
	});
});

describe('progressPercent', () => {
	it('clamps to 0–100', () => {
		expect(progressPercent(50, 100)).toBe(50);
		expect(progressPercent(0, 12)).toBe(0);
		expect(progressPercent(12, 12)).toBe(100);
		expect(progressPercent(99, 12)).toBe(100);
	});
});

describe('isProgressEnabled', () => {
	it('is false only when value is null', () => {
		expect(isProgressEnabled(null)).toBe(false);
		expect(isProgressEnabled(undefined)).toBe(false);
		expect(isProgressEnabled(0)).toBe(true);
	});
});

describe('parseProgressMax', () => {
	it('rejects invalid', () => {
		expect(parseProgressMax(0)).toBeNull();
		expect(parseProgressMax('x')).toBeNull();
	});

	it('accepts positive integers', () => {
		expect(parseProgressMax(100)).toBe(100);
		expect(parseProgressMax(DEFAULT_PROGRESS_MAX)).toBe(100);
	});
});

describe('parseProgressValue', () => {
	it('bounds to max', () => {
		expect(parseProgressValue(5, 12)).toBe(5);
		expect(parseProgressValue(13, 12)).toBeNull();
		expect(parseProgressValue(-1, 100)).toBeNull();
	});
});
