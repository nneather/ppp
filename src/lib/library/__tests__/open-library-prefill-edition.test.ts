import { describe, expect, it } from 'vitest';
import {
	editionLineFromEdition,
	isLikelyOlBindingEditionJunk
} from '$lib/library/open-library-prefill';

describe('editionLineFromEdition', () => {
	it('returns null for Paperback + numeric revision (old OL bug)', () => {
		expect(
			editionLineFromEdition({
				edition_name: null,
				physical_format: 'Paperback',
				revision: 9
			})
		).toBeNull();
		expect(
			editionLineFromEdition({
				physical_format: 'Paperback',
				revision: '9'
			})
		).toBeNull();
	});

	it('keeps real edition_name strings', () => {
		expect(editionLineFromEdition({ edition_name: '2nd ed.' })).toBe('2nd ed.');
		expect(editionLineFromEdition({ edition_name: 'Revised edition' })).toBe('Revised edition');
		expect(editionLineFromEdition({ edition_name: '3rd Edition' })).toBe('3rd Edition');
		expect(editionLineFromEdition({ edition_name: 'First American edition' })).toBe(
			'First American edition'
		);
		expect(editionLineFromEdition({ edition_name: 'Expanded ed.' })).toBe('Expanded ed.');
	});

	it('ignores physical_format and revision even when edition_name is present', () => {
		expect(
			editionLineFromEdition({
				edition_name: '2nd ed.',
				physical_format: 'Paperback',
				revision: 9
			})
		).toBe('2nd ed.');
	});

	it('rejects binding-only edition_name and bare revision-like values', () => {
		expect(editionLineFromEdition({ edition_name: 'Paperback' })).toBeNull();
		expect(editionLineFromEdition({ edition_name: 'Hardcover' })).toBeNull();
		expect(editionLineFromEdition({ edition_name: '9' })).toBeNull();
		expect(editionLineFromEdition({ edition_name: 'Trade paperback' })).toBeNull();
	});

	it('returns null when edition_name is missing', () => {
		expect(editionLineFromEdition({})).toBeNull();
		expect(editionLineFromEdition({ edition_name: '   ' })).toBeNull();
	});
});

describe('isLikelyOlBindingEditionJunk', () => {
	it('flags binding + revision join leftovers', () => {
		expect(isLikelyOlBindingEditionJunk('Paperback — 9')).toBe(true);
		expect(isLikelyOlBindingEditionJunk('Hardcover - 12')).toBe(true);
		expect(isLikelyOlBindingEditionJunk('Paperback')).toBe(true);
		expect(isLikelyOlBindingEditionJunk('2nd ed.')).toBe(false);
		expect(isLikelyOlBindingEditionJunk('Revised edition')).toBe(false);
	});
});
