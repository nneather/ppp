import { describe, expect, it } from 'vitest';
import { normalizeCitationText } from '../text-normalize';

describe('normalizeCitationText', () => {
	it('NFC-composes Greek base + breathing + accent', () => {
		// alpha + combining smooth breathing + combining acute
		const nfd = 'α\u0313\u0301';
		expect(normalizeCitationText(nfd)).toBe('ἄ');
		expect([...normalizeCitationText(nfd)].length).toBe(1);
	});

	it('leaves precomposed Greek unchanged', () => {
		expect(normalizeCitationText('ἀγάπη')).toBe('ἀγάπη');
		expect(normalizeCitationText('λέγω')).toBe('λέγω');
	});
});
