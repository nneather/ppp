import { describe, expect, it } from 'vitest';
import { commentaryDismissKey } from '$lib/sermons/commentary-dismiss';
import { parseShelfRating, parseShelfUuidList } from '$lib/sermons/server/commentary-shelf-actions';

describe('commentaryDismissKey', () => {
	it('sorts member ids so collapse order does not change the key', () => {
		const a = commentaryDismissKey({
			kind: 'book',
			bookId: 'b',
			essayId: null,
			memberBookIds: ['b', 'a'],
			memberEssayIds: []
		});
		const b = commentaryDismissKey({
			kind: 'book',
			bookId: 'a',
			essayId: null,
			memberBookIds: ['a', 'b'],
			memberEssayIds: []
		});
		expect(a).toBe('book:a,b');
		expect(a).toBe(b);
	});

	it('keys an essay on its essay ids', () => {
		expect(
			commentaryDismissKey({
				kind: 'essay',
				bookId: 'parent',
				essayId: 'e1',
				memberBookIds: ['parent'],
				memberEssayIds: ['e2', 'e1']
			})
		).toBe('essay:e1,e2');
	});
});

describe('commentary shelf form parse', () => {
	it('accepts a 1–5 rating and an empty clear', () => {
		expect(parseShelfRating('4')).toBe(4);
		expect(parseShelfRating('')).toBeNull();
		expect(parseShelfRating('6')).toBe('invalid');
	});

	it('rejects a bad id list', () => {
		expect(parseShelfUuidList(['not-a-uuid'])).toBeNull();
		expect(parseShelfUuidList([])).toBeNull();
		expect(parseShelfUuidList(['b2e892d9-782a-4657-8b5c-2d3289830997'])).toEqual([
			'b2e892d9-782a-4657-8b5c-2d3289830997'
		]);
	});
});
