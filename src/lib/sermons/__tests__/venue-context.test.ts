import { describe, expect, it } from 'vitest';
import { contextTypeForVenue, parseContextType } from '../venue-context';
import type { ContextType } from '$lib/types/sermons';

describe('parseContextType', () => {
	it('accepts the closed C/P/A enum', () => {
		expect(parseContextType('church')).toBe('church');
		expect(parseContextType('parachurch')).toBe('parachurch');
		expect(parseContextType('academic')).toBe('academic');
	});

	it('rejects empty and unknown values', () => {
		expect(parseContextType(null)).toBeNull();
		expect(parseContextType(undefined)).toBeNull();
		expect(parseContextType('')).toBeNull();
		expect(parseContextType('synagogue')).toBeNull();
	});
});

describe('contextTypeForVenue', () => {
	const venues: { id: string; context_type: ContextType | null }[] = [
		{ id: 'church-id', context_type: 'church' },
		{ id: 'untyped-id', context_type: null }
	];

	it('returns the venue type so the sermon form can auto-fill', () => {
		expect(contextTypeForVenue(venues, 'church-id')).toBe('church');
	});

	it('returns null when the venue is untyped, missing, or cleared', () => {
		expect(contextTypeForVenue(venues, 'untyped-id')).toBeNull();
		expect(contextTypeForVenue(venues, 'missing')).toBeNull();
		expect(contextTypeForVenue(venues, '')).toBeNull();
		expect(contextTypeForVenue(venues, null)).toBeNull();
	});
});
