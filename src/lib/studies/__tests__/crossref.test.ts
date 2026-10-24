import { describe, expect, it } from 'vitest';
import { normalizeDoi, parseCrossrefWork } from '../crossref';

describe('normalizeDoi', () => {
	it('strips a resolver URL and lowercases', () => {
		expect(normalizeDoi('https://doi.org/10.2307/3210564')).toBe('10.2307/3210564');
	});

	it('rejects a bare title', () => {
		expect(normalizeDoi('Marshall JSNT 1999')).toBeNull();
	});
});

describe('parseCrossrefWork', () => {
	it('reads title, journal, authors, and a page range', () => {
		const prefill = parseCrossrefWork(
			{
				title: ['Women and the Pastoral Epistles'],
				'container-title': ['Journal for the Study of the New Testament'],
				author: [{ given: 'I. Howard', family: 'Marshall' }],
				volume: '54',
				issue: '1',
				page: '157-162',
				issued: { 'date-parts': [[1999]] }
			},
			'10.1177/0142064x9902105401'
		);
		expect(prefill).toEqual({
			doi: '10.1177/0142064x9902105401',
			title: 'Women and the Pastoral Epistles',
			journalTitle: 'Journal for the Study of the New Testament',
			authors: 'Marshall, I. Howard',
			year: 1999,
			volume: '54',
			issue: '1',
			pageStart: '157',
			pageEnd: '162'
		});
	});

	it('returns null without a journal', () => {
		expect(parseCrossrefWork({ title: ['Only a title'] }, '10.1000/xyz')).toBeNull();
	});
});
