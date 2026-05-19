import { describe, expect, it } from 'vitest';
import { authorsLabelForBook } from '$lib/library/authors-label';
import type { PersonRow } from '$lib/types/library';

function person(id: string, last: string, first?: string): PersonRow {
	return {
		id,
		first_name: first ?? null,
		middle_name: null,
		last_name: last,
		suffix: null,
		aliases: []
	};
}

function peopleMap(...rows: PersonRow[]): Map<string, PersonRow> {
	return new Map(rows.map((p) => [p.id, p]));
}

describe('authorsLabelForBook', () => {
	it('returns null when junction is empty', () => {
		expect(authorsLabelForBook([], peopleMap())).toBeNull();
	});

	it('shows authors only when author role is present', () => {
		const map = peopleMap(person('p1', 'Lewis', 'C. S.'));
		const label = authorsLabelForBook(
			[{ person_id: 'p1', sort_order: 0, role: 'author' }],
			map
		);
		expect(label).toBe('C. S. Lewis');
	});

	it('shows single editor with (ed) on editor-only monograph', () => {
		const map = peopleMap(person('p1', 'Hooper', 'Walter'));
		const label = authorsLabelForBook(
			[{ person_id: 'p1', sort_order: 0, role: 'editor' }],
			map
		);
		expect(label).toBe('Walter Hooper (ed)');
	});

	it('shows multiple editors with (eds) on editor-only edited volume', () => {
		const map = peopleMap(
			person('p1', 'Barker', 'William S.'),
			person('p2', 'Long', 'Samuel T.')
		);
		const label = authorsLabelForBook(
			[
				{ person_id: 'p1', sort_order: 0, role: 'editor' },
				{ person_id: 'p2', sort_order: 1, role: 'editor' }
			],
			map
		);
		expect(label).toBe('William S. Barker, Samuel T. Long (eds)');
	});

	it('prefers authors over editors when both exist', () => {
		const map = peopleMap(person('p1', 'Lewis', 'C. S.'), person('p2', 'Hooper', 'Walter'));
		const label = authorsLabelForBook(
			[
				{ person_id: 'p1', sort_order: 0, role: 'author' },
				{ person_id: 'p2', sort_order: 1, role: 'editor' }
			],
			map
		);
		expect(label).toBe('C. S. Lewis');
	});
});
