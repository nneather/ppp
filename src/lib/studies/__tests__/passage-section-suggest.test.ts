import { describe, expect, it } from 'vitest';
import {
	footnotePageFromSection,
	footnotePagesByBook,
	passageSectionImportCandidates,
	tightestOverlappingSection,
	type OverlappingSection
} from '../passage-section-suggest';

function section(partial: Partial<OverlappingSection> & Pick<OverlappingSection, 'bookId'>): OverlappingSection {
	return {
		title: partial.title ?? partial.bookId,
		label: partial.label ?? null,
		pageStart: partial.pageStart ?? '1',
		pageEnd: partial.pageEnd ?? null,
		verseStartAbs: partial.verseStartAbs ?? 0,
		verseEndAbs: partial.verseEndAbs ?? 999999,
		...partial
	};
}

describe('tightestOverlappingSection', () => {
	it('picks the smaller span and keeps the first of a tie', () => {
		const wide = section({ bookId: 'b', verseStartAbs: 5000, verseEndAbs: 7999, pageStart: '103', pageEnd: '186' });
		const tight = section({ bookId: 'b', verseStartAbs: 6025, verseEndAbs: 6034, pageStart: '140', pageEnd: '155' });
		const same = section({ bookId: 'b', verseStartAbs: 1000, verseEndAbs: 1009, label: 'first' });
		const sameLater = section({ bookId: 'b', verseStartAbs: 2000, verseEndAbs: 2009, label: 'second' });
		expect(tightestOverlappingSection([wide, tight])).toBe(tight);
		expect(tightestOverlappingSection([same, sameLater])?.label).toBe('first');
		expect(tightestOverlappingSection([])).toBeNull();
	});
});

describe('footnote page prefill', () => {
	it('uses an en dash for a range and a single page when the ends match', () => {
		expect(footnotePageFromSection('103', '186')).toBe('103–186');
		expect(footnotePageFromSection('45', null)).toBe('45');
		expect(footnotePageFromSection('45', '45')).toBe('45');
		expect(footnotePageFromSection('  ', '9')).toBe('');
	});

	it('maps each book to its tightest section', () => {
		const pages = footnotePagesByBook([
			section({
				bookId: 'bon',
				title: 'Cost of Discipleship',
				verseStartAbs: 5000,
				verseEndAbs: 7999,
				pageStart: '103',
				pageEnd: '186'
			}),
			section({
				bookId: 'bon',
				title: 'Cost of Discipleship',
				verseStartAbs: 6000,
				verseEndAbs: 6999,
				pageStart: '140',
				pageEnd: '160'
			}),
			section({ bookId: 'other', pageStart: '12', pageEnd: null, verseStartAbs: 1, verseEndAbs: 2 })
		]);
		expect(pages).toEqual({ bon: '140–160', other: '12' });
	});
});

describe('passageSectionImportCandidates', () => {
	const bon = section({
		bookId: 'bon',
		title: 'The Cost of Discipleship',
		label: 'Sermon on the Mount',
		pageStart: '103',
		pageEnd: '186',
		verseStartAbs: 5000,
		verseEndAbs: 7999
	});
	const bonTight = section({
		bookId: 'bon',
		title: 'The Cost of Discipleship',
		label: 'Anxiety',
		pageStart: '140',
		pageEnd: '155',
		verseStartAbs: 6025,
		verseEndAbs: 6034
	});
	const commentary = section({
		bookId: 'comm',
		title: 'Matthew',
		label: 'Matthew 5–7',
		pageStart: '200',
		pageEnd: '240',
		verseStartAbs: 5000,
		verseEndAbs: 7999
	});

	it('offers the book once, drops commentary coverage, and keeps a section that also has an index hit', () => {
		const rows = passageSectionImportCandidates(
			[commentary, bon, bonTight],
			[
				{ bookId: 'comm', genre: 'Commentary' },
				{ bookId: 'bon', genre: 'Theology' }
			],
			['bon', 'index-only', 'comm']
		);
		expect(rows.map((row) => row.bookId)).toEqual(['bon']);
		expect(rows[0]).toMatchObject({
			bookId: 'bon',
			essayId: null,
			title: 'The Cost of Discipleship',
			notes: null,
			hint: 'Anxiety · p. 140–155'
		});
	});

	it('does not turn an index-only book into a candidate', () => {
		expect(passageSectionImportCandidates([], [], ['index-only'])).toEqual([]);
	});
});
