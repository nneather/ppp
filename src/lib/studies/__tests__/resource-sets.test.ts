import { describe, expect, it } from 'vitest';
import type { ByBookShelfHit } from '$lib/types/sermons';
import {
	candidatesFromCommentaryHits,
	catalogRefsFromGroupSources,
	countNewMembers,
	filterResourceSetItems,
	groupResourceSetList,
	groupSetsIntoSections,
	groupVolumeSearchHits,
	parseResourceSetRules,
	resolveSetMembers,
	resourceSetListLabel,
	slugifyResourceName,
	testamentOfBibleBook,
	type ResourceSetListItem,
	type RuleCandidate,
	type SetOverride
} from '../resource-sets';

function cand(partial: Partial<RuleCandidate> & Pick<RuleCandidate, 'title'>): RuleCandidate {
	return {
		bookId: partial.bookId ?? null,
		essayId: partial.essayId ?? null,
		title: partial.title,
		createdAt: partial.createdAt ?? null,
		seriesId: partial.seriesId ?? null,
		volumeNumber: partial.volumeNumber ?? null,
		seriesAbbreviation: partial.seriesAbbreviation ?? null
	};
}

function ov(
	kind: SetOverride['kind'],
	bookId: string,
	title: string | null = null
): SetOverride {
	return { kind, bookId, essayId: null, title };
}

describe('parseResourceSetRules', () => {
	it('keeps known kinds and drops junk', () => {
		expect(
			parseResourceSetRules([
				{ kind: 'bible_book', value: 'Romans' },
				{ kind: 'genre', value: '  Greek Language Tools  ' },
				{ kind: 'nope', value: 'x' },
				{ kind: 'topic', value: '' }
			])
		).toEqual([
			{ kind: 'bible_book', value: 'Romans' },
			{ kind: 'genre', value: 'Greek Language Tools' }
		]);
	});
});

describe('resolveSetMembers', () => {
	const candidates = [
		cand({ bookId: 'a', title: 'Alpha', createdAt: '2026-10-01T00:00:00Z' }),
		cand({ bookId: 'b', title: 'Beta', createdAt: '2026-10-18T00:00:00Z' })
	];

	it('returns rule matches and badges rows newer than last review', () => {
		const { included, excluded } = resolveSetMembers({
			candidates,
			overrides: [],
			lastReviewedAt: '2026-10-10T00:00:00Z'
		});
		expect(excluded).toEqual([]);
		expect(included.map((m) => [m.title, m.isNew])).toEqual([
			['Alpha', false],
			['Beta', true]
		]);
		expect(countNewMembers(included)).toBe(1);
	});

	it('treats a never-reviewed set as having no new rows', () => {
		const { included } = resolveSetMembers({
			candidates,
			overrides: [],
			lastReviewedAt: null
		});
		expect(countNewMembers(included)).toBe(0);
	});

	it('drops excludes and adds includes that are not rule matches', () => {
		const { included, excluded } = resolveSetMembers({
			candidates,
			overrides: [ov('exclude', 'a', 'Alpha'), ov('include', 'c', 'Gamma')],
			lastReviewedAt: null
		});
		expect(included.map((m) => m.title)).toEqual(['Beta', 'Gamma']);
		expect(included.find((m) => m.title === 'Gamma')?.origin).toBe('include');
		expect(excluded.map((m) => m.title)).toEqual(['Alpha']);
	});

	it('rolls volumes that share a series and a title into one row', () => {
		const { included } = resolveSetMembers({
			candidates: [
				cand({ bookId: 'v2', title: 'TDNT', seriesId: 'tdnt', volumeNumber: '2', seriesAbbreviation: 'TDNT' }),
				cand({ bookId: 'v10', title: 'TDNT', seriesId: 'tdnt', volumeNumber: '10', seriesAbbreviation: 'TDNT' }),
				cand({ bookId: 'v1', title: 'TDNT', seriesId: 'tdnt', volumeNumber: '1', seriesAbbreviation: 'TDNT' }),
				cand({ bookId: 'iliad', title: 'Iliad', seriesId: 'loeb', volumeNumber: '1', seriesAbbreviation: 'LCL' }),
				cand({ bookId: 'odyssey', title: 'Odyssey', seriesId: 'loeb', volumeNumber: '1', seriesAbbreviation: 'LCL' })
			],
			overrides: [],
			lastReviewedAt: null
		});
		const tdnt = included.find((member) => member.title === 'TDNT');
		expect(tdnt?.bookId).toBe('v1');
		expect(tdnt?.volumeBookIds).toEqual(['v1', 'v2', 'v10']);
		expect(tdnt?.volumeCount).toBe(3);
		expect(included.map((member) => member.title)).toEqual(['Iliad', 'Odyssey', 'TDNT']);
	});

	it('groups a multi-volume search hit and leaves different titles apart', () => {
		const groups = groupVolumeSearchHits([
			{ id: 'v2', title: 'NIDOTTE', seriesId: 'nid', volumeNumber: '2', seriesAbbreviation: 'NIDOTTE' },
			{ id: 'v1', title: 'NIDOTTE', seriesId: 'nid', volumeNumber: '1', seriesAbbreviation: 'NIDOTTE' },
			{ id: 'v1b', title: 'NIDOTTE', seriesId: 'nid', volumeNumber: '1', seriesAbbreviation: 'NIDOTTE' },
			{ id: 'bdb', title: 'BDB', seriesId: null, volumeNumber: null, seriesAbbreviation: null }
		]);
		expect(groups.map((group) => group.title)).toEqual(['BDB', 'NIDOTTE']);
		expect(groups.find((group) => group.title === 'NIDOTTE')?.bookIds).toEqual(['v1', 'v1b', 'v2']);
	});

	it('sorts members without leading articles', () => {
		const { included } = resolveSetMembers({
			candidates: [
				cand({ bookId: '1', title: 'The Odyssey' }),
				cand({ bookId: '2', title: 'A Greek Grammar' }),
				cand({ bookId: '3', title: 'Der Römerbrief' })
			],
			overrides: [],
			lastReviewedAt: null
		});
		expect(included.map((m) => m.title)).toEqual([
			'A Greek Grammar',
			'The Odyssey',
			'Der Römerbrief'
		]);
	});

	it('keeps a reference-only rule match in the set', () => {
		const { included } = resolveSetMembers({
			candidates,
			overrides: [{ ...ov('include', 'a', 'Alpha'), bibliographical: false }],
			lastReviewedAt: null
		});
		const alpha = included.find((m) => m.bookId === 'a');
		expect(alpha?.origin).toBe('rule');
		expect(alpha?.bibliographical).toBe(false);
		expect(included.find((m) => m.bookId === 'b')?.bibliographical).toBe(true);
	});

	it('lets exclude win over a sticky include of the same book', () => {
		const { included, excluded } = resolveSetMembers({
			candidates: [],
			overrides: [ov('include', 'c', 'Gamma'), ov('exclude', 'c', 'Gamma')],
			lastReviewedAt: null
		});
		expect(included).toEqual([]);
		expect(excluded.map((m) => m.title)).toEqual(['Gamma']);
	});

	it('hides dismissed books from both lists', () => {
		const { included, excluded } = resolveSetMembers({
			candidates: [
				cand({ bookId: 'odyssey', title: 'Odyssey' }),
				cand({ bookId: 'bdag', title: 'BDAG' })
			],
			overrides: [{ kind: 'dismiss', bookId: 'odyssey', essayId: null, title: 'Odyssey' }],
			lastReviewedAt: null
		});
		expect(included.map((m) => m.title)).toEqual(['BDAG']);
		expect(excluded).toEqual([]);
	});
});

describe('groupResourceSetList', () => {
	it('orders Bible books in canon order and buckets the other kinds', () => {
		const items: ResourceSetListItem[] = [
			item('language', 'OT language tools', 1),
			item('bible_book', 'Commentaries: Romans', 0, 'Romans'),
			item('custom', 'Systematic Theology', 0),
			item('bible_book', 'Commentaries: Genesis', 0, 'Genesis'),
			item('language', 'NT language tools', 0)
		];
		const grouped = groupResourceSetList(items);
		expect(grouped.bibleBooks.map((i) => i.bibleBook)).toEqual(['Genesis', 'Romans']);
		expect(grouped.language.map((i) => i.name)).toEqual([
			'NT language tools',
			'OT language tools'
		]);
		expect(grouped.custom.map((i) => i.name)).toEqual(['Systematic Theology']);
	});
});

describe('set sections', () => {
	it('slugifies names the same way the seed does', () => {
		expect(slugifyResourceName('  NT language tools ')).toBe('nt-language-tools');
		expect(slugifyResourceName('Septuagint')).toBe('septuagint');
		expect(slugifyResourceName('---')).toBe('');
	});

	it('labels a commentary set by the Bible book', () => {
		expect(resourceSetListLabel(item('bible_book', 'Commentaries: Romans', 0, 'Romans'))).toBe(
			'Romans'
		);
	});

	it('splits the canon at Matthew', () => {
		expect(testamentOfBibleBook('Malachi')).toBe('ot');
		expect(testamentOfBibleBook('Matthew')).toBe('nt');
		expect(testamentOfBibleBook('Romans')).toBe('nt');
		expect(testamentOfBibleBook(null)).toBeNull();
	});

	it('keeps an empty section and sorts Bible books in canon order', () => {
		const sections = groupSetsIntoSections(
			[
				{
					id: 'custom',
					name: 'Custom',
					slug: 'custom',
					setKind: 'custom',
					locked: false,
					sortOrder: 3
				},
				{
					id: 'bible',
					name: 'Bible books',
					slug: 'bible-books',
					setKind: 'bible_book',
					locked: true,
					sortOrder: 0
				},
				{
					id: 'empty',
					name: 'Septuagint',
					slug: 'septuagint',
					setKind: 'custom',
					locked: false,
					sortOrder: 2
				}
			],
			[
				item('bible_book', 'Commentaries: Romans', 0, 'Romans'),
				item('bible_book', 'Commentaries: Genesis', 0, 'Genesis')
			].map((row) => ({ ...row, sectionId: 'bible' }))
		);
		expect(sections.map((s) => s.slug)).toEqual(['bible-books', 'septuagint', 'custom']);
		expect(sections[0]?.items.map((row) => row.bibleBook)).toEqual(['Genesis', 'Romans']);
		expect(sections[1]?.items).toEqual([]);
	});

	it('filters on the book name', () => {
		const rows = [
			item('bible_book', 'Commentaries: Romans', 0, 'Romans'),
			item('language', 'NT language tools', 0)
		];
		expect(filterResourceSetItems(rows, 'rom').map((row) => row.bibleBook)).toEqual(['Romans']);
	});
});

describe('candidatesFromCommentaryHits', () => {
	it('collapses a series to one candidate and keeps the newest created_at', () => {
		const base = (title: string, createdAt: string): ByBookShelfHit & { createdAt: string } => ({
			kind: 'book',
			bookId: title,
			essayId: null,
			title,
			authorShort: null,
			seriesLabel: 'NICNT',
			seriesId: 'series-1',
			authorKey: 'person-1',
			rating: null,
			genre: 'Commentary',
			href: `/library/books/${title}`,
			shelfDismissed: false,
			memberBookIds: [title],
			memberEssayIds: [],
			createdAt
		});
		const out = candidatesFromCommentaryHits([
			base('Romans', '2020-01-01T00:00:00Z'),
			base('1 Corinthians', '2026-10-01T00:00:00Z')
		]);
		expect(out).toHaveLength(1);
		expect(out[0]?.createdAt).toBe('2026-10-01T00:00:00Z');
		expect(out[0]?.seriesAbbreviation).toBe('NICNT');
		expect(out[0]?.seriesId).toBe('series-1');
	});

	it('falls back to series name when abbreviation is absent', () => {
		const hit: ByBookShelfHit & { createdAt: string; volumeNumber?: string } = {
			kind: 'book',
			bookId: 'b1',
			essayId: null,
			title: 'Romans',
			authorShort: null,
			seriesLabel: 'New International Commentary',
			seriesId: 'series-1',
			authorKey: null,
			rating: null,
			genre: 'Commentary',
			href: '/library/books/b1',
			shelfDismissed: false,
			memberBookIds: ['b1'],
			memberEssayIds: [],
			createdAt: '2020-01-01T00:00:00Z',
			volumeNumber: '1'
		};
		const out = candidatesFromCommentaryHits([hit]);
		expect(out[0]?.seriesAbbreviation).toBe('New International Commentary');
		expect(out[0]?.volumeNumber).toBe('1');
	});
});

describe('catalogRefsFromGroupSources', () => {
	it('dedupes book and essay sources for save-as-set', () => {
		expect(
			catalogRefsFromGroupSources([
				{ book_id: 'b1', essay_id: null },
				{ book_id: 'b1', essay_id: null },
				{ book_id: null, essay_id: 'e1' },
				{ bookId: 'b2', essayId: null }
			])
		).toEqual([
			{ bookId: 'b1', essayId: null },
			{ bookId: null, essayId: 'e1' },
			{ bookId: 'b2', essayId: null }
		]);
	});
});

function item(
	kind: ResourceSetListItem['kind'],
	name: string,
	sortOrder: number,
	bibleBook: string | null = null
): ResourceSetListItem {
	return {
		id: name,
		name,
		slug: name,
		kind,
		sectionId: kind,
		sortOrder,
		bibleBook,
		memberCount: 0,
		newCount: 0
	};
}
