import { describe, expect, it } from 'vitest';
import { filterProposalForBook, hasVisibleProposalFields } from '../proposal-filter';
import type { ReviewProposal } from '$lib/types/library';

describe('filterProposalForBook', () => {
	const baseProposal: ReviewProposal = {
		id: 'p1',
		source: 'openlibrary',
		fields: {
			publisher_location: {
				current: null,
				proposed: 'Grand Rapids, Michigan, USA',
				source: 'openlibrary'
			},
			genre: { current: null, proposed: 'Theology', source: 'ai-genre' }
		}
	};

	it('drops fields already filled on the book', () => {
		const filtered = filterProposalForBook(baseProposal, {
			genre: 'Commentary',
			year: null,
			publisher: 'Eerdmans',
			publisher_id: null,
			publisher_location: null,
			publisher_effective_location: 'Grand Rapids, MI'
		});
		expect(filtered.fields.genre).toBeUndefined();
		expect(filtered.fields.publisher_location).toBeUndefined();
	});

	it('normalizes surviving location proposals', () => {
		const filtered = filterProposalForBook(baseProposal, {
			genre: null,
			year: null,
			publisher: 'Baker',
			publisher_id: null,
			publisher_location: null,
			publisher_effective_location: null
		});
		expect(filtered.fields.publisher_location?.proposed).toBe('Grand Rapids, MI');
	});

	it('hasVisibleProposalFields is false when all diffs drop', () => {
		const filtered = filterProposalForBook(baseProposal, {
			genre: 'Theology',
			year: 2000,
			publisher: 'Baker',
			publisher_id: 'pub-id',
			publisher_location: 'Grand Rapids, MI',
			publisher_effective_location: 'Grand Rapids, MI'
		});
		expect(hasVisibleProposalFields(filtered)).toBe(false);
	});
});
