import { describe, expect, it } from 'vitest';
import { APOCRYPHA_BOOK_NAMES } from '../../../src/lib/library/bible-book-names.ts';
import { APOCRYPHA_BOOKS } from '../turretin-apocrypha.ts';

describe('Turretin apocrypha names', () => {
	it('is a subset of the NRSV 18', () => {
		const vocab = new Set<string>(APOCRYPHA_BOOK_NAMES);
		expect(APOCRYPHA_BOOK_NAMES).toHaveLength(18);
		for (const name of APOCRYPHA_BOOKS) {
			expect(vocab.has(name)).toBe(true);
		}
	});
});
