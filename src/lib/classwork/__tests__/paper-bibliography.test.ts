import { describe, expect, it } from 'vitest';
import type { BookAuthorAssignment } from '$lib/types/library';
import type { BookCitationInput } from '$lib/library/turabian';
import {
	bibliographyDownloadName,
	compilePaperBibliography,
	compileSectionedBibliography,
	formatPaperBibliographyEntries,
	sectionPaperBibliography
} from '../paper-bibliography';
import type {
	PaperArticleSourceView,
	PaperBookSourceView,
	PaperEssaySourceView,
	PaperSourceView
} from '../paper-sources';

function author(last: string, first = 'Test', role: BookAuthorAssignment['role'] = 'author') {
	return {
		person_id: `p-${last.toLowerCase()}`,
		person_label: `${first} ${last}`,
		first_name: first,
		middle_name: null,
		last_name: last,
		suffix: null,
		role,
		sort_order: 0
	} satisfies BookAuthorAssignment;
}

function book(id: string, title: string, authors: BookAuthorAssignment[], year = 2001) {
	return {
		id,
		title,
		subtitle: null,
		publisher: 'Test Press',
		publisher_location: 'Chicago',
		year,
		edition: null,
		total_volumes: null,
		original_year: null,
		reprint_publisher: null,
		reprint_location: null,
		reprint_year: null,
		series_name: null,
		series_abbreviation: null,
		volume_number: null,
		genre: null,
		work_type: 'monograph',
		language: 'english',
		authors
	} satisfies BookCitationInput;
}

function bookSource(
	id: string,
	title: string,
	last: string,
	year = 2001,
	usage: PaperBookSourceView['usage'] = 'cited'
): PaperBookSourceView {
	return {
		kind: 'book',
		sourceId: `src-${id}`,
		groupId: null,
		usage,
		notes: null,
		citation: book(id, title, [author(last)], year),
		owned: true,
		authorsLabel: last
	};
}

function essaySource(
	essayTitle: string,
	essayAuthors: BookAuthorAssignment[],
	volumeTitle = 'Collected Studies'
): PaperEssaySourceView {
	const volume = {
		...book('vol-1', volumeTitle, [author('Editor', 'Vera', 'editor')], 1998),
		work_type: 'edited_volume' as const
	};
	return {
		kind: 'essay',
		sourceId: `src-essay-${essayTitle}`,
		groupId: null,
		usage: 'cited',
		notes: null,
		essayId: `essay-${essayTitle}`,
		essay: {
			essay_title: essayTitle,
			page_start: 10,
			page_end: 25,
			authors: essayAuthors.length > 0 ? essayAuthors : undefined
		},
		volume,
		parentBookId: 'vol-1',
		parentOwned: true,
		authorsLabel: essayAuthors[0]?.last_name ?? null
	};
}

describe('formatPaperBibliographyEntries', () => {
	it('merges books and essays into one alpha-sorted flat list', () => {
		const sources: PaperSourceView[] = [
			bookSource('b1', 'Zeta Studies', 'Zimmerman'),
			essaySource('A Reading of Ruth', [author('Miller', 'Mary')]),
			bookSource('b2', 'Alpha Themes', 'Adams')
		];
		const entries = formatPaperBibliographyEntries(sources);
		expect(entries).toHaveLength(3);
		expect(entries[0]!.plain).toMatch(/^Adams/);
		expect(entries[1]!.plain).toMatch(/^Miller/);
		expect(entries[2]!.plain).toMatch(/^Zimmerman/);
	});

	it('formats a journal article instead of a book', () => {
		const article: PaperArticleSourceView = {
			kind: 'article',
			sourceId: 'src-denton',
			groupId: null,
			usage: 'cited',
			notes: null,
			articleId: 'art-denton',
			article: {
				title: 'Inheritance in Paul and Ephesians',
				journal_title: 'Evangelical Quarterly',
				volume: '54',
				issue: null,
				year: 1982,
				page_start: '157',
				page_end: '162',
				doi: null,
				authors: [author('Denton', 'D. R.')]
			},
			authorsLabel: 'D. R. Denton'
		};
		const entries = formatPaperBibliographyEntries([
			bookSource('b1', 'Zeta Studies', 'Zimmerman'),
			article
		]);
		expect(entries.map((e) => e.plain.split('.')[0])).toEqual(['Denton, D', 'Zimmerman, Test']);
		expect(entries[0]!.plain).toContain('Evangelical Quarterly 54 (1982): 157\u201362.');
		expect(entries[0]!.plain).not.toMatch(/Chicago: Test Press/);
		expect(entries[0]!.sourceType).toBe('journal-article');
	});

	it('drops unsigned essays (empty bibliography entries)', () => {
		const sources: PaperSourceView[] = [
			bookSource('b1', 'Alpha Themes', 'Adams'),
			essaySource('agape', [])
		];
		const entries = formatPaperBibliographyEntries(sources);
		expect(entries).toHaveLength(1);
		expect(entries[0]!.plain).toMatch(/^Adams/);
	});

	it('lists a commentary volume once when two of its parts are cited', () => {
		const volume = {
			...book('kd-6', 'Proverbs, Ecclesiastes, Song of Songs', [author('Delitzsch', 'Franz')], 1996),
			genre: 'Commentary',
			series_name: 'Keil and Delitzsch Commentary',
			series_abbreviation: 'K&D',
			volume_number: '6',
			publisher: 'Hendrickson',
			publisher_location: 'Peabody, MA'
		};
		const part = (title: string): PaperEssaySourceView => ({
			kind: 'essay',
			sourceId: `src-${title}`,
			groupId: null,
			usage: 'cited',
			notes: null,
			essayId: `essay-${title}`,
			essay: {
				essay_title: title,
				authors: [author('Delitzsch', 'Franz')]
			},
			volume,
			parentBookId: 'kd-6',
			parentOwned: true,
			authorsLabel: 'Delitzsch'
		});
		const entries = formatPaperBibliographyEntries([part('Proverbs'), part('Ecclesiastes')]);
		expect(entries).toHaveLength(1);
		expect(entries[0]!.plain).toContain('Proverbs, Ecclesiastes, Song of Songs');
		expect(entries[0]!.plain).not.toContain('"Proverbs."');
	});

	it('keeps a book and an essay from the same volume as separate entries', () => {
		const essay = essaySource('A Reading of Ruth', [author('Miller', 'Mary')]);
		const volumeAsBook: PaperBookSourceView = {
			kind: 'book',
			sourceId: 'src-vol',
			groupId: null,
			usage: 'cited',
			notes: null,
			citation: essay.volume,
			owned: true,
			authorsLabel: 'Editor'
		};
		const entries = formatPaperBibliographyEntries([essay, volumeAsBook]);
		expect(entries).toHaveLength(2);
	});
});

describe('compilePaperBibliography', () => {
	it('joins plain with blank lines and html with <p> blocks', () => {
		const compiled = compilePaperBibliography([
			bookSource('b1', 'Alpha Themes', 'Adams'),
			bookSource('b2', 'Zeta Studies', 'Zimmerman')
		]);
		expect(compiled.plain.split('\n\n')).toHaveLength(2);
		expect(compiled.html.match(/<p>/g)).toHaveLength(2);
		expect(compiled.plain.indexOf('Adams')).toBeLessThan(compiled.plain.indexOf('Zimmerman'));
	});

	it('returns empty strings for no sources', () => {
		const compiled = compilePaperBibliography([]);
		expect(compiled.plain).toBe('');
		expect(compiled.html).toBe('');
	});

	it('defaults to consulted and cited, and can include candidates', () => {
		const compiled = compilePaperBibliography([
			bookSource('b1', 'Alpha Themes', 'Adams', 2001, 'cited'),
			bookSource('b2', 'Zeta Studies', 'Zimmerman', 2001, 'candidate'),
			bookSource('b3', 'Middle Work', 'Miller', 2002, 'consulted')
		]);
		expect(compiled.plain).toContain('Adams');
		expect(compiled.plain).toContain('Miller');
		expect(compiled.plain).not.toContain('Zimmerman');
		const all = compilePaperBibliography(
			[bookSource('b2', 'Zeta Studies', 'Zimmerman', 2001, 'candidate')],
			{ includeCandidates: true }
		);
		expect(all.plain).toContain('Zimmerman');
	});
});

describe('sectionPaperBibliography', () => {
	const groups = [
		{ id: 'g-sys', name: 'Systematic Theology', sort_order: 0 },
		{ id: 'g-lang', name: 'NT language tools', sort_order: 1 }
	];

	it('keeps group order and sorts inside each section', () => {
		const sources: PaperSourceView[] = [
			{ ...bookSource('b-z', 'Zeta Studies', 'Zimmerman'), groupId: 'g-sys' },
			{ ...bookSource('b-a', 'Alpha Themes', 'Adams'), groupId: 'g-sys' },
			{ ...bookSource('b-m', 'Middle Work', 'Miller'), groupId: 'g-lang' }
		];
		const sections = sectionPaperBibliography(sources, groups);
		expect(sections.map((s) => s.heading)).toEqual(['Systematic Theology', 'NT language tools']);
		expect(sections[0]!.entries.map((e) => e.plain)).toEqual([
			expect.stringMatching(/^Adams/),
			expect.stringMatching(/^Zimmerman/)
		]);
	});

	it('puts ungrouped entries first with no heading and skips empty groups', () => {
		const sources: PaperSourceView[] = [
			bookSource('b-a', 'Alpha Themes', 'Adams'),
			{ ...bookSource('b-m', 'Middle Work', 'Miller'), groupId: 'g-lang' }
		];
		const sections = sectionPaperBibliography(sources, groups);
		expect(sections).toHaveLength(2);
		expect(sections[0]!.heading).toBeNull();
		expect(sections[0]!.entries[0]!.plain).toMatch(/^Adams/);
		expect(sections[1]!.heading).toBe('NT language tools');
	});

	it('lists a volume in each group that cites it, and includes essays', () => {
		const shared = bookSource('b-a', 'Alpha Themes', 'Adams');
		const essay = {
			...essaySource('A Reading of Ruth', [author('Miller', 'Mary')]),
			groupId: 'g-lang'
		};
		const sections = sectionPaperBibliography(
			[{ ...shared, groupId: 'g-sys' }, { ...shared, groupId: 'g-lang' }, essay],
			groups
		);
		expect(sections[0]!.entries).toHaveLength(1);
		expect(sections[1]!.entries.map((e) => e.plain).join('\n')).toMatch(/Adams/);
		expect(sections[1]!.entries.map((e) => e.plain).join('\n')).toMatch(/Miller/);
	});

	it('escapes group names in the clipboard html and omits candidates by default', () => {
		const compiled = compileSectionedBibliography(
			[
				{ ...bookSource('b-a', 'Alpha Themes', 'Adams', 2001, 'cited'), groupId: 'g-sys' },
				{
					...bookSource('b-z', 'Zeta Studies', 'Zimmerman', 2001, 'candidate'),
					groupId: 'g-lang'
				}
			],
			[{ id: 'g-sys', name: 'A & B <set>', sort_order: 0 }]
		);
		expect(compiled.plain).toContain('A & B <set>');
		expect(compiled.plain).not.toContain('Zimmerman');
		expect(compiled.html).toContain('<strong>A &amp; B &lt;set&gt;</strong>');
		expect(compiled.html).toContain('<p>');
	});
});

describe('bibliographyDownloadName', () => {
	it('slugs the lead and falls back when nothing is ascii', () => {
		expect(bibliographyDownloadName('Romans 8:1–11')).toBe('romans-8-1-11-bibliography.docx');
		expect(bibliographyDownloadName('—')).toBe('study-bibliography.docx');
	});
});
