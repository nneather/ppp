import { describe, expect, it } from 'vitest';
import { hidesAsHighConfidence } from '../scripture-draft-row';

describe('hidesAsHighConfidence', () => {
	it('hides a displayed 90% and keeps anything lower', () => {
		expect(hidesAsHighConfidence(0.9)).toBe(true);
		expect(hidesAsHighConfidence(0.95)).toBe(true);
		expect(hidesAsHighConfidence(0.88)).toBe(false);
		expect(hidesAsHighConfidence(0.75)).toBe(false);
		expect(hidesAsHighConfidence(null)).toBe(false);
	});
});
