import { describe, expect, it } from 'vitest';
import { bibleBookSuggestions, resolveBibleBookName } from '../bible-book';

describe('resolveBibleBookName', () => {
	it('matches canon names case-insensitively', () => {
		expect(resolveBibleBookName('matthew')).toBe('Matthew');
		expect(resolveBibleBookName('1 Corinthians')).toBe('1 Corinthians');
	});

	it('resolves common aliases', () => {
		expect(resolveBibleBookName('Ps')).toBe('Psalms');
		expect(resolveBibleBookName('mt')).toBe('Matthew');
		expect(resolveBibleBookName('Rev')).toBe('Revelation');
	});

	it('resolves unique prefixes', () => {
		expect(resolveBibleBookName('Roma')).toBe('Romans');
	});

	it('returns null for unknown / ambiguous', () => {
		expect(resolveBibleBookName('')).toBeNull();
		expect(resolveBibleBookName('xyzzy')).toBeNull();
	});

	it('suggests substring matches', () => {
		expect(bibleBookSuggestions('john')).toContain('John');
		expect(bibleBookSuggestions('john')).toContain('1 John');
	});
});
