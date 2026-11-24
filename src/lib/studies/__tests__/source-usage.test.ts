import { describe, expect, it } from 'vitest';
import { compiledBibliographyStartsWithCandidates } from '../source-usage';

describe('compiledBibliographyStartsWithCandidates', () => {
	it('includes candidates when that is the whole list', () => {
		expect(compiledBibliographyStartsWithCandidates(['candidate', 'candidate'])).toBe(true);
	});

	it('keeps the consulted and cited default once any source is promoted', () => {
		expect(compiledBibliographyStartsWithCandidates(['candidate', 'cited'])).toBe(false);
		expect(compiledBibliographyStartsWithCandidates(['consulted'])).toBe(false);
	});

	it('stays off when the study has no sources', () => {
		expect(compiledBibliographyStartsWithCandidates([])).toBe(false);
	});
});
