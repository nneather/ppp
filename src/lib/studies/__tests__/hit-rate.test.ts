import { describe, expect, it } from 'vitest';
import {
	computeHitRates,
	formatHitRate,
	paperStudyDate,
	type HitRateBook,
	type HitRateStudy
} from '../hit-rate';

const commentary: HitRateBook = {
	bookId: 'rom',
	acquiredOn: '2026-01-15',
	bibleBooks: ['Romans']
};

function study(partial: Partial<HitRateStudy> & Pick<HitRateStudy, 'id'>): HitRateStudy {
	return {
		topical: false,
		on: '2026-03-01',
		primaryBooks: ['Romans'],
		usedBookIds: [],
		...partial
	};
}

describe('paperStudyDate', () => {
	it('prefers a due date', () => {
		expect(paperStudyDate('2026-04-02', '2026-01-01T12:00:00Z')).toBe('2026-04-02');
	});

	it('falls back to the created civil date', () => {
		expect(paperStudyDate(null, '2026-01-01T12:00:00Z')).toBe('2026-01-01');
	});
});

describe('computeHitRates', () => {
	it('counts consulted and cited uses over expository primary passages since acquisition', () => {
		const rates = computeHitRates(
			[
				study({ id: 'a', usedBookIds: ['rom'] }),
				study({ id: 'b', on: '2026-02-01', usedBookIds: ['rom'] }),
				study({ id: 'c', on: '2026-02-02' })
			],
			[commentary]
		);
		expect(rates).toEqual([{ bookId: 'rom', bibleBook: 'Romans', used: 2, opportunities: 3 }]);
		expect(formatHitRate(rates[0]!)).toBe('2/3');
	});

	it('includes a study dated on the acquisition day', () => {
		const rates = computeHitRates([study({ id: 'a', on: '2026-01-15', usedBookIds: ['rom'] })], [
			commentary
		]);
		expect(rates[0]).toMatchObject({ used: 1, opportunities: 1 });
	});

	it('drops topical studies, other books, and dates before acquisition', () => {
		const rates = computeHitRates(
			[
				study({ id: 'topical', topical: true, usedBookIds: ['rom'] }),
				study({ id: 'john', primaryBooks: ['John'], usedBookIds: ['rom'] }),
				study({ id: 'early', on: '2026-01-14', usedBookIds: ['rom'] }),
				study({ id: 'candidate' })
			],
			[commentary]
		);
		expect(rates).toEqual([{ bookId: 'rom', bibleBook: 'Romans', used: 0, opportunities: 1 }]);
	});

	it('skips a commentary with no acquisition date', () => {
		expect(
			computeHitRates([study({ id: 'a', usedBookIds: ['rom'] })], [
				{ ...commentary, acquiredOn: null }
			])
		).toEqual([]);
	});

	it('counts a study once when it is listed twice', () => {
		const row = study({ id: 'a', usedBookIds: ['rom'] });
		const rates = computeHitRates([row, row], [commentary]);
		expect(rates[0]).toMatchObject({ used: 1, opportunities: 1 });
	});
});
