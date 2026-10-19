import { describe, expect, it } from 'vitest';
import { studyPassageRanges } from '../passage-ranges';

describe('studyPassageRanges', () => {
	it('uses structured primary rows and ignores the display string', () => {
		expect(
			studyPassageRanges('Romans 1', [
				{
					bible_book: 'Matthew',
					chapter_start: 6,
					verse_start: 25,
					chapter_end: null,
					verse_end: null
				}
			])
		).toEqual([
			{
				bibleBook: 'Matthew',
				chapter: 6,
				verse: 25,
				chapterEnd: null,
				verseEnd: null
			}
		]);
	});

	it('parses a verse range, a Psalm alias, and a chapter span', () => {
		expect(studyPassageRanges('Matthew 6:25–34')).toEqual([
			{
				bibleBook: 'Matthew',
				chapter: 6,
				verse: 25,
				chapterEnd: 6,
				verseEnd: 34
			}
		]);
		expect(studyPassageRanges('Psalm 110')).toEqual([
			{
				bibleBook: 'Psalms',
				chapter: 110,
				verse: null,
				chapterEnd: null,
				verseEnd: null
			}
		]);
		expect(studyPassageRanges('Matthew 5-7')).toEqual([
			{
				bibleBook: 'Matthew',
				chapter: 5,
				verse: null,
				chapterEnd: 7,
				verseEnd: null
			}
		]);
	});

	it('splits a second book after and, and keeps a semicolon cluster on one book', () => {
		expect(studyPassageRanges('Psalm 110 and Hebrews 1').map((row) => row.bibleBook)).toEqual([
			'Psalms',
			'Hebrews'
		]);
		expect(studyPassageRanges('Proverbs 14:17, 29; 15:1')).toHaveLength(3);
	});

	it('returns nothing when the display is empty and there are no rows', () => {
		expect(studyPassageRanges(null)).toEqual([]);
		expect(studyPassageRanges('   ', [])).toEqual([]);
	});
});
