import { describe, expect, it } from 'vitest';
import { parseEssayForm } from '../essay-actions';
import { essayRowToCitationInput } from '$lib/library/turabian/article';
import type { EssayRow } from '$lib/types/library';

const PARENT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const ESSAY_ID = '11111111-2222-3333-4444-555555555555';
const PERSON_ID = '99999999-8888-7777-6666-555555555555';

function fd(entries: Record<string, string>): FormData {
	const form = new FormData();
	for (const [k, v] of Object.entries(entries)) {
		form.set(k, v);
	}
	return form;
}

describe('parseEssayForm', () => {
	it('requires parent book and title', () => {
		const missingParent = parseEssayForm(fd({ essay_title: 'Canon' }));
		expect(missingParent.ok).toBe(false);
		if (!missingParent.ok) expect(missingParent.message).toMatch(/Parent book/);

		const missingTitle = parseEssayForm(
			fd({ parent_book_id: PARENT_ID, essay_title: '' })
		);
		expect(missingTitle.ok).toBe(false);
		if (!missingTitle.ok) expect(missingTitle.message).toMatch(/title/);
	});

	it('parses optional pages and authors', () => {
		const parsed = parseEssayForm(
			fd({
				parent_book_id: PARENT_ID,
				essay_title: 'Canon',
				page_start: '835',
				page_end: '840',
				authors_json: JSON.stringify([{ person_id: PERSON_ID, sort_order: 0 }])
			})
		);
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.payload.page_start).toBe(835);
			expect(parsed.payload.page_end).toBe(840);
			expect(parsed.payload.authors).toEqual([{ person_id: PERSON_ID, sort_order: 0 }]);
		}
	});

	it('rejects page_end before page_start', () => {
		const parsed = parseEssayForm(
			fd({
				parent_book_id: PARENT_ID,
				essay_title: 'Canon',
				page_start: '100',
				page_end: '50'
			})
		);
		expect(parsed.ok).toBe(false);
	});

	it('requires essay id on update parse', () => {
		const parsed = parseEssayForm(
			fd({
				parent_book_id: PARENT_ID,
				essay_title: 'Canon'
			}),
			{ essayId: 'not-a-uuid' }
		);
		expect(parsed.ok).toBe(false);
	});

	it('includes essay id when updating', () => {
		const parsed = parseEssayForm(
			fd({
				parent_book_id: PARENT_ID,
				essay_title: 'Canon'
			}),
			{ essayId: ESSAY_ID }
		);
		expect(parsed.ok).toBe(true);
		if (parsed.ok) expect(parsed.essayId).toBe(ESSAY_ID);
	});
});

describe('essayRowToCitationInput', () => {
	it('maps hydrated row for signed article fixture row 17', () => {
		const row: EssayRow = {
			id: ESSAY_ID,
			essay_title: 'Canon',
			page_start: 835,
			page_end: null,
			created_at: '2026-01-01T00:00:00Z',
			authors: [
				{
					person_id: 'a1',
					person_label: 'James A. Sanders',
					first_name: 'James',
					middle_name: 'A.',
					last_name: 'Sanders',
					suffix: null,
					role: 'author',
					sort_order: 0
				}
			]
		};
		const input = essayRowToCitationInput(row);
		expect(input.essay_title).toBe('Canon');
		expect(input.page_start).toBe(835);
		expect(input.authors).toHaveLength(1);
		expect(input.authors?.[0].person_label).toBe('James A. Sanders');
	});

	it('omits authors for unsigned dictionary entries', () => {
		const row: EssayRow = {
			id: ESSAY_ID,
			essay_title: 'ἀγάπη',
			page_start: 12,
			page_end: null,
			created_at: '2026-01-01T00:00:00Z',
			authors: []
		};
		const input = essayRowToCitationInput(row);
		expect(input.authors).toBeUndefined();
	});
});
