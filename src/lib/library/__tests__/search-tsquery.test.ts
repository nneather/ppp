import { describe, expect, it } from 'vitest';
import { toLibrarySearchTsQuery } from '../search-tsquery';

describe('toLibrarySearchTsQuery', () => {
	it('returns null for blank / punctuation-only input', () => {
		expect(toLibrarySearchTsQuery('')).toBeNull();
		expect(toLibrarySearchTsQuery('   ')).toBeNull();
		expect(toLibrarySearchTsQuery('&&&')).toBeNull();
	});

	it('prefix-matches a partial last name', () => {
		expect(toLibrarySearchTsQuery('piot')).toBe("'piot':*");
		expect(toLibrarySearchTsQuery('Piot')).toBe("'piot':*");
	});

	it('ANDs multiple tokens so title + author narrowing works', () => {
		expect(toLibrarySearchTsQuery('return exile')).toBe("'return':* & 'exile':*");
	});

	it('splits apostrophes and hyphens to match simple tokenizer', () => {
		expect(toLibrarySearchTsQuery("o'brien")).toBe("'o':* & 'brien':*");
		expect(toLibrarySearchTsQuery('Jean-Paul')).toBe("'jean':* & 'paul':*");
	});

	it('keeps latin letters with diacritics', () => {
		expect(toLibrarySearchTsQuery('Müller')).toBe("'müller':*");
	});

	it('strips tsquery operators from raw input', () => {
		expect(toLibrarySearchTsQuery('piot:* & foo!')).toBe("'piot':* & 'foo':*");
	});
});
