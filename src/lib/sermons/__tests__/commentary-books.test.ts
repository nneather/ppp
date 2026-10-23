import { describe, expect, it } from 'vitest';
import {
	loadCommentaryBooks,
	parseCommentaryBooks,
	saveCommentaryBooks,
	uniqueBibleBooks
} from '../commentary-books';

describe('uniqueBibleBooks', () => {
	it('keeps canon names in first-seen order and drops the rest', () => {
		expect(uniqueBibleBooks(['Romans', 'Romans', 'Not a book', '  John  ', 'Genesis'])).toEqual([
			'Romans',
			'John',
			'Genesis'
		]);
	});
});

describe('commentary book storage', () => {
	it('round-trips added Bible books for one sermon', () => {
		const mem = new Map<string, string>();
		const storage = {
			getItem: (key: string) => mem.get(key) ?? null,
			setItem: (key: string, value: string) => {
				mem.set(key, value);
			}
		};
		saveCommentaryBooks('sermon-1', ['Romans', 'Nope', 'Romans', 'Ephesians'], storage);
		expect(loadCommentaryBooks('sermon-1', storage)).toEqual(['Romans', 'Ephesians']);
		expect(loadCommentaryBooks('sermon-2', storage)).toEqual([]);
		expect(parseCommentaryBooks('not-json')).toEqual([]);
	});
});
