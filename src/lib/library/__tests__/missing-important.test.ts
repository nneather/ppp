import { describe, expect, it } from 'vitest';
import {
	computeMissingImportant,
	incompleteCitationCaption
} from '$lib/library/missing-important';

describe('computeMissingImportant', () => {
	it('flags missing monograph author and publisher', () => {
		expect(
			computeMissingImportant({
				title: 'A Book',
				genre: 'Theology',
				work_type: 'monograph',
				year: 2020,
				publisher: null,
				authors: []
			})
		).toEqual(['author', 'publisher']);
	});

	it('uses editor for edited volumes', () => {
		expect(
			computeMissingImportant({
				title: 'Essays',
				genre: 'Theology',
				work_type: 'edited_volume',
				year: 2020,
				publisher: 'IVP',
				authors: [{ role: 'author', person_label: 'Someone' }]
			})
		).toEqual(['editor']);
	});
});

describe('incompleteCitationCaption', () => {
	it('lists missing fields', () => {
		expect(incompleteCitationCaption(['year', 'publisher'], false)).toBe(
			'Citation may be incomplete — missing: year, publisher.'
		);
	});

	it('falls back to needs_review flag', () => {
		expect(incompleteCitationCaption([], true)).toBe(
			'Citation may be incomplete — flagged for review.'
		);
	});
});
