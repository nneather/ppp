import { describe, expect, it } from 'vitest';
import {
	compareSiblingBooks,
	primaryAuthorPersonIds,
	siblingBookLabel
} from '../book-detail-related';

describe('primaryAuthorPersonIds', () => {
	it('prefers authors over editors and translators', () => {
		expect(
			primaryAuthorPersonIds([
				{ person_id: 't1', role: 'translator', sort_order: 0 },
				{ person_id: 'a1', role: 'author', sort_order: 1 },
				{ person_id: 'e1', role: 'editor', sort_order: 0 }
			])
		).toEqual(['a1']);
	});

	it('falls back to editors when no authors', () => {
		expect(
			primaryAuthorPersonIds([
				{ person_id: 'e2', role: 'editor', sort_order: 1 },
				{ person_id: 'e1', role: 'editor', sort_order: 0 },
				{ person_id: 't1', role: 'translator', sort_order: 0 }
			])
		).toEqual(['e1', 'e2']);
	});

	it('returns empty when only translators', () => {
		expect(
			primaryAuthorPersonIds([{ person_id: 't1', role: 'translator', sort_order: 0 }])
		).toEqual([]);
	});
});

describe('siblingBookLabel', () => {
	it('prefixes volume when present', () => {
		expect(siblingBookLabel({ title: 'Institutes', volume_number: '2' })).toBe(
			'Vol. 2 — Institutes'
		);
	});

	it('falls back to title', () => {
		expect(siblingBookLabel({ title: 'Institutes', volume_number: null })).toBe('Institutes');
	});
});

describe('compareSiblingBooks', () => {
	it('orders by numeric volume then title', () => {
		const rows = [
			{ title: 'B', volume_number: '2' },
			{ title: 'A', volume_number: '10' },
			{ title: 'C', volume_number: '1' },
			{ title: 'Z', volume_number: null }
		];
		rows.sort(compareSiblingBooks);
		expect(rows.map((r) => r.volume_number ?? r.title)).toEqual(['1', '2', '10', 'Z']);
	});
});
