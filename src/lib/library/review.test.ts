import { describe, expect, it } from 'vitest';
import { parseReviewFilters, withReviewShelfDefault, SHELF_CHECK_MARKER } from './review';

function urlWith(search: string): URL {
	return new URL(`https://example.test/library/review${search}`);
}

describe('parseReviewFilters — deck params', () => {
	it('parses missing=genre', () => {
		expect(parseReviewFilters(urlWith('?missing=genre')).missing).toBe('genre');
		expect(parseReviewFilters(urlWith('?missing=publisher')).missing).toBeUndefined();
	});

	it('parses shelf=only|exclude|all and rejects junk', () => {
		expect(parseReviewFilters(urlWith('?shelf=only')).shelf).toBe('only');
		expect(parseReviewFilters(urlWith('?shelf=exclude')).shelf).toBe('exclude');
		expect(parseReviewFilters(urlWith('?shelf=all')).shelf).toBe('all');
		expect(parseReviewFilters(urlWith('?shelf=sometimes')).shelf).toBeUndefined();
	});

	it('parses proposal=pending', () => {
		expect(parseReviewFilters(urlWith('?proposal=pending')).proposal).toBe('pending');
		expect(parseReviewFilters(urlWith('?proposal=accepted')).proposal).toBeUndefined();
	});

	it('parses isbn=blank', () => {
		expect(parseReviewFilters(urlWith('?isbn=blank')).isbn_blank).toBe(true);
		expect(parseReviewFilters(urlWith('?isbn=123')).isbn_blank).toBeUndefined();
	});

	it('parses shuffle=1', () => {
		expect(parseReviewFilters(urlWith('?shuffle=1')).shuffle).toBe(true);
		expect(parseReviewFilters(urlWith('?shuffle=0')).shuffle).toBeUndefined();
	});

	it('still parses the pre-deck params alongside', () => {
		const f = parseReviewFilters(urlWith('?slice=critical&missing=genre&shuffle=1'));
		expect(f.slice).toBe('critical');
		expect(f.missing).toBe('genre');
		expect(f.shuffle).toBe(true);
	});
});

describe('withReviewShelfDefault', () => {
	it('defaults shelf to exclude when unset', () => {
		expect(withReviewShelfDefault({}).shelf).toBe('exclude');
		expect(withReviewShelfDefault({ slice: 'critical' }).shelf).toBe('exclude');
	});

	it('respects an explicit shelf value (only / all)', () => {
		expect(withReviewShelfDefault({ shelf: 'only' }).shelf).toBe('only');
		expect(withReviewShelfDefault({ shelf: 'all' }).shelf).toBe('all');
	});

	it('does not mutate the input', () => {
		const input = { slice: 'backlog' as const };
		void withReviewShelfDefault(input);
		expect('shelf' in input).toBe(false);
	});
});

describe('SHELF_CHECK_MARKER', () => {
	it('matches the real prod note wordings (case-insensitive ILIKE in the loader)', () => {
		const notes = [
			'Deferred shelf-check: which edition?',
			'Williard’s 1851 trans. reprint; verify exact ISBN at shelf.',
			'Already Commentary. Shelf-check pending per migration notes.',
			'Verify binding/format at shelf to pin one ISBN.'
		];
		for (const note of notes) {
			expect(note.toLowerCase()).toContain(SHELF_CHECK_MARKER.toLowerCase());
		}
	});
});
