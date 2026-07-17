import { describe, expect, it } from 'vitest';
import {
	LIBRARY_FILTER_TOP_GENRES,
	overflowFilterGenres,
	primaryFilterGenres
} from '../list-filter-genres';
import { GENRES } from '$lib/types/library';

describe('list-filter-genres', () => {
	it('primary row is the curated top list when nothing is active', () => {
		expect(primaryFilterGenres(undefined)).toEqual([...LIBRARY_FILTER_TOP_GENRES]);
	});

	it('appends active genres that are outside the top list', () => {
		const primary = primaryFilterGenres(['Sports', 'Commentary']);
		expect(primary[0]).toBe('Commentary');
		expect(primary).toContain('Sports');
		expect(primary.filter((g) => g === 'Commentary')).toHaveLength(1);
	});

	it('overflow covers every genre not in the primary row', () => {
		const primary = primaryFilterGenres(['Sports']);
		const overflow = overflowFilterGenres(primary);
		expect(overflow).not.toContain('Sports');
		expect(overflow).not.toContain('Commentary');
		expect(new Set([...primary, ...overflow]).size).toBe(GENRES.length);
	});
});
