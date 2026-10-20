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

	it('resolves Apocrypha names and aliases only with the flag', () => {
		expect(resolveBibleBookName('sirach')).toBeNull();
		expect(resolveBibleBookName('ecclesiasticus')).toBeNull();
		expect(resolveBibleBookName('4 ezra')).toBeNull();
		expect(resolveBibleBookName('sirach', { includeApocrypha: true })).toBe('Sirach');
		expect(resolveBibleBookName('ecclesiasticus', { includeApocrypha: true })).toBe('Sirach');
		expect(resolveBibleBookName('sir', { includeApocrypha: true })).toBe('Sirach');
		expect(resolveBibleBookName('4 ezra', { includeApocrypha: true })).toBe('2 Esdras');
		expect(resolveBibleBookName('wis', { includeApocrypha: true })).toBe('Wisdom of Solomon');
	});

	it('suggests substring matches', () => {
		expect(bibleBookSuggestions('john')).toContain('John');
		expect(bibleBookSuggestions('john')).toContain('1 John');
	});
});
