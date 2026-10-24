import { describe, expect, it } from 'vitest';
import {
	commentaryCoverageOwned,
	ownedCommentaryBook,
	ownedCommentaryEssay
} from '$lib/sermons/commentary-owned';

describe('commentaryCoverageOwned', () => {
	it('includes an owned book and omits a not-owned book', () => {
		expect(
			commentaryCoverageOwned({ kind: 'book', bookOwned: true, parentOwned: null })
		).toBe(true);
		expect(
			commentaryCoverageOwned({ kind: 'book', bookOwned: false, parentOwned: null })
		).toBe(false);
	});

	it('a book uses its own flag when the parent flag disagrees', () => {
		expect(
			commentaryCoverageOwned({ kind: 'book', bookOwned: true, parentOwned: false })
		).toBe(true);
		expect(
			commentaryCoverageOwned({ kind: 'book', bookOwned: false, parentOwned: true })
		).toBe(false);
	});

	it('an essay follows the parent book', () => {
		expect(
			commentaryCoverageOwned({ kind: 'essay', bookOwned: true, parentOwned: false })
		).toBe(false);
		expect(
			commentaryCoverageOwned({ kind: 'essay', bookOwned: false, parentOwned: true })
		).toBe(true);
		expect(
			commentaryCoverageOwned({ kind: 'essay', bookOwned: false, parentOwned: null })
		).toBe(false);
	});
});

describe('owned commentary wrappers', () => {
	it('a missing volume is not on the list', () => {
		expect(ownedCommentaryBook(null)).toBe(false);
		expect(ownedCommentaryEssay(undefined)).toBe(false);
	});

	it('an essay wrapper ignores a true book flag and reads the parent', () => {
		expect(ownedCommentaryBook({ owned: true })).toBe(true);
		expect(ownedCommentaryBook({ owned: false })).toBe(false);
		expect(ownedCommentaryEssay({ owned: false })).toBe(false);
		expect(ownedCommentaryEssay({ owned: true })).toBe(true);
	});
});
