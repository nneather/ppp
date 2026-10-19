import { describe, expect, it } from 'vitest';
import { parsePassageSectionForm } from '../passage-section-actions';

function fd(entries: Record<string, string>): FormData {
	const form = new FormData();
	for (const [k, v] of Object.entries(entries)) form.set(k, v);
	return form;
}

const BOOK = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('parsePassageSectionForm', () => {
	it('requires book, bible book, and page_start', () => {
		expect(parsePassageSectionForm(fd({})).ok).toBe(false);
		expect(
			parsePassageSectionForm(
				fd({ book_id: BOOK, bible_book: 'Matthew', page_start: '45' })
			)
		).toEqual({
			ok: true,
			payload: {
				book_id: BOOK,
				label: null,
				bible_book: 'Matthew',
				chapter_start: null,
				verse_start: null,
				chapter_end: null,
				verse_end: null,
				page_start: '45',
				page_end: null
			}
		});
	});

	it('parses a chapter range with label and pages', () => {
		const parsed = parsePassageSectionForm(
			fd({
				book_id: BOOK,
				label: 'Sermon on the Mount',
				bible_book: 'Matthew',
				chapter_start: '5',
				chapter_end: '7',
				page_start: '103',
				page_end: '186'
			})
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.payload).toMatchObject({
			label: 'Sermon on the Mount',
			chapter_start: 5,
			chapter_end: 7,
			page_start: '103',
			page_end: '186'
		});
	});
});
