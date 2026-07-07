import { describe, expect, it } from 'vitest';
import {
	applyOlPrefillFields,
	applyOlRefreshPatch,
	authorNamesFromPrefill,
	buildOlAuthorRows
} from '$lib/library/book-form-ol';
import type { OpenLibraryBookPrefill } from '$lib/library/open-library-prefill';
import type { PersonRow, SeriesRow } from '$lib/types/library';

const people: PersonRow[] = [
	{
		id: 'p1',
		first_name: 'Richard',
		middle_name: null,
		last_name: 'Bauckham',
		suffix: null,
		aliases: []
	}
];

const seriesRows: SeriesRow[] = [
	{ id: 's1', name: 'New International Commentary', abbreviation: 'NICNT' }
];

describe('buildOlAuthorRows', () => {
	it('matches exact person and skips fuzzy banner', () => {
		const rows = buildOlAuthorRows(['Richard Bauckham'], people);
		expect(rows).toHaveLength(1);
		expect(rows[0]!.person_id).toBe('p1');
		expect(rows[0]!.fuzzyCandidates).toBeUndefined();
	});

	it('seeds unresolved author with prefillName and auto-open only on first row', () => {
		const rows = buildOlAuthorRows(['Jane Doe', 'John Smith'], people);
		expect(rows).toHaveLength(2);
		expect(rows[0]!.prefillName).toBe('Jane Doe');
		expect(rows[0]!.olSeedAutoOpen).toBe(true);
		expect(rows[1]!.olSeedAutoOpen).toBe(false);
	});
});

describe('authorNamesFromPrefill', () => {
	it('prefers authors array over authorTyped', () => {
		const prefill = {
			authors: [{ name: 'A Author' }],
			authorTyped: 'B Author'
		} as OpenLibraryBookPrefill;
		expect(authorNamesFromPrefill(prefill)).toEqual(['A Author']);
	});
});

describe('applyOlPrefillFields', () => {
	it('maps publisher fields and matched series', () => {
		const prefill = {
			title: 'Acts',
			publisher: 'Eerdmans',
			publisher_id: 'pub-1',
			year: 2014,
			seriesName: 'NICNT',
			authors: [{ name: 'Richard Bauckham' }]
		} as OpenLibraryBookPrefill;

		const patch = applyOlPrefillFields({
			prefill,
			people,
			seriesRows,
			current: { genre: '', work_type: 'monograph', language: 'english' }
		});

		expect(patch.title).toBe('Acts');
		expect(patch.publisher).toBe('Eerdmans');
		expect(patch.publisher_id).toBe('pub-1');
		expect(patch.year).toBe('2014');
		expect(patch.series_id).toBe('s1');
		expect(patch.authorRows?.[0]?.person_id).toBe('p1');
		expect(patch.olSeriesHint).toBeNull();
	});

	it('sets olSeriesHint when series does not match', () => {
		const prefill = {
			seriesName: 'Unknown Series',
			seriesVolume: '2'
		} as OpenLibraryBookPrefill;

		const patch = applyOlPrefillFields({
			prefill,
			people,
			seriesRows,
			current: { genre: '', work_type: 'monograph', language: 'english' }
		});

		expect(patch.olSeriesHint).toEqual({ name: 'Unknown Series', volume: '2' });
		expect(patch.volume_number).toBe('2');
	});
});

describe('applyOlRefreshPatch', () => {
	it('applies only selected keys', () => {
		const data = {
			title: 'New title',
			publisher: 'New pub',
			year: 2020,
			isbn: '9780000000000'
		} as OpenLibraryBookPrefill;

		const patch = applyOlRefreshPatch(['publisher', 'year'], data);
		expect(patch.title).toBeUndefined();
		expect(patch.publisher).toBe('New pub');
		expect(patch.year).toBe('2020');
		expect(patch.isbn).toBeUndefined();
	});
});
