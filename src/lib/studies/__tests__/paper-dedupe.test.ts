import { describe, expect, it } from 'vitest';
import { findPaperDuplicate, titlesNearlyMatch, type LivePaperRef } from '../paper-dedupe';

const proverbs: LivePaperRef = {
	id: 'prov',
	title: 'Open Your Mouth for Justice, Not for Intoxication: An Annotated Translation of Proverbs 31:1-9',
	passageDisplay: 'Proverbs 31:1–9',
	primary: { bibleBook: 'Proverbs', chapter: 31, verseStart: 1 }
};

describe('titlesNearlyMatch', () => {
	it('matches a long shared prefix and an exact short title', () => {
		expect(
			titlesNearlyMatch(
				'Open Your Mouth for Justice, Not for Intoxication',
				proverbs.title
			)
		).toBe(true);
		expect(titlesNearlyMatch('Law', 'Law')).toBe(true);
		expect(titlesNearlyMatch('Exodus', 'Exodus and the covenant')).toBe(false);
	});
});

describe('findPaperDuplicate', () => {
	it('prefers the title and still catches the same passage', () => {
		expect(
			findPaperDuplicate(
				{
					title: 'Open Your Mouth for Justice, Not for Intoxication',
					passageDisplay: null
				},
				[proverbs]
			)?.reason
		).toBe('title');

		expect(
			findPaperDuplicate(
				{ title: 'A different argument about the king', passageDisplay: 'Proverbs 31:1-9' },
				[proverbs]
			)
		).toMatchObject({ id: 'prov', reason: 'passage' });
	});

	it('does not match a different chapter of the same book', () => {
		expect(
			findPaperDuplicate(
				{ title: 'Something else entirely here', passageDisplay: 'Proverbs 1:1' },
				[proverbs]
			)
		).toBeNull();
	});
});
