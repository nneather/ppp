import type { BookCitationInput } from './types';

/** Well-known lexica cited unsigned `ABBR, s.v. "lemma," page.` (Covenant / Turabian). */
export const UNSIGNED_LEXICON_ABBREVS = new Set([
	'BDAG',
	'BAGD',
	'LSJ',
	'BDB',
	'HALOT',
	'HALAT',
	'LEH',
	'DCH'
]);

export function isUnsignedLexiconVolume(volume: BookCitationInput): boolean {
	const abbr = (volume.series_abbreviation ?? '').trim().toUpperCase();
	return abbr.length > 0 && UNSIGNED_LEXICON_ABBREVS.has(abbr);
}
