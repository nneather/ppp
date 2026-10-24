import { describe, expect, it } from 'vitest';
import type { BookAuthorAssignment } from '$lib/types/library';
import { parseCitationHtmlSegments } from '../html-segments';
import {
	elideJournalPageEnd,
	formatJournalArticleBibliography,
	formatJournalArticleFootnote,
	formatJournalPageRange,
	type JournalArticleCitationInput
} from '../journal';

function author(last: string, first: string): BookAuthorAssignment {
	return {
		person_id: `p-${last.toLowerCase()}`,
		person_label: `${first} ${last}`,
		first_name: first,
		middle_name: null,
		last_name: last,
		suffix: null,
		role: 'author',
		sort_order: 0
	};
}

function article(partial: Partial<JournalArticleCitationInput> & Pick<JournalArticleCitationInput, 'title' | 'journal_title'>): JournalArticleCitationInput {
	return {
		volume: null,
		issue: null,
		year: null,
		page_start: null,
		page_end: null,
		doi: null,
		authors: [],
		...partial
	};
}

describe('elideJournalPageEnd', () => {
	it('follows Chicago inclusive numbers', () => {
		expect(formatJournalPageRange('157', '162')).toBe('157\u201362');
		expect(formatJournalPageRange('152', '164')).toBe('152\u201364');
		expect(formatJournalPageRange('225', '232')).toBe('225\u201332');
		expect(formatJournalPageRange('100', '104')).toBe('100\u2013104');
		expect(formatJournalPageRange('101', '108')).toBe('101\u20138');
		expect(formatJournalPageRange('498', '532')).toBe('498\u2013532');
		expect(elideJournalPageEnd(11564, 11615)).toBe('615');
	});
});

describe('formatJournalArticleFootnote', () => {
	const denton = article({
		title: 'Inheritance in Paul and Ephesians',
		journal_title: 'Evangelical Quarterly',
		volume: '54',
		year: 1982,
		page_start: '157',
		page_end: '162',
		authors: [author('Denton', 'D. R.')]
	});

	it('cites a volume-only article with the full page span', () => {
		expect(formatJournalArticleFootnote(denton).plain).toBe(
			'D. R. Denton, "Inheritance in Paul and Ephesians," Evangelical Quarterly 54 (1982): 157\u201362.'
		);
		expect(formatJournalArticleFootnote(denton).html).toContain('<i>Evangelical Quarterly</i>');
		expect(formatJournalArticleFootnote(denton).sourceType).toBe('journal-article');
	});

	it('uses a typed page in the note and keeps the span in the bibliography', () => {
		expect(formatJournalArticleFootnote(denton, { page: '160' }).plain).toBe(
			'D. R. Denton, "Inheritance in Paul and Ephesians," Evangelical Quarterly 54 (1982): 160.'
		);
		expect(formatJournalArticleBibliography(denton).plain).toBe(
			'Denton, D. R. "Inheritance in Paul and Ephesians." Evangelical Quarterly 54 (1982): 157\u201362.'
		);
		const docx = parseCitationHtmlSegments(formatJournalArticleBibliography(denton).html)
			.map((segment) => segment.text)
			.join('');
		expect(docx).toBe(
			'Denton, D. R. \u201cInheritance in Paul and Ephesians.\u201d Evangelical Quarterly 54 (1982): 157\u201362.'
		);
		expect(
			parseCitationHtmlSegments(formatJournalArticleBibliography(denton).html).some(
				(segment) => segment.italic && segment.text === 'Evangelical Quarterly'
			)
		).toBe(true);
	});

	it('includes the issue number', () => {
		const buchem = article({
			title: 'Hermeneutics of Voice: Counter-Reading 1 Kings 12 from an Indigenous Perspective',
			journal_title: 'Bangalore Theological Forum',
			volume: '50',
			issue: '1',
			year: 2018,
			page_start: '152',
			page_end: '164',
			authors: [author('Buchem', 'Wungtei')]
		});
		expect(formatJournalArticleFootnote(buchem).plain).toContain(
			'Bangalore Theological Forum 50, no. 1 (2018): 152\u201364.'
		);
	});

	it('appends a DOI after the page span', () => {
		const fox = article({
			title: 'Royal Officials and Court Families',
			journal_title: 'The Biblical Archaeologist',
			volume: '59',
			issue: '4',
			year: 1996,
			page_start: '225',
			page_end: '232',
			doi: '10.2307/3210564',
			authors: [author('Fox', 'Nili')]
		});
		expect(formatJournalArticleBibliography(fox).plain).toBe(
			'Fox, Nili. "Royal Officials and Court Families." The Biblical Archaeologist 59, no. 4 (1996): 225\u201332. https://doi.org/10.2307/3210564.'
		);
	});

	it('shortens to last name, title, and the first page', () => {
		expect(formatJournalArticleFootnote(denton, { shortForm: 'short' }).plain).toBe(
			'Denton, "Inheritance in Paul and Ephesians," 157.'
		);
	});
});
