import { describe, expect, it } from 'vitest';
import {
	computeMissingImportant,
	parseAuthorsJsonString
} from '$lib/library/server/book-actions';

describe('parseAuthorsJsonString', () => {
	it('accepts person_id entries', () => {
		const raw = JSON.stringify([
			{ person_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', role: 'author', sort_order: 0 }
		]);
		expect(parseAuthorsJsonString(raw)).toEqual([
			{
				person_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
				role: 'author',
				sort_order: 0
			}
		]);
	});

	it('accepts name entries for OL auto-create', () => {
		const raw = JSON.stringify([{ name: 'Joel B. Green', role: 'editor', sort_order: 1 }]);
		expect(parseAuthorsJsonString(raw)).toEqual([
			{ name: 'Joel B. Green', role: 'editor', sort_order: 1 }
		]);
	});

	it('rejects entries with both person_id and name', () => {
		const raw = JSON.stringify([
			{ person_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', name: 'X', role: 'author', sort_order: 0 }
		]);
		expect(parseAuthorsJsonString(raw)).toBeNull();
	});
});

describe('computeMissingImportant with AuthorFormEntry', () => {
	it('treats unresolved name as present author', () => {
		const missing = computeMissingImportant({
			title: 'Test',
			genre: 'Theology',
			work_type: 'monograph',
			year: 2020,
			publisher: 'IVP',
			authors: [{ name: 'Scot McKnight', role: 'author', sort_order: 0 }]
		});
		expect(missing).not.toContain('author');
	});
});
