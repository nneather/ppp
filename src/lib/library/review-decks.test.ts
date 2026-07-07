import { describe, expect, it } from 'vitest';
import {
	hasReviewDeckParams,
	isReviewDeckActive,
	REVIEW_DECKS,
	reviewDeckSearchParams,
	sliceForReviewFilters
} from './review-decks';
import { parseReviewFilters } from './review';

function urlWith(search: string): URL {
	return new URL(`https://example.test/library/review${search}`);
}

function deck(key: string) {
	const found = REVIEW_DECKS.find((d) => d.key === key);
	if (!found) throw new Error(`no deck ${key}`);
	return found;
}

describe('hasReviewDeckParams', () => {
	it('is false for a bare URL and plain list filters', () => {
		expect(hasReviewDeckParams(urlWith(''))).toBe(false);
		expect(hasReviewDeckParams(urlWith('?genre=Commentary&shuffle=1'))).toBe(false);
	});

	it('is true for every deck-routing param', () => {
		for (const search of [
			'?slice=critical',
			'?subject=blank',
			'?match_type=no-match',
			'?missing=genre',
			'?proposal=pending',
			'?isbn=blank',
			'?shelf=only'
		]) {
			expect(hasReviewDeckParams(urlWith(search)), search).toBe(true);
		}
	});
});

describe('sliceForReviewFilters', () => {
	const beforeSept = new Date(2026, 6, 7);
	const afterSept = new Date(2026, 8, 2);

	it('explicit slice wins', () => {
		expect(sliceForReviewFilters({ slice: 'critical' }, afterSept)).toBe('critical');
		expect(sliceForReviewFilters({ slice: 'backlog' }, beforeSept)).toBe('backlog');
	});

	it('fast-lane and provenance decks credit backlog', () => {
		expect(sliceForReviewFilters({ missing: 'genre' }, beforeSept)).toBe('backlog');
		expect(sliceForReviewFilters({ proposal: 'pending' }, beforeSept)).toBe('backlog');
		expect(sliceForReviewFilters({ isbn_blank: true }, beforeSept)).toBe('backlog');
		expect(sliceForReviewFilters({ shelf: 'only' }, beforeSept)).toBe('backlog');
		expect(
			sliceForReviewFilters({ import_match_type: ['no-match'] }, beforeSept)
		).toBe('backlog');
	});

	it('falls back to the date-gated default', () => {
		expect(sliceForReviewFilters({}, beforeSept)).toBe('critical');
		expect(sliceForReviewFilters({}, afterSept)).toBe('backlog');
	});
});

describe('isReviewDeckActive', () => {
	it('matches each deck against its own routed URL', () => {
		for (const d of REVIEW_DECKS) {
			const params = reviewDeckSearchParams(d, new URLSearchParams());
			const filters = parseReviewFilters(urlWith(`?${params.toString()}`));
			expect(isReviewDeckActive(d, filters), d.key).toBe(true);
			for (const other of REVIEW_DECKS) {
				if (other.key === d.key) continue;
				expect(isReviewDeckActive(other, filters), `${other.key} vs ${d.key} URL`).toBe(false);
			}
		}
	});

	it('ignores the server-injected shelf=exclude default', () => {
		expect(isReviewDeckActive(deck('critical'), { slice: 'critical', shelf: 'exclude' })).toBe(
			true
		);
		expect(isReviewDeckActive(deck('backlog'), { slice: 'backlog', shelf: 'exclude' })).toBe(true);
	});

	it('marks the critical deck active for the dashboard deep link', () => {
		const filters = parseReviewFilters(urlWith('?slice=critical'));
		expect(isReviewDeckActive(deck('critical'), filters)).toBe(true);
	});
});

describe('reviewDeckSearchParams', () => {
	it('drops other deck params but keeps list filters + shuffle', () => {
		const current = new URLSearchParams('slice=critical&genre=Commentary&shuffle=1');
		const params = reviewDeckSearchParams(deck('genre_sprint'), current);
		expect(params.get('slice')).toBeNull();
		expect(params.get('missing')).toBe('genre');
		expect(params.get('genre')).toBe('Commentary');
		expect(params.get('shuffle')).toBe('1');
	});

	it('routes the shelf deck on shelf=only', () => {
		const params = reviewDeckSearchParams(deck('shelf'), new URLSearchParams());
		expect(params.get('shelf')).toBe('only');
		expect(params.get('slice')).toBeNull();
	});

	it('routes the puzzle deck on match_type + isbn', () => {
		const params = reviewDeckSearchParams(deck('puzzle'), new URLSearchParams());
		expect(params.getAll('match_type')).toEqual(['no-match']);
		expect(params.get('isbn')).toBe('blank');
	});
});
