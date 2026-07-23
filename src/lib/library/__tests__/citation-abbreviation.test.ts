import { describe, expect, it } from 'vitest';
import {
	effectiveSeriesAbbreviation,
	normalizeCitationAbbreviationOrNull
} from '../citation-abbreviation';

describe('effectiveSeriesAbbreviation', () => {
	it('prefers book citation_abbreviation over series', () => {
		expect(
			effectiveSeriesAbbreviation({
				citation_abbreviation: 'DOTHB',
				series_abbreviation: 'IVP'
			})
		).toBe('DOTHB');
	});

	it('falls back to series abbreviation', () => {
		expect(
			effectiveSeriesAbbreviation({
				citation_abbreviation: null,
				series_abbreviation: 'ABD'
			})
		).toBe('ABD');
	});

	it('treats blank override as absent', () => {
		expect(
			effectiveSeriesAbbreviation({
				citation_abbreviation: '  ',
				series_abbreviation: 'TDNT'
			})
		).toBe('TDNT');
	});

	it('returns null when both empty', () => {
		expect(effectiveSeriesAbbreviation({ citation_abbreviation: null, series_abbreviation: null })).toBe(
			null
		);
	});
});

describe('normalizeCitationAbbreviationOrNull', () => {
	it('trims and nulls blanks', () => {
		expect(normalizeCitationAbbreviationOrNull('  DJG  ')).toBe('DJG');
		expect(normalizeCitationAbbreviationOrNull('')).toBe(null);
		expect(normalizeCitationAbbreviationOrNull('   ')).toBe(null);
	});
});
