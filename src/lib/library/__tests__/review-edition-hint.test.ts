import { describe, expect, it } from 'vitest';
import { editionHintFromNote } from '../review';

describe('editionHintFromNote', () => {
	it('returns null for empty note', () => {
		expect(editionHintFromNote(null)).toBeNull();
		expect(editionHintFromNote('')).toBeNull();
		expect(editionHintFromNote('   ')).toBeNull();
	});

	it('parses ordinal edition from review note', () => {
		expect(
			editionHintFromNote(
				'2nd ed. (eds Davie/Grass/Holmes/McDowell/Noble); ISBN not verified from primary source.'
			)
		).toBe('2nd ed.');
	});

	it('normalizes ordinal edition without trailing period', () => {
		expect(editionHintFromNote('Needs 3rd ed at shelf')).toBe('3rd ed.');
	});

	it('parses revised edition abbreviations', () => {
		expect(editionHintFromNote('Check rev. ed. binding')).toBe('rev. ed.');
		expect(editionHintFromNote('revised ed. on spine')).toBe('revised ed.');
	});

	it('returns null when no edition pattern matches', () => {
		expect(editionHintFromNote('Verify at shelf')).toBeNull();
		expect(editionHintFromNote('Missing: author')).toBeNull();
	});
});
